/**
 * @file src/app/api/providers/vote/route.ts
 * @description Secure API endpoint for recording image quality votes
 * 
 * POST /api/providers/vote
 *   Record a vote for a provider's image quality.
 *   Requires authentication.
 * 
 * GET /api/providers/vote
 *   Get vote statistics for providers.
 *   Public endpoint.
 * 
 * Security measures:
 * - Origin validation
 * - User agent filtering
 * - Rate limiting (per-minute, per-hour, per-day)
 * - Idempotency key validation
 * - Input validation with Zod
 * - Server-side vote deduplication
 * - Request fingerprinting
 * - Audit logging
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Voting system imports
import {
  // Security
  performSecurityChecks,
  extractUserId,
  checkPaidStatus,
  getClientIp,
  hashIp,
  hashUserAgent,
  generateVoteId,
  isIdempotencyKeyUsed,
  markIdempotencyKeyUsed,
  
  // Validation
  safeValidateVoteRequest,
  validateProviderExists,
  
  // Rate limiting
  checkRateLimit,
  consumeRateLimit,
  getRateLimitHeaders,
  detectSuspiciousActivity,
  
  // Storage
  storeVote,
  addUserVote,
  incrementProviderStats,
  getProviderStats,
  getCachedRankings,
  
  // Constants
  SIGNAL_WEIGHTS,
  PAID_MULTIPLIER,
  
  // Types
  type VoteRecord,
  type VoteErrorCode,
  type SignalType,
} from '@/lib/voting';

// Provider catalog for validation
import providersData from '@/data/providers/providers.json';

// Valid provider IDs set (for O(1) lookup)
const VALID_PROVIDER_IDS = new Set(
  (providersData as Array<{ id: string }>).map((p) => p.id)
);

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function errorResponse(
  error: string,
  code: VoteErrorCode,
  status: number,
  headers?: Record<string, string>
) {
  return NextResponse.json(
    { success: false, error, code },
    { status, headers }
  );
}

function successResponse(
  providerId: string,
  weight: number,
  rank: number | null
) {
  return NextResponse.json({
    success: true,
    vote: { providerId, weight, rank },
  });
}

// ============================================================================
// POST /api/providers/vote
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // ========================================================================
    // 1. SECURITY CHECKS
    // ========================================================================
    
    const securityCheck = performSecurityChecks(request);
    if (!securityCheck.valid) {
      return errorResponse(
        securityCheck.error!,
        'SUSPICIOUS_REQUEST',
        403
      );
    }
    
    // ========================================================================
    // 2. AUTHENTICATION
    // ========================================================================
    
    const userId = extractUserId(request);
    
    if (!userId) {
      return errorResponse(
        'Authentication required',
        'UNAUTHORIZED',
        401
      );
    }
    
    // ========================================================================
    // 3. PARSE AND VALIDATE REQUEST BODY
    // ========================================================================
    
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        'Invalid JSON body',
        'INVALID_REQUEST',
        400
      );
    }
    
    const validation = safeValidateVoteRequest(body);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message ?? 'Invalid request';
      return errorResponse(errorMessage, 'INVALID_REQUEST', 400);
    }
    
    const { providerId, signalType, idempotencyKey } = validation.data;
    
    // ========================================================================
    // 4. VALIDATE PROVIDER EXISTS
    // ========================================================================
    
    if (!validateProviderExists(providerId, VALID_PROVIDER_IDS)) {
      return errorResponse(
        'Provider not found',
        'INVALID_PROVIDER',
        404
      );
    }
    
    // ========================================================================
    // 5. IDEMPOTENCY CHECK
    // ========================================================================
    
    const keyUsed = await isIdempotencyKeyUsed(idempotencyKey);
    
    if (keyUsed) {
      return errorResponse(
        'Request already processed',
        'REPLAY_DETECTED',
        409
      );
    }
    
    // ========================================================================
    // 6. RATE LIMIT CHECK
    // ========================================================================
    
    const rateCheck = await checkRateLimit(request, userId, providerId);
    const rateLimitHeaders = getRateLimitHeaders(rateCheck);
    
    if (!rateCheck.allowed) {
      return errorResponse(
        rateCheck.reason!,
        rateCheck.code === 'DAILY_LIMIT'
          ? 'DAILY_LIMIT'
          : rateCheck.code === 'PROVIDER_LIMIT'
            ? 'ALREADY_VOTED'
            : 'RATE_LIMITED',
        429,
        rateLimitHeaders
      );
    }
    
    // ========================================================================
    // 7. SUSPICIOUS ACTIVITY CHECK
    // ========================================================================
    
    const suspicious = await detectSuspiciousActivity(request);
    
    if (suspicious) {
      // Log but don't block (soft detection)
      if (process.env.NODE_ENV === 'development') {
         
        console.warn('[Vote] Suspicious activity detected:', { userId, providerId });
      }
    }
    
    // ========================================================================
    // 8. CHECK PAID STATUS (for vote weight)
    // ========================================================================
    
    const isPaidUser = await checkPaidStatus(userId);
    const userTier = isPaidUser ? 'paid' : 'free';
    
    // ========================================================================
    // 9. CALCULATE VOTE WEIGHT
    // ========================================================================
    
    const baseWeight = SIGNAL_WEIGHTS[signalType as SignalType];
    const finalWeight = isPaidUser ? baseWeight * PAID_MULTIPLIER : baseWeight;
    
    // ========================================================================
    // 10. CREATE VOTE RECORD
    // ========================================================================
    
    const voteId = generateVoteId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days
    
    const ip = getClientIp(request);
    const ua = request.headers.get('user-agent') || '';
    const origin = request.headers.get('origin');
    
    const voteRecord: VoteRecord = {
      id: voteId,
      userId,
      providerId,
      signalType: signalType as SignalType,
      baseWeight,
      finalWeight,
      userTier,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      meta: {
        ipHash: hashIp(ip),
        uaHash: hashUserAgent(ua),
        origin,
        idempotencyKey,
      },
    };
    
    // ========================================================================
    // 11. STORE VOTE (atomic operations)
    // ========================================================================
    
    try {
      // Mark idempotency key as used FIRST (prevents race conditions)
      await markIdempotencyKeyUsed(idempotencyKey);
      
      // Store the vote record
      await storeVote(voteRecord);
      
      // Add to user's vote history
      await addUserVote(userId, {
        providerId,
        voteId,
        votedAt: now.getTime(),
      });
      
      // Increment provider stats
      await incrementProviderStats(providerId, signalType, finalWeight);
      
      // Consume rate limit token
      await consumeRateLimit(request, providerId);
    } catch (storageError) {
      // Log storage error
      if (process.env.NODE_ENV === 'development') {
         
        console.error('[Vote] Storage error:', storageError);
      }
      
      return errorResponse(
        'Failed to record vote',
        'INTERNAL_ERROR',
        500
      );
    }
    
    // ========================================================================
    // 12. GET CURRENT RANK (for response)
    // ========================================================================
    
    let currentRank: number | null = null;
    
    try {
      const rankings = await getCachedRankings();
      if (rankings) {
        const providerRanking = rankings.find((r) => r.providerId === providerId);
        currentRank = providerRanking?.imageQualityRank ?? null;
      }
    } catch {
      // Non-critical - rank is informational only
    }
    
    // ========================================================================
    // 13. AUDIT LOG (development only)
    // ========================================================================
    
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - startTime;
      // eslint-disable-next-line no-console
      console.log('[Vote] Success:', {
        voteId,
        providerId,
        signalType,
        weight: finalWeight,
        userTier,
        duration: `${duration}ms`,
      });
    }
    
    // ========================================================================
    // 14. RETURN SUCCESS
    // ========================================================================
    
    return successResponse(providerId, finalWeight, currentRank);
    
  } catch (error) {
    // Unexpected error - log and return generic message
    if (process.env.NODE_ENV === 'development') {
       
      console.error('[Vote] Unexpected error:', error);
    }
    
    return errorResponse(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    );
  }
}

// ============================================================================
// GET /api/providers/vote
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    
    // ========================================================================
    // SINGLE PROVIDER STATS
    // ========================================================================
    
    if (providerId) {
      // Validate provider ID
      if (!validateProviderExists(providerId, VALID_PROVIDER_IDS)) {
        return NextResponse.json(
          { error: 'Provider not found' },
          { status: 404 }
        );
      }
      
      const stats = await getProviderStats(providerId);
      
      if (!stats) {
        // Return empty stats for provider with no votes
        return NextResponse.json({
          providerId,
          totalVotes: 0,
          signals: {
            imageUploads: 0,
            imageLikes: 0,
            comments: 0,
            cardLikes: 0,
          },
        });
      }
      
      return NextResponse.json({
        providerId,
        totalVotes: stats.totalVoteCount,
        signals: {
          imageUploads: stats.signals.imageUploads,
          imageLikes: stats.signals.imageLikes,
          comments: stats.signals.comments,
          cardLikes: stats.signals.cardLikes,
        },
        bayesianScore: stats.bayesianScore,
        communityRank: stats.communityRank,
        lastCalculated: stats.lastCalculated,
      });
    }
    
    // ========================================================================
    // ALL RANKINGS
    // ========================================================================
    
    const rankings = await getCachedRankings();
    
    if (!rankings) {
      return NextResponse.json({
        rankings: [],
        lastCalculated: null,
        message: 'Rankings not yet calculated',
      });
    }
    
    // Return simplified ranking data
    return NextResponse.json({
      rankings: rankings.map((r) => ({
        providerId: r.providerId,
        imageQualityRank: r.imageQualityRank,
        bayesianScore: r.bayesianScore,
        totalVotes: r.stats?.totalVoteCount ?? 0,
      })),
      lastCalculated: rankings[0]?.stats?.lastCalculated ?? null,
    });
    
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
       
      console.error('[Vote GET] Error:', error);
    }
    
    return NextResponse.json(
      { error: 'Failed to retrieve vote data' },
      { status: 500 }
    );
  }
}
