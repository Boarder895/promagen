import prisma from '../../lib/db';
import { subMinutes } from 'date-fns';

const APP_ID = process.env.REDDIT_APP_ID!;
const APP_SECRET = process.env.REDDIT_APP_SECRET!;
const USER_AGENT = process.env.REDDIT_USER_AGENT || 'PromagenLive/1.0';

async function getToken(): Promise<string> {
  const body = new URLSearchParams();
  body.append('grant_type', 'client_credentials');

  const r = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
      Authorization: 'Basic ' + Buffer.from(`${APP_ID}:${APP_SECRET}`).toString('base64'),
    },
    body,
  });
  const j = (await r.json()) as any;
  if (!j.access_token) throw new Error('Reddit auth failed');
  return j.access_token as string;
}

async function countMentions(token: string, term: string): Promise<number> {
  const r = await fetch(
    `https://oauth.reddit.com/search?q=${encodeURIComponent(term)}&sort=new&limit=50&t=hour`,
    {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
    },
  );
  const j = (await r.json()) as any;
  const posts = Array.isArray(j.data?.children) ? j.data.children : [];
  // Very simple mentions/min approximation: posts in the last hour / 60
  return Math.round(posts.length / 60);
}

async function getProviderNames(): Promise<{ id: string; name: string }[]> {
  // Adjust to your schema
  // @ts-ignore
  return prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT id::text, name FROM providers ORDER BY name;`,
  );
}

export async function runRedditMentionsCollector(): Promise<void> {
  if (!APP_ID || !APP_SECRET) return;
  const token = await getToken();

  const providers = await getProviderNames();
  const now = new Date();
  const since5 = subMinutes(now, 5);

  for (const { id, name } of providers) {
    const perMin = await countMentions(token, name);

    const updated = await prisma.$executeRawUnsafe(
      `
      UPDATE live_raw_metrics
      SET reddit_mentions_per_min = $1,
          ext_payload_json = COALESCE(ext_payload_json,'{}'::jsonb) || jsonb_build_object('redditTs', NOW())
      WHERE provider_id = $2 AND ts_utc >= $3
      `,
      perMin,
      id,
      since5,
    );

    if ((updated as unknown as number) === 0) {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO live_raw_metrics (provider_id, ts_utc, reddit_mentions_per_min)
        VALUES ($1, NOW(), $2)
        `,
        id,
        perMin,
      );
    }
  }
}

