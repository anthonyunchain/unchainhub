/**
 * apifyStartScrape
 *
 * Starts Apify actor runs to scrape social media data for all clients.
 * Runs asynchronously — Apify calls apifyWebhookReceiver when each run completes.
 *
 * Trigger: admin via UI button OR monthly cron (1st of each month at 07:00 UTC).
 *
 * Body params:
 *   type    : 'social_stats' | 'competitor' | 'trends' | 'all'  (default: 'all')
 *   period  : 'YYYY-MM'  (default: previous month)
 *   auto    : boolean    (true when called from cron)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAdmin } from '../_shared/auth.ts';
import { format, subMonths } from 'npm:date-fns@3';

const APIFY_API_BASE = 'https://api.apify.com/v2';

// Well-known Apify actor IDs
const ACTORS = {
  instagram: 'apify/instagram-scraper',
  tiktok: 'clockworks/tiktok-scraper',
  instagramHashtag: 'apify/instagram-hashtag-scraper',
};

// ── Apify helper ──────────────────────────────────────────────────────────────

async function startApifyRun({
  actorId,
  input,
  webhookUrl,
  token,
}: {
  actorId: string;
  input: Record<string, unknown>;
  webhookUrl: string;
  token: string;
}): Promise<{ runId: string; datasetId?: string } | null> {
  const res = await fetch(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        webhooks: [
          {
            eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.ABORTED'],
            requestUrl: webhookUrl,
            // Apify will add header X-Apify-Webhook-Secret automatically if set on the actor
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[apifyStartScrape] Failed to start actor ${actorId}: ${err}`);
    return null;
  }

  const data = await res.json();
  return {
    runId: data.data?.id,
    datasetId: data.data?.defaultDatasetId,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Auth: admin user OR cron (service role key in Authorization header) ──
    const authHeader = req.headers.get('Authorization') || '';
    const isCronCall = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '__never__');

    if (!isCronCall) {
      const adminResult = await verifyAdmin(req, supabaseAdmin);
      if (adminResult instanceof Response) return adminResult;
    }

    const body = await req.json().catch(() => ({})) as {
      type?: string;
      period?: string;
      auto?: boolean;
    };

    const scrapeType = body.type || 'all';
    const period = body.period || format(subMonths(new Date(), 1), 'yyyy-MM');
    const triggeredBy = isCronCall ? 'cron' : 'admin';

    const apifyToken = Deno.env.get('APIFY_TOKEN') || '';
    const webhookSecret = Deno.env.get('APIFY_WEBHOOK_SECRET') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';

    if (!apifyToken) {
      return Response.json({ error: 'APIFY_TOKEN not configured' }, { status: 500, headers: corsHeaders(req) });
    }

    const receiverBase = `${supabaseUrl}/functions/v1/apifyWebhookReceiver`;

    // ── 1. Fetch all clients with at least one social handle ─────────────────
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, company_name, instagram_handle, tiktok_handle, linkedin_url, competitor_handles, trend_hashtags')
      .or('instagram_handle.not.is.null,tiktok_handle.not.is.null');

    if (clientsError) throw clientsError;
    if (!clients?.length) {
      return Response.json(
        { success: true, message: 'No clients with social handles configured', started: 0 },
        { headers: corsHeaders(req) },
      );
    }

    // ── 2. Create a scrape_jobs record ────────────────────────────────────────
    const { data: job, error: jobError } = await supabaseAdmin
      .from('scrape_jobs')
      .insert({
        type: scrapeType,
        status: 'running',
        clients_count: clients.length,
        triggered_by: triggeredBy,
        apify_run_ids: [],
      })
      .select('id')
      .single();

    if (jobError) throw jobError;
    const jobId = job.id;

    // ── 3. Start actor runs for each client ───────────────────────────────────
    const runIds: Array<{
      runId: string;
      clientId: string;
      clientName: string;
      platform: string;
      type: string;
      status: string;
    }> = [];

    const doSocialStats = scrapeType === 'social_stats' || scrapeType === 'all';
    const doCompetitor = scrapeType === 'competitor' || scrapeType === 'all';
    const doTrends = scrapeType === 'trends' || scrapeType === 'all';

    for (const client of clients) {
      const clientId = client.id;
      const clientName = client.company_name || '';

      // ── Social stats: client's own accounts ──────────────────────────────
      if (doSocialStats) {
        // Instagram
        if (client.instagram_handle) {
          const handle = client.instagram_handle.replace('@', '');
          const webhookUrl = `${receiverBase}?` +
            new URLSearchParams({
              clientId, clientName, platform: 'Instagram', type: 'social_stats', period, jobId,
              secret: webhookSecret,
            }).toString();

          const run = await startApifyRun({
            actorId: ACTORS.instagram,
            input: {
              directUrls: [`https://www.instagram.com/${handle}/`],
              resultsType: 'details',
              resultsLimit: 30,
            },
            webhookUrl,
            token: apifyToken,
          });

          if (run?.runId) {
            runIds.push({ runId: run.runId, clientId, clientName, platform: 'Instagram', type: 'social_stats', status: 'running' });
          }
        }

        // TikTok
        if (client.tiktok_handle) {
          const handle = client.tiktok_handle.replace('@', '');
          const webhookUrl = `${receiverBase}?` +
            new URLSearchParams({
              clientId, clientName, platform: 'TikTok', type: 'social_stats', period, jobId,
              secret: webhookSecret,
            }).toString();

          const run = await startApifyRun({
            actorId: ACTORS.tiktok,
            input: {
              profiles: [handle],
              resultsPerPage: 30,
            },
            webhookUrl,
            token: apifyToken,
          });

          if (run?.runId) {
            runIds.push({ runId: run.runId, clientId, clientName, platform: 'TikTok', type: 'social_stats', status: 'running' });
          }
        }
      }

      // ── Competitor stats ──────────────────────────────────────────────────
      if (doCompetitor && Array.isArray(client.competitor_handles)) {
        for (const comp of client.competitor_handles as Array<{ platform: string; handle: string }>) {
          if (!comp.handle) continue;
          const handle = comp.handle.replace('@', '');
          const platform = comp.platform || 'Instagram';

          const webhookUrl = `${receiverBase}?` +
            new URLSearchParams({
              clientId, clientName, platform, type: 'competitor', period, jobId,
              competitorHandle: comp.handle,
              secret: webhookSecret,
            }).toString();

          let run: { runId: string } | null = null;

          if (platform === 'Instagram') {
            run = await startApifyRun({
              actorId: ACTORS.instagram,
              input: {
                directUrls: [`https://www.instagram.com/${handle}/`],
                resultsType: 'details',
                resultsLimit: 30,
              },
              webhookUrl,
              token: apifyToken,
            });
          } else if (platform === 'TikTok') {
            run = await startApifyRun({
              actorId: ACTORS.tiktok,
              input: {
                profiles: [handle],
                resultsPerPage: 30,
              },
              webhookUrl,
              token: apifyToken,
            });
          }

          if (run?.runId) {
            runIds.push({ runId: run.runId, clientId, clientName, platform, type: 'competitor', status: 'running' });
          }
        }
      }

      // ── Trend hashtags ────────────────────────────────────────────────────
      if (doTrends && Array.isArray(client.trend_hashtags) && client.trend_hashtags.length > 0) {
        const hashtags = (client.trend_hashtags as string[]).filter(Boolean);

        const webhookUrl = `${receiverBase}?` +
          new URLSearchParams({
            clientId, clientName, platform: 'Instagram', type: 'trends', period, jobId,
            secret: webhookSecret,
          }).toString();

        const run = await startApifyRun({
          actorId: ACTORS.instagramHashtag,
          input: {
            hashtags,
            resultsLimit: 20,
          },
          webhookUrl,
          token: apifyToken,
        });

        if (run?.runId) {
          runIds.push({ runId: run.runId, clientId, clientName, platform: 'Instagram', type: 'trends', status: 'running' });
        }
      }
    }

    // ── 4. Update scrape_jobs with all run IDs ────────────────────────────────
    await supabaseAdmin
      .from('scrape_jobs')
      .update({ apify_run_ids: runIds })
      .eq('id', jobId);

    // If no runs were started (e.g. all handles were empty), mark job as done
    if (runIds.length === 0) {
      await supabaseAdmin
        .from('scrape_jobs')
        .update({ status: 'done', finished_at: new Date().toISOString(), results_count: 0 })
        .eq('id', jobId);
    }

    return Response.json(
      {
        success: true,
        jobId,
        runsStarted: runIds.length,
        clientsCount: clients.length,
        period,
        type: scrapeType,
      },
      { headers: corsHeaders(req) },
    );
  } catch (error) {
    console.error('[apifyStartScrape] Error:', error?.message);
    return Response.json(
      { error: error?.message || 'Internal error' },
      { status: 500, headers: corsHeaders(req) },
    );
  }
});
