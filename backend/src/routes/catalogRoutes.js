import { Router } from 'express';
import { mockLambentProvider as provider } from '../providers/mockLambentProvider.js';
import { notFound } from '../utils/httpErrors.js';
import { getBuildingOccupancy } from '../services/studySpaceService.js';

const router = Router();

router.get('/regions', (req, res) => res.json(provider.getRegions()));
router.get('/regions/:id/buildings', (req, res) => {
  if (!provider.getRegions().some((r) => r.id === req.params.id)) throw notFound('Region');
  res.json(provider.getBuildings().filter((b) => b.regionId === req.params.id));
});
router.get('/buildings', (req, res) => {
  const results = provider.getBuildings();
  res.json(req.query.regionId ? results.filter((b) => b.regionId === req.query.regionId) : results);
});
router.get('/buildings/:id', (req, res) => {
  const found = provider.getBuildings().find((b) => b.id === req.params.id);
  if (!found) throw notFound('Building');
  res.json(found);
});
router.get('/buildings/:id/levels', (req, res) => {
  if (!provider.getBuildings().some((b) => b.id === req.params.id)) throw notFound('Building');
  res.json(provider.getLevels().filter((l) => l.buildingId === req.params.id));
});
router.get('/buildings/:id/zones', (req, res) => {
  if (!provider.getBuildings().some((b) => b.id === req.params.id)) throw notFound('Building');
  const levelIds = new Set(provider.getLevels().filter((l) => l.buildingId === req.params.id).map((l) => l.id));
  res.json(provider.getZones().filter((z) => levelIds.has(z.levelId)));
});
router.get('/buildings/:id/occupancy', (req, res) => {
  res.json(getBuildingOccupancy(req.params.id));
});
router.get('/levels', (req, res) => {
  const results = provider.getLevels();
  res.json(req.query.buildingId ? results.filter((l) => l.buildingId === req.query.buildingId) : results);
});
router.get('/levels/:id/zones', (req, res) => {
  if (!provider.getLevels().some((l) => l.id === req.params.id)) throw notFound('Level');
  res.json(provider.getZones().filter((z) => z.levelId === req.params.id));
});
router.get('/zones', (req, res) => {
  const results = provider.getZones();
  res.json(req.query.levelId ? results.filter((z) => z.levelId === req.query.levelId) : results);
});
router.get('/zones/:id', (req, res) => {
  const found = provider.getZones().find((z) => z.id === req.params.id);
  if (!found) throw notFound('Zone');
  res.json(found);
});

export default router;
