import express from 'express';
import cors from 'cors';
import catalogRoutes from './routes/catalogRoutes.js';
import lambentRoutes from './routes/lambentRoutes.js';
import studySpaceRoutes from './routes/studySpaceRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? ['http://localhost:5173'];
app.use(cors({ origin: allowedOrigins, exposedHeaders: ['X-Data-Source'] }));
app.use((req, res, next) => {
  res.set('X-Data-Source', 'faux-lambent-simulation');
  next();
});
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ status: 'ok', source: 'faux-lambent', simulated: true }));
app.use('/api', catalogRoutes);
app.use('/api/study-spaces', studySpaceRoutes);
app.use('/api/lambent/occupancy', lambentRoutes);
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use(errorHandler);
export default app;
