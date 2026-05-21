import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import portfolioRoutes from './routes/portfolio.routes';
import taxRoutes from './routes/tax.routes';
import familyRoutes from './routes/family.routes';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/authRoutes';
import { NAVRefreshJob } from './jobs/nav-refresh.job';
import { HistoryRefreshJob } from './jobs/history-refresh.job';

dotenv.config();

export const app = express();
const port = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/portfolio', portfolioRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

if (process.env.NODE_ENV !== 'test') {
  NAVRefreshJob.start();
  HistoryRefreshJob.start();

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
