import { Router } from 'express';
import { mockLambentProvider as provider } from '../providers/mockLambentProvider.js';
const router = Router();

// Deliberately NOT the official Lambent API host or an exact JSON-schema clone.
router.get('/zone', (req, res) => res.json(provider.getOccupancy('zone', req.query)));
router.get('/level', (req, res) => res.json(provider.getOccupancy('level', req.query)));

export default router;
