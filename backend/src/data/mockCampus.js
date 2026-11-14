/**
 * Made-up study zones and capacities attached to real UTK building names.
 * These records are NOT an export from Lambent or UT Knoxville.
 * IDs are stable mock UUIDs, so frontend fixtures can reference them safely.
 */
const R = '99999999-9999-4999-8999-999999999999';
const H = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const S = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const Z = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const H1 = '11111111-1111-4111-8111-111111111111';
const H2 = '22222222-2222-4222-8222-222222222222';
const S1 = '33333333-3333-4333-8333-333333333333';
const Z1 = '44444444-4444-4444-8444-444444444444';
const Z2 = '55555555-5555-4555-8555-555555555555';

export const regions = [
  { id: R, name: 'UT Knoxville Campus' },
];

export const buildings = [
  { id: H, regionId: R, name: 'John C. Hodges Library' },
  { id: S, regionId: R, name: 'Student Union' },
  { id: Z, regionId: R, name: 'Zeanah Engineering Complex' },
];

export const levels = [
  { id: H1, buildingId: H, name: 'Level 1', floorNumber: 1, capacity: 130 },
  { id: H2, buildingId: H, name: 'Level 2', floorNumber: 2, capacity: 130 },
  { id: S1, buildingId: S, name: 'Level 1', floorNumber: 1, capacity: 150 },
  { id: Z1, buildingId: Z, name: 'Level 1', floorNumber: 1, capacity: 110 },
  { id: Z2, buildingId: Z, name: 'Level 2', floorNumber: 2, capacity: 80 },
];

export const zones = [
  { id: 'a1b2c3d4-1111-4111-8111-111111111111', levelId: H1, name: 'Main Study Area', capacity: 80, mockProfile: 1.00 },
  { id: 'a1b2c3d4-2222-4222-8222-222222222222', levelId: H1, name: 'Computer Area', capacity: 50, mockProfile: 0.84 },
  { id: 'a1b2c3d4-3333-4333-8333-333333333333', levelId: H2, name: 'Quiet Study Area', capacity: 70, mockProfile: 0.91 },
  { id: 'a1b2c3d4-7777-4777-8777-777777777777', levelId: H2, name: 'Group Study Area', capacity: 60, mockProfile: 0.79 },
  { id: 'a1b2c3d4-4444-4444-8444-444444444444', levelId: S1, name: 'Student Lounge', capacity: null, mockReferencePopulation: 75, mockProfile: 1.12 },
  { id: 'a1b2c3d4-8888-4888-8888-888888888888', levelId: S1, name: 'Collaborative Seating', capacity: 65, mockProfile: 0.95 },
  { id: 'a1b2c3d4-5555-4555-8555-555555555555', levelId: Z1, name: 'Engineering Collaboration Area', capacity: 60, mockProfile: 0.91 },
  { id: 'a1b2c3d4-9999-4999-8999-999999999999', levelId: Z1, name: 'Common Study Tables', capacity: 50, mockProfile: 0.83 },
  { id: 'a1b2c3d4-6666-4666-8666-666666666666', levelId: Z2, name: 'Engineering Study Area', capacity: 80, mockProfile: 0.87 },
];

// Return public catalog fields only: exclude simulation-only knobs.
export const publicZone = ({ id, levelId, name, capacity }) => ({ id, levelId, name, capacity });
