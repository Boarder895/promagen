/**
 * @file src/app/api/providers/vote/route.ts
 * @description Secure API endpoint for recording image quality votes
 * 
 * POST /api/providers/vote
 *   Record a vote for a provider's image quality.
 *   Requires Clerk authentication.
 * 
 * GET /api/providers/vote
 *   Get vote statistics for providers.
 *   Public endpoint.
 * 
 * Security measures:
 * - Clerk JWT validation (cryptographic)
 * - Origin validation (CORS)
 * - User agent filtering
 * - Rate limiting (per-minute, per-hour, per-day)
 * - Idempotency key validation (replay protection)
 * - Input validation with Zod
 * - Server-side vote deduplication
 * - Request fingerprinting
 * - Audit logging
 * 
 * Updated: January 2026 - Production Clerk integration
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Voting system imports
import {
  // Security (Clerk-integrated)
  performSecurityChecks,
  extractUserId,
  checkPaidStatus,
  getClientIp,
  hashIp,
  hashUserAgent,
  generateVoteId,
  isIdempotencyKeyUsed,
  markIdempotencyKeyUsed,
  createRequestFingerprint,
  getUserHash,
  
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

/**
 * Create error response with consistent structure.
 * Never exposes internal details to client.
 */
function errorResponse(
  error: string,
  code: VoteErrorCode,
  status: number,
  headers?: Record<string, string>
): NextResponse {
  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...headers,
  };
  
  return NextResponse.json(
    { success: false, error, code },
    { status, headers: responseHeaders }
  );
}

/**
 * Create success response with vote confirmation.
 */
function successResponse(
  providerId: string,
  weight: number,
  rank: number | null
): NextResponse {
  return NextResponse.json({
    success: true,
    vote: { providerId, weight, rank },
  }, {
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

// ============================================================================
// POST /api/providers/vote
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // ========================================================================
    // 1. SECURITY CHECKS (Pre-auth, fast rejection)
    // ========================================================================
    
    const securityCheck = performSecurityChecks(request);
    if (!securityCheck.valid) {
      // Log suspicious requests in production
      if (process.env.NODE_ENV === 'production') {
        console.warn('[Vote] Security check failed:', {
          code: securityCheck.code,
          ip: getClientIp(request),
          ua: request.headers.get('user-agent')?.slice(0, 50),
        });
      }
      
      return errorResponse(
        securityCheck.error!,
        'SUSPICIOUS_REQUEST',
        403
      );
    }
    
    // ========================================================================
    // 2. CLERK AUTHENTICATION (Cryptographic JWT validation)
    // ========================================================================
    
    const userId = await extractUserId(request);
    
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
    // 5. IDEMPOTENCY CHECK (Replay attack prevention)
    // ========================================================================
    
    const keyUsed = await isIdempotencyKeyUsed(idempotencyKey);
    
    if (keyUsed) {
      // Don't reveal that we detected a replay
      return errorResponse(
        'Request already processed',
        'REPLAY_DETECTED',
        409
      );
    }
    
    // ========================================================================
    // 6. RATE LIMIT CHECK
    // ========================================================================
    
    const userHash = getUserHash(request, userId);
    const rateCheck = await checkRateLimit(request, userHash, providerId);
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
    
    const fingerprint = createRequestFingerprint(request);
    const suspicious = await detectSuspiciousActivity(request, fingerprint);
    
    if (suspicious) {
      // Log but don't block (soft detection for analysis)
      console.warn('[Vote] Suspicious activity:', {
        userId: userId.slice(0, 10) + '...',
        providerId,
        fingerprint: fingerprint.slice(0, 16),
        reason: suspicious.reason,
      });
      
      // If highly suspicious, we could block here
      // For now, just log for manual review
    }
    
    // ========================================================================
    // 8. CHECK PAID STATUS (for vote weight - server-side only)
    // ========================================================================
    
    const isPaidUser = await checkPaidStatus(userId);
    const userTier = isPaidUser ? 'paid' : 'free';
    
    // ========================================================================
    // 9. CALCULATE VOTE WEIGHT (Never disclosed to client)
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
      userId, // Clerk user ID (verified)
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
        fingerprint: fingerprint.slice(0, 32), // Truncate for storage
      },
    };
    
    // ========================================================================
    // 11. STORE VOTE (atomic operations with error handling)
    // ========================================================================
    
    try {
      // Mark idempotency key as used FIRST (prevents race conditions)
      await markIdempotencyKeyUsed(idempotencyKey);
      
      // Store the vote record
      await storeVote(voteRecord);
      
      // Add to user's vote history (for deduplication)
      await addUserVote(userId, {
        providerId,
        voteId,
        votedAt: now.getTime(),
      });
      
      // Increment provider stats (aggregates)
      await incrementProviderStats(providerId, signalType, finalWeight);
      
      // Consume rate limit token
      await consumeRateLimit(request, providerId);
      
    } catch (storageError) {
      // Log storage error (but don't expose to client)
      console.error('[Vote] Storage error:', {
        voteId,
        providerId,
        error: storageError instanceof Error ? storageError.message : 'Unknown',
      });
      
      return errorResponse(
        'Failed to record vote',
        'INTERNAL_ERROR',
        500
      );
    }
    
    // ========================================================================
    // 12. GET CURRENT RANK (for response - informational only)
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
    // 13. AUDIT LOG
    // ========================================================================
    
    const duration = Date.now() - startTime;
    
    // Always log in production for audit trail
    console.debug('[Vote] Success:', {
      voteId,
      providerId,
      signalType,
      userTier,
      duration: `${duration}ms`,
      // Don't log userId or weight (privacy)
    });
    
    // ========================================================================
    // 14. RETURN SUCCESS
    // ========================================================================
    
    // Note: We return baseWeight, not finalWeight (paid multiplier is secret)
    return successResponse(providerId, baseWeight, currentRank);
    
  } catch (error) {
    // Unexpected error - log full details server-side
    console.error('[Vote] Unexpected error:', error);
    
    // Generic message to client (never expose stack traces)
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    
    // ========================================================================
    // SINGLE PROVIDER STATS
    // ========================================================================
    
    if (providerId) {
      // Validate provider ID format first
      if (!/^[a-z0-9-]+$/.test(providerId) || providerId.length > 50) {
        return NextResponse.json(
          { error: 'Invalid provider ID' },
          { status: 400 }
        );
      }
      
      // Validate provider exists
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
        }, {
          headers: {
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
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
      }, {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
        },
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
      }, {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
      });
    }
    
    // Return simplified ranking data (no internal scores)
    return NextResponse.json({
      rankings: rankings.map((r) => ({
        providerId: r.providerId,
        imageQualityRank: r.imageQualityRank,
        bayesianScore: r.bayesianScore !== null ? Math.round(r.bayesianScore * 100) / 100 : null, // Round for display
        totalVotes: r.stats?.totalVoteCount ?? 0,
      })),
      lastCalculated: rankings[0]?.stats?.lastCalculated ?? null,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    });
    
  } catch (error) {
    console.error('[Vote GET] Error:', error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve vote data' },
      { status: 500 }
    );
  }
}
