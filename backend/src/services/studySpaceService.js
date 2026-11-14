import { mockLambentProvider as provider } from '../providers/mockLambentProvider.js';
import { notFound, HttpError } from '../utils/httpErrors.js';

function status(utilization) {
  if (utilization === null) return 'unknown';
  if (utilization < 0.4) return 'low';
  if (utilization < 0.75) return 'moderate';
  return 'high';
}

function occupancySnapshot(kind, nowMs = Date.now()) {
  const payload = provider.getOccupancy(kind, {
    start: '-1h', end: '-30min', resolution: '30m',
  }, nowMs);
  const last = new Map(payload.results.map((row) => [row[`${kind}_id`], row]));
  return { last, meta: payload.meta };
}

export function listStudySpaces({ buildingId, levelId, statusFilter } = {}, nowMs = Date.now()) {
  const buildings = new Map(provider.getBuildings().map((b) => [b.id, b]));
  const levels = new Map(provider.getLevels().map((l) => [l.id, l]));
  const snapshot = occupancySnapshot('zone', nowMs);

  return provider.getZones().flatMap((zone) => {
    const level = levels.get(zone.levelId);
    const building = buildings.get(level.buildingId);
    if (buildingId && building.id !== buildingId) return [];
    if (levelId && level.id !== levelId) return [];
    const observation = snapshot.last.get(zone.id);
    const occupancy = observation?.mean_occupancy ?? null;
    const utilization = observation?.mean_utilization ?? null;
    const availability = status(utilization);
    if (statusFilter && statusFilter !== availability) return [];

    return [{
      id: zone.id,
      name: zone.name,
      levelId: level.id,
      levelName: level.name,
      buildingId: building.id,
      buildingName: building.name,
      capacity: zone.capacity,
      occupancy,
      availableSeats: zone.capacity === null || occupancy === null ? null : Math.max(0, zone.capacity - occupancy),
      utilization,
      status: availability,
      asOf: observation?.end_timestamp ?? null,
      dataSource: 'simulation',
    }];
  });
}

export function getStudySpaceHistory(zoneId, hours = 12, nowMs = Date.now()) {
  if (!Number.isInteger(hours) || hours < 1 || hours > 48) {
    throw new HttpError(422, 'hours must be an integer from 1 through 48');
  }
  const zone = provider.getZones().find((z) => z.id === zoneId);
  if (!zone) throw notFound('Zone');
  const payload = provider.getOccupancy('zone', {
    zone_ids: zoneId,
    start: `-${hours + 0.5}h`,
    end: '-30min',
    resolution: '30m',
  }, nowMs);
  return { zone, ...payload };
}

export function getBuildingOccupancy(buildingId, nowMs = Date.now()) {
  const building = provider.getBuildings().find((b) => b.id === buildingId);
  if (!building) throw notFound('Building');
  const buildingLevels = provider.getLevels().filter((level) => level.buildingId === buildingId);
  const { last } = occupancySnapshot('level', nowMs);
  const observations = buildingLevels.map((level) => last.get(level.id)).filter(Boolean);
  const capacity = buildingLevels.every((l) => l.capacity !== null)
    ? buildingLevels.reduce((n, l) => n + l.capacity, 0)
    : null;
  const occupancy = observations.length === buildingLevels.length
    ? observations.reduce((n, o) => n + o.mean_occupancy, 0)
    : null;
  const utilization = capacity !== null && occupancy !== null
    ? Number((occupancy / capacity).toFixed(4)) : null;
  return {
    buildingId, buildingName: building.name,
    capacity, occupancy, utilization,
    availableSeats: capacity === null || occupancy === null ? null : Math.max(0, capacity - occupancy),
    status: status(utilization),
    asOf: observations[0]?.end_timestamp ?? null,
    dataSource: 'simulation',
    note: 'Aggregated level means; not a live headcount.',
  };
}
