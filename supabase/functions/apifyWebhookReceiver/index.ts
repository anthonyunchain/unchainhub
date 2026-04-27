/**
 * apifyWebhookReceiver
 *
 * Called by Apify when an actor run completes (ACTOR.RUN.SUCCEEDED).
 * Reads the run's dataset, transforms the data, and upserts it into the
 * appropriate Supabase table (client_stats, competitor_stats, content_trends).
 *
 * Security: verified via X-Apify-Webhook-Secret header (set as env var).
 * No Supabase JWT required — this is a server-to-server webhook.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { format } from 'npm:date-fns@3';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApifyWebhookBody {
  eventType: string;
  eventData: {
    actorId: string;
    actorRunId: string;
  };
  resource: {
    id: string;
    defaultDatasetId: string;
    status: string;
  };
}

interface InstagramProfileItem {
  username?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  latestPosts?: Array<{
    likesCount?: number;
    commentsCount?: number;
    videoViewCount?: number;
    displayUrl?: string;
    caption?: string;
    url?: string;
  }>;
}

interface TikTokProfileItem {
  authorMeta?: {
    name?: string;
    fans?: number;
    heart?: number;
    video?: number;
  };
  diggCount?: number;
  playCount?: number;
  commentCount?: number;
  shareCount?: number;
  webVideoUrl?: string;
  text?: string;
  covers?: string[];
}

interface HashtagItem {
  topPosts?: Array<{
    likesCount?: number;
    commentsCount?: number;
    displayUrl?: string;
    caption?: string;
    url?: string;
  }>;
  postsCount?: number;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // ── 1. Verify webhook secret ────────────────────────────────────────────
    // Secret is passed as URL query param (HTTPS, so safe from eavesdropping).
    // We also accept it via X-Apify-Webhook-Secret header as fallback.
    const url = new URL(req.url);
    const expectedSecret = Deno.env.get('APIFY_WEBHOOK_SECRET') || '';
    const incomingSecret =
      url.searchParams.get('secret') ||
      req.headers.get('X-Apify-Webhook-Secret') ||
      '';
    if (!expectedSecret || incomingSecret !== expectedSecret) {
      return Response.json(
        { error: 'Unauthorized webhook' },
        { status: 401, headers: corsHeaders(req) },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const apifyToken = Deno.env.get('APIFY_TOKEN') || '';

    // ── 2. Parse Apify webhook payload ──────────────────────────────────────
    const body = await req.json() as ApifyWebhookBody;

    if (body.eventType !== 'ACTOR.RUN.SUCCEEDED' || body.resource?.status !== 'SUCCEEDED') {
      // Silently accept non-success events (FAILED, ABORTED) — update job status if we have the jobId
      const jobId = url.searchParams.get('jobId');
      if (jobId && body.resource?.status === 'FAILED') {
        await supabaseAdmin
          .from('scrape_jobs')
          .update({ status: 'error', error_message: 'Apify run failed', finished_at: new Date().toISOString() })
          .eq('id', jobId);
      }
      return Response.json({ received: true }, { headers: corsHeaders(req) });
    }

    const datasetId = body.resource?.defaultDatasetId;
    if (!datasetId) {
      return Response.json({ error: 'No dataset ID' }, { status: 400, headers: corsHeaders(req) });
    }

    // ── 3. Read metadata from query params ──────────────────────────────────
    const clientId = url.searchParams.get('clientId') || '';
    const clientName = url.searchParams.get('clientName') || '';
    const platform = url.searchParams.get('platform') || 'Instagram';
    const scrapeType = url.searchParams.get('type') || 'social_stats'; // social_stats | competitor | trends
    const period = url.searchParams.get('period') || format(new Date(), 'yyyy-MM');
    const jobId = url.searchParams.get('jobId') || '';
    const competitorHandle = url.searchParams.get('competitorHandle') || '';

    // ── 4. Fetch dataset items from Apify ────────────────────────────────────
    const datasetRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&clean=true`,
    );
    if (!datasetRes.ok) {
      throw new Error(`Failed to fetch Apify dataset: ${datasetRes.status}`);
    }
    const items = await datasetRes.json();

    let resultsCount = 0;

    // ── 5. Process & upsert based on scrape type ─────────────────────────────
    if (scrapeType === 'social_stats' && platform === 'Instagram') {
      resultsCount = await processInstagramStats({
        items: items as InstagramProfileItem[],
        clientId,
        clientName,
        period,
        supabaseAdmin,
      });
    } else if (scrapeType === 'social_stats' && platform === 'TikTok') {
      resultsCount = await processTikTokStats({
        items: items as TikTokProfileItem[],
        clientId,
        clientName,
        period,
        supabaseAdmin,
      });
    } else if (scrapeType === 'competitor') {
      resultsCount = await processCompetitorStats({
        items: items as (InstagramProfileItem | TikTokProfileItem)[],
        clientId,
        clientName,
        competitorHandle,
        platform,
        period,
        supabaseAdmin,
      });
    } else if (scrapeType === 'trends') {
      resultsCount = await processTrends({
        items: items as HashtagItem[],
        clientId,
        clientName,
        platform,
        period,
        supabaseAdmin,
      });
    }

    // ── 6. Update scrape_jobs status ─────────────────────────────────────────
    if (jobId) {
      // Increment results_count (other runs for this job may complete concurrently)
      const { data: job } = await supabaseAdmin
        .from('scrape_jobs')
        .select('results_count, apify_run_ids, status')
        .eq('id', jobId)
        .single();

      if (job) {
        // Check if all runs for this job are done by counting SUCCEEDED runs in apify_run_ids
        const runIds = (job.apify_run_ids as any[]) || [];
        const runId = body.resource.id;
        const updatedRunIds = runIds.map((r: any) =>
          r.runId === runId ? { ...r, status: 'SUCCEEDED' } : r,
        );
        const allDone = updatedRunIds.every((r: any) => r.status === 'SUCCEEDED' || r.status === 'FAILED');

        await supabaseAdmin
          .from('scrape_jobs')
          .update({
            results_count: (job.results_count || 0) + resultsCount,
            apify_run_ids: updatedRunIds,
            ...(allDone ? { status: 'done', finished_at: new Date().toISOString() } : {}),
          })
          .eq('id', jobId);
      }
    }

    return Response.json(
      { success: true, scrapeType, platform, resultsCount },
      { headers: corsHeaders(req) },
    );
  } catch (error) {
    console.error('[apifyWebhookReceiver] Error:', error?.message);
    return Response.json(
      { error: error?.message || 'Internal error' },
      { status: 500, headers: corsHeaders(req) },
    );
  }
});

// ── Instagram stats processor ─────────────────────────────────────────────────

async function processInstagramStats({
  items,
  clientId,
  clientName,
  period,
  supabaseAdmin,
}: {
  items: InstagramProfileItem[];
  clientId: string;
  clientName: string;
  period: string;
  supabaseAdmin: any;
}): Promise<number> {
  if (!items?.length) return 0;

  const profile = items[0];
  const posts = profile.latestPosts || [];

  const totalLikes = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
  const totalViews = posts.reduce((sum, p) => sum + (p.videoViewCount || 0), 0);

  const payload = {
    client_name: clientName,
    period,
    platform: 'Instagram',
    views: totalViews,
    reach: 0, // not available via public scraping
    likes: totalLikes,
    comments: totalComments,
    shares: 0,
    followers_gained: profile.followersCount || 0,
    notes: `Auto-importé via Apify — ${posts.length} posts analysés`,
  };

  // Upsert by (client_name, period, platform)
  const { data: existing } = await supabaseAdmin
    .from('client_stats')
    .select('id')
    .eq('client_name', clientName)
    .eq('period', period)
    .eq('platform', 'Instagram')
    .single();

  if (existing?.id) {
    await supabaseAdmin.from('client_stats').update(payload).eq('id', existing.id);
  } else {
    await supabaseAdmin.from('client_stats').insert(payload);
  }

  return 1;
}

// ── TikTok stats processor ────────────────────────────────────────────────────

async function processTikTokStats({
  items,
  clientId,
  clientName,
  period,
  supabaseAdmin,
}: {
  items: TikTokProfileItem[];
  clientId: string;
  clientName: string;
  period: string;
  supabaseAdmin: any;
}): Promise<number> {
  if (!items?.length) return 0;

  const totalLikes = items.reduce((sum, p) => sum + (p.diggCount || 0), 0);
  const totalViews = items.reduce((sum, p) => sum + (p.playCount || 0), 0);
  const totalComments = items.reduce((sum, p) => sum + (p.commentCount || 0), 0);

  // authorMeta is present on all posts, grab from first
  const authorMeta = items[0]?.authorMeta;

  const payload = {
    client_name: clientName,
    period,
    platform: 'TikTok',
    views: totalViews,
    reach: 0,
    likes: totalLikes,
    comments: totalComments,
    shares: 0,
    followers_gained: authorMeta?.fans || 0,
    notes: `Auto-importé via Apify — ${items.length} posts analysés`,
  };

  const { data: existing } = await supabaseAdmin
    .from('client_stats')
    .select('id')
    .eq('client_name', clientName)
    .eq('period', period)
    .eq('platform', 'TikTok')
    .single();

  if (existing?.id) {
    await supabaseAdmin.from('client_stats').update(payload).eq('id', existing.id);
  } else {
    await supabaseAdmin.from('client_stats').insert(payload);
  }

  return 1;
}

// ── Competitor stats processor ────────────────────────────────────────────────

async function processCompetitorStats({
  items,
  clientId,
  clientName,
  competitorHandle,
  platform,
  period,
  supabaseAdmin,
}: {
  items: any[];
  clientId: string;
  clientName: string;
  competitorHandle: string;
  platform: string;
  period: string;
  supabaseAdmin: any;
}): Promise<number> {
  if (!items?.length || !clientId) return 0;

  let followers = 0;
  let avgLikes = 0;
  let avgViews = 0;
  let avgComments = 0;
  let postsCount = 0;

  if (platform === 'Instagram') {
    const profile = items[0] as InstagramProfileItem;
    const posts = profile.latestPosts || [];
    followers = profile.followersCount || 0;
    postsCount = posts.length;
    if (postsCount > 0) {
      avgLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0) / postsCount;
      avgComments = posts.reduce((s, p) => s + (p.commentsCount || 0), 0) / postsCount;
      avgViews = posts.reduce((s, p) => s + (p.videoViewCount || 0), 0) / postsCount;
    }
  } else if (platform === 'TikTok') {
    postsCount = items.length;
    followers = items[0]?.authorMeta?.fans || 0;
    if (postsCount > 0) {
      avgLikes = items.reduce((s: number, p: any) => s + (p.diggCount || 0), 0) / postsCount;
      avgViews = items.reduce((s: number, p: any) => s + (p.playCount || 0), 0) / postsCount;
      avgComments = items.reduce((s: number, p: any) => s + (p.commentCount || 0), 0) / postsCount;
    }
  }

  const payload = {
    client_id: clientId,
    client_name: clientName,
    competitor_handle: competitorHandle,
    platform,
    period,
    followers,
    avg_likes: Math.round(avgLikes),
    avg_views: Math.round(avgViews),
    avg_comments: Math.round(avgComments),
    posts_count: postsCount,
    scraped_at: new Date().toISOString(),
  };

  await supabaseAdmin
    .from('competitor_stats')
    .upsert(payload, { onConflict: 'client_id,competitor_handle,platform,period' });

  return 1;
}

// ── Content trends processor ──────────────────────────────────────────────────

async function processTrends({
  items,
  clientId,
  clientName,
  platform,
  period,
  supabaseAdmin,
}: {
  items: HashtagItem[];
  clientId: string;
  clientName: string;
  platform: string;
  period: string;
  supabaseAdmin: any;
}): Promise<number> {
  if (!items?.length || !clientId) return 0;

  const rows = items.map((item: any) => {
    const posts = item.topPosts || [];
    const samplePosts = posts.slice(0, 3).map((p: any) => ({
      url: p.url || p.shortCode ? `https://instagram.com/p/${p.shortCode}` : '',
      likes: p.likesCount || 0,
      caption: (p.caption || '').slice(0, 200),
      thumbnail_url: p.displayUrl || '',
    }));

    return {
      client_id: clientId,
      client_name: clientName,
      hashtag: item.name || item.id || '',
      platform,
      trend_score: item.postsCount || posts.length * 10,
      sample_posts: samplePosts,
      period,
      scraped_at: new Date().toISOString(),
    };
  });

  const validRows = rows.filter((r) => r.hashtag);
  if (validRows.length === 0) return 0;

  await supabaseAdmin.from('content_trends').insert(validRows);
  return validRows.length;
}
