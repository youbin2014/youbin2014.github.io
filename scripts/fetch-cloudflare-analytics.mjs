import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const endpoint = 'https://api.cloudflare.com/client/v4/graphql';
const token = process.env.CLOUDFLARE_ANALYTICS_API_TOKEN;
const accountTag = process.env.CLOUDFLARE_ACCOUNT_ID;
const requestHost = process.env.ANALYTICS_HOST || 'hanbinhong.com';
const windowDays = Number.parseInt(process.env.ANALYTICS_WINDOW_DAYS || '30', 10);
const outputPath = fileURLToPath(new URL('../src/data/traffic.json', import.meta.url));

if (!token || !accountTag) {
  throw new Error(
    'CLOUDFLARE_ANALYTICS_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required to refresh traffic data.',
  );
}

if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 180) {
  throw new Error('ANALYTICS_WINDOW_DAYS must be an integer between 1 and 180.');
}

const rangeEnd = new Date(Date.now() - 15 * 60 * 1000);
const rangeStart = new Date(rangeEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

const query = `
  query PublicReach(
    $accountTag: string!
    $requestHost: string!
    $start: Time!
    $end: Time!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        total: rumPageloadEventsAdaptiveGroups(
          filter: {
            datetime_geq: $start
            datetime_lt: $end
            requestHost: $requestHost
            bot: 0
          }
          limit: 1
        ) {
          count
          sum { visits }
          avg { sampleInterval }
        }
        countries: rumPageloadEventsAdaptiveGroups(
          filter: {
            datetime_geq: $start
            datetime_lt: $end
            requestHost: $requestHost
            bot: 0
          }
          limit: 250
          orderBy: [sum_visits_DESC]
        ) {
          count
          sum { visits }
          avg { sampleInterval }
          dimensions { countryName }
        }
        referrers: rumPageloadEventsAdaptiveGroups(
          filter: {
            datetime_geq: $start
            datetime_lt: $end
            requestHost: $requestHost
            bot: 0
          }
          limit: 50
          orderBy: [sum_visits_DESC]
        ) {
          count
          sum { visits }
          avg { sampleInterval }
          dimensions { refererHost }
        }
      }
    }
  }
`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    query,
    variables: {
      accountTag,
      requestHost,
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    },
  }),
  signal: AbortSignal.timeout(30_000),
});

if (!response.ok) {
  throw new Error(`Cloudflare GraphQL returned HTTP ${response.status}: ${await response.text()}`);
}

const payload = await response.json();

if (payload.errors?.length) {
  throw new Error(`Cloudflare GraphQL error: ${JSON.stringify(payload.errors)}`);
}

const account = payload.data?.viewer?.accounts?.[0];

if (!account) {
  throw new Error('Cloudflare GraphQL returned no matching account.');
}

const total = account.total?.[0] || { count: 0, sum: { visits: 0 }, avg: { sampleInterval: 1 } };
const sampleIntervals = [
  Number(total.avg?.sampleInterval || 1),
  ...(account.countries || []).map((row) => Number(row.avg?.sampleInterval || 1)),
  ...(account.referrers || []).map((row) => Number(row.avg?.sampleInterval || 1)),
].filter(Number.isFinite);
const sampleInterval = Math.max(1, ...sampleIntervals);

// Suppress very small geographic buckets before they become public. The overall
// totals remain useful, while individual low-volume countries are not exposed.
const countries = (account.countries || [])
  .map((row) => ({
    code: String(row.dimensions?.countryName || '').toUpperCase(),
    visits: Number(row.sum?.visits || 0),
    pageViews: Number(row.count || 0),
  }))
  .filter((row) => /^[A-Z]{2}$/.test(row.code) && row.pageViews >= 3)
  .sort((a, b) => b.visits - a.visits || b.pageViews - a.pageViews);

const referrerMap = new Map();

for (const row of account.referrers || []) {
  const rawHost = String(row.dimensions?.refererHost || '').trim().toLowerCase();
  const host = !rawHost ? 'Direct / unknown' : rawHost.replace(/^www\./, '');
  const visits = Number(row.sum?.visits || 0);
  const pageViews = Number(row.count || 0);

  if (host === requestHost || host === `www.${requestHost}` || visits < 1) continue;

  const current = referrerMap.get(host) || { host, visits: 0, pageViews: 0 };
  current.visits += visits;
  current.pageViews += pageViews;
  referrerMap.set(host, current);
}

const referrers = [...referrerMap.values()]
  .filter((row) => row.host === 'Direct / unknown' || row.visits >= 2)
  .sort((a, b) => b.visits - a.visits || b.pageViews - a.pageViews)
  .slice(0, 6);

const snapshot = {
  status: 'ready',
  windowDays,
  generatedAt: new Date().toISOString(),
  rangeStart: rangeStart.toISOString(),
  rangeEnd: rangeEnd.toISOString(),
  estimated: sampleInterval > 1,
  sampleInterval,
  visits: Number(total.sum?.visits || 0),
  pageViews: Number(total.count || 0),
  countries,
  referrers,
};

await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${windowDays}-day aggregate: ${snapshot.visits} visits, ${snapshot.pageViews} page views, ${countries.length} publishable countries.`,
);
