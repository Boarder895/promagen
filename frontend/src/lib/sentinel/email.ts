/**
 * Sentinel Email Sender
 *
 * Sends the Monday report via Resend API (transactional email).
 * Free tier: 3,000 emails/month — more than enough for weekly reports.
 *
 * Retry contract (sentinel.md §3.12):
 *   - One automatic retry after 60 seconds within the same invocation
 *   - If retry fails, run is marked report_sent = false
 *   - Old reports are never re-sent in full
 *
 * Authority: sentinel.md v1.2.0 §3.9, §3.12
 * Existing features preserved: Yes
 */

import 'server-only';

// =============================================================================
// TYPES
// =============================================================================

interface SendResult {
  sent: boolean;
  messageId: string | null;
  error: string | null;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

function getResendConfig(): { apiKey: string; emailTo: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const emailTo = process.env.SENTINEL_EMAIL_TO?.trim() ?? 'martin@promagen.com';

  if (!apiKey) {
    console.warn('[Sentinel Email] RESEND_API_KEY not configured — email disabled');
    return null;
  }

  return { apiKey, emailTo };
}

// =============================================================================
// SEND
// =============================================================================

/**
 * Send the Monday report email via Resend.
 *
 * Includes one automatic retry after 60s on failure.
 */
export async function sendReportEmail(
  subject: string,
  textBody: string,
): Promise<SendResult> {
  const config = getResendConfig();
  if (!config) {
    return { sent: false, messageId: null, error: 'RESEND_API_KEY not configured' };
  }

  // First attempt
  const firstAttempt = await attemptSend(config.apiKey, config.emailTo, subject, textBody);
  if (firstAttempt.sent) return firstAttempt;

  // Retry after 60s (sentinel.md §3.12)
  console.warn(
    `[Sentinel Email] First send failed: ${firstAttempt.error} — retrying in 60s`,
  );
  await sleep(60_000);

  const retry = await attemptSend(config.apiKey, config.emailTo, subject, textBody);
  if (!retry.sent) {
    console.error(
      `[Sentinel Email] Retry also failed: ${retry.error} — giving up`,
    );
  }

  return retry;
}

/**
 * Send a tripwire alert email (immediate, no retry).
 */
export async function sendTripwireAlert(
  subject: string,
  textBody: string,
): Promise<SendResult> {
  const config = getResendConfig();
  if (!config) {
    return { sent: false, messageId: null, error: 'RESEND_API_KEY not configured' };
  }

  return attemptSend(config.apiKey, config.emailTo, subject, textBody);
}

// =============================================================================
// INTERNAL
// =============================================================================

async function attemptSend(
  apiKey: string,
  to: string,
  subject: string,
  text: string,
): Promise<SendResult> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Promagen Sentinel <sentinel@promagen.com>',
        to: [to],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        sent: false,
        messageId: null,
        error: `Resend API ${response.status}: ${body}`,
      };
    }

    const data = (await response.json()) as { id?: string };
    return {
      sent: true,
      messageId: data.id ?? null,
      error: null,
    };
  } catch (error) {
    return {
      sent: false,
      messageId: null,
      error: error instanceof Error ? error.message : 'Unknown send error',
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
