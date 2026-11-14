import { Router } from 'express';
import { listStudySpaces, getStudySpaceHistory } from '../services/studySpaceService.js';
import { HttpError } from '../utils/httpErrors.js';
const router = Router();

router.get('/', (req, res) => {
  const { buildingId, levelId, status } = req.query;
  if (status && !['low', 'moderate', 'high', 'unknown'].includes(status)) {
    throw new HttpError(422, 'status must be low, moderate, high, or unknown');
  }
  res.json({ source: 'simulation', simulated: true, results: listStudySpaces({ buildingId, levelId, statusFilter: status }) });
});

router.get('/:id/history', (req, res) => {
  const hours = req.query.hours === undefined ? 12 : Number(req.query.hours);
  res.json(getStudySpaceHistory(req.params.id, hours));
});

export default router;
