import test from 'node:test';
import assert from 'node:assert/strict';
import { mockLambentProvider as provider } from '../src/providers/mockLambentProvider.js';
import { listStudySpaces, getBuildingOccupancy, getStudySpaceHistory } from '../src/services/studySpaceService.js';

const now = Date.parse('2026-11-13T20:00:00Z');
const query = { start: '2026-11-13T15:00:00Z', end: '2026-11-13T16:00:00Z', resolution: '30m' };

test('every zone belongs to an existing level, which belongs to a building', () => {
  const buildings = new Map(provider.getBuildings().map((x) => [x.id, x]));
  const levels = new Map(provider.getLevels().map((x) => [x.id, x]));
  for (const z of provider.getZones()) assert.ok(buildings.has(levels.get(z.levelId)?.buildingId));
});

test('identical zone query returns identical seeded data', () => {
  assert.deepEqual(provider.getOccupancy('zone', query, now), provider.getOccupancy('zone', query, now));
});

test('time series includes one row per zone per 30-minute bucket', () => {
  const { results } = provider.getOccupancy('zone', query, now);
  assert.equal(results.length, provider.getZones().length * 2);
  assert.equal(results[0].start_timestamp, '2026-11-13T15:00:00.000Z');
  assert.equal(results[0].end_timestamp, '2026-11-13T15:30:00.000Z');
  for (const row of results) {
    assert.ok(row.mean_occupancy <= row.peak_occupancy);
    if (row.mean_utilization !== null) assert.ok(row.mean_utilization >= 0);
  }
});

test('capacity null leads to utilization null', () => {
  const id = provider.getZones().find((z) => z.capacity === null).id;
  const row = provider.getOccupancy('zone', { ...query, zone_ids: id }, now).results[0];
  assert.equal(row.mean_utilization, null);
  assert.equal(row.peak_utilization, null);
  assert.ok(Number.isInteger(row.mean_occupancy));
});

test('snapshot is joined to building and level and labeled simulated', () => {
  const results = listStudySpaces({}, now);
  assert.equal(results.length, provider.getZones().length);
  assert.ok(results.every((x) => x.buildingId && x.levelId && x.dataSource === 'simulation'));
  const building = getBuildingOccupancy(provider.getBuildings()[0].id, now);
  assert.ok(building.occupancy !== null);
  assert.equal(building.dataSource, 'simulation');
});

test('no future or latest 30-minute data is fabricated', () => {
  const data = provider.getOccupancy('zone', { start: '-2h', end: 'now', resolution: '30m' }, now);
  assert.ok(data.results.every((r) => Date.parse(r.end_timestamp) <= now - 30 * 60_000));
});

test('zone history returns requested number of 30-minute buckets', () => {
  const zoneId = provider.getZones()[0].id;
  const history = getStudySpaceHistory(zoneId, 12, now);
  assert.equal(history.results.length, 24);
});

test('bad resolution is rejected', () => {
  assert.throws(() => provider.getOccupancy('zone', { ...query, resolution: '1d' }, now), /resolution/);
});
