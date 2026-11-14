import { regions, buildings, levels, zones, publicZone } from '../data/mockCampus.js';
import { asIso, parseOccupancyQuery } from '../utils/time.js';
import { HttpError } from '../utils/httpErrors.js';

const TENANT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ZONE_LOOKUP = new Map(zones.map((z) => [z.id, z]));
const LEVEL_ZONES = new Map(levels.map((l) => [l.id, zones.filter((z) => z.levelId === l.id)]));
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const localFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function localTimeParts(ms) {
  const parts = Object.fromEntries(localFormatter.formatToParts(new Date(ms)).map(({ type, value }) => [type, value]));
  return { hour: Number(parts.hour) + Number(parts.minute) / 60, weekend: parts.weekday === 'Sat' || parts.weekday === 'Sun' };
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sampleZoneOccupancy(zone, ms) {
  const { hour, weekend } = localTimeParts(ms);
  // Illustrative campus activity: morning ramp, afternoon peak, evening study use.
  const midDay = 0.76 * Math.exp(-0.5 * ((hour - 14.5) / 4.2) ** 2);
  const evening = 0.21 * Math.exp(-0.5 * ((hour - 20) / 2.1) ** 2);
  const base = 0.035 + midDay + evening;
  const variation = ((hash(`${zone.id}:${Math.floor(ms / 300_000)}`) % 10_000) / 10_000 - 0.5) * 0.11;
  const ratio = Math.max(0, Math.min(0.98, base * (weekend ? 0.67 : 1) * zone.mockProfile + variation));
  const population = zone.capacity ?? zone.mockReferencePopulation;
  return Math.round(population * ratio);
}

function samplesForAsset(kind, asset, begin, finish) {
  const sampleStep = 5 * 60_000;
  const samples = [];
  for (let ms = begin; ms < finish; ms += sampleStep) {
    const value = kind === 'zone'
      ? sampleZoneOccupancy(asset, ms)
      : LEVEL_ZONES.get(asset.id).reduce((n, zone) => n + sampleZoneOccupancy(zone, ms), 0);
    samples.push(value);
  }
  return samples;
}

function observation(kind, asset, begin, finish) {
  const samples = samplesForAsset(kind, asset, begin, finish);
  const mean = Math.round(samples.reduce((sum, n) => sum + n, 0) / samples.length);
  const peak = Math.max(...samples);
  const capacity = asset.capacity;
  return {
    [`${kind}_id`]: asset.id,
    start_timestamp: asIso(begin),
    end_timestamp: asIso(finish),
    mean_occupancy: mean,
    peak_occupancy: peak,
    mean_utilization: capacity == null ? null : Number((mean / capacity).toFixed(4)),
    peak_utilization: capacity == null ? null : Number((peak / capacity).toFixed(4)),
  };
}

function parseIds(value, kind) {
  if (value === undefined) return null;
  const fields = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(',')).filter(Boolean);
  if (fields.length === 0 || fields.some((v) => !UUID.test(v))) {
    throw new HttpError(422, `Invalid ${kind}_ids: expected UUID values`);
  }
  return new Set(fields);
}

/**
 * In-memory provider contract. Later: implement the same methods using
 * authenticated Lambent requests or a PostgreSQL-backed repository.
 */
export const mockLambentProvider = {
  getRegions: () => regions.map((r) => ({ ...r })),
  getBuildings: () => buildings.map((b) => ({ ...b })),
  getLevels: () => levels.map((l) => ({ ...l })),
  getZones: () => zones.map(publicZone),

  getOccupancy(kind, query = {}, nowMs = Date.now()) {
    if (!['zone', 'level'].includes(kind)) throw new HttpError(404, 'Unknown occupancy resource');
    if (query.tenant_id !== undefined && (typeof query.tenant_id !== 'string' || !UUID.test(query.tenant_id) || query.tenant_id !== TENANT_ID)) {
      throw new HttpError(422, 'tenant_id must match this mock tenant');
    }
    const requestedIds = parseIds(query[`${kind}_ids`], kind);
    const assets = (kind === 'zone' ? zones : levels).filter((asset) => !requestedIds || requestedIds.has(asset.id));
    const options = parseOccupancyQuery(query, kind, nowMs, assets.length);
    const results = [];
    for (let ms = options.start; ms < options.end; ms += options.step) {
      const until = Math.min(ms + options.step, options.end);
      for (const asset of assets) results.push(observation(kind, asset, ms, until));
    }
    return {
      meta: {
        source: 'faux-lambent', simulated: true, tenant_id: TENANT_ID,
        resolution: options.resolution, start: asIso(options.start),
        end: asIso(options.end), available_through: asIso(options.availableThrough),
        row_count: results.length,
      },
      results,
    };
  },
};
