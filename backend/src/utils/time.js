import { HttpError } from './httpErrors.js';

export const RESOLUTIONS = Object.freeze({
  '5m': 5 * 60_000,
  '10m': 10 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
});
const DAY = 24 * 60 * 60_000;

// Lambent's documented limits; calendar months approximated as 30 days here.
const ZONE_MAX_DAYS = { '5m': 4, '10m': 10, '15m': 14, '30m': 30, '1h': 60 };
const LEVEL_MAX_DAYS = { '5m': 90, '10m': 180, '15m': 240, '30m': 540, '1h': 730 };
const RELATIVE = /^(-?\d+(?:\.\d+)?)(min|m|h|d)$/;
const RELATIVE_MULTIPLIER = { min: 60_000, m: 60_000, h: 3_600_000, d: DAY };

function parseTime(raw, fallback, nowMs, intervalMs) {
  if (raw === undefined || raw === '') return fallback;
  if (typeof raw !== 'string') throw new HttpError(422, 'Timestamp must be a string');
  if (raw === 'now') return Math.floor(nowMs / intervalMs) * intervalMs;
  const match = raw.match(RELATIVE);
  if (match) {
    const actual = nowMs + Number(match[1]) * RELATIVE_MULTIPLIER[match[2]];
    // Relative timestamps stay on bucket boundaries between requests.
    return Math.floor(actual / intervalMs) * intervalMs;
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new HttpError(422, `Invalid timestamp: ${raw}`);
  return parsed;
}

export function parseOccupancyQuery(query, kind, nowMs = Date.now(), assetCount = 1) {
  const resolution = query.resolution ?? '30m';
  const step = RESOLUTIONS[resolution];
  if (!step) throw new HttpError(422, 'resolution must be one of: 5m, 10m, 15m, 30m, 1h');

  const start = parseTime(query.start, Math.floor((nowMs - 3.5 * 3_600_000) / step) * step, nowMs, step);
  const requestedEnd = parseTime(query.end, Math.floor((nowMs - 30 * 60_000) / step) * step, nowMs, step);
  if (start >= requestedEnd) throw new HttpError(422, 'start must be before end');

  const maxDays = (kind === 'zone' ? ZONE_MAX_DAYS : LEVEL_MAX_DAYS)[resolution];
  if (requestedEnd - start > maxDays * DAY) {
    throw new HttpError(422, `Range exceeds the ${resolution} limit for ${kind} occupancy`);
  }

  // Do not fabricate current or future sensor results: use a minimum 30-minute delay.
  const availableThrough = Math.floor((nowMs - 30 * 60_000) / step) * step;
  const end = Math.min(requestedEnd, availableThrough);
  const buckets = Math.ceil(Math.max(0, end - start) / step);
  if (buckets * assetCount > 10_000) {
    throw new HttpError(422, 'This mock limits responses to 10,000 rows; narrow the range or filter asset IDs');
  }
  return { start, end, requestedEnd, availableThrough, resolution, step };
}

export function asIso(milliseconds) { return new Date(milliseconds).toISOString(); }
