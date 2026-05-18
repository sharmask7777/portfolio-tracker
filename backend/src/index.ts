import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import portfolioRoutes from './routes/portfolio.routes';
import taxRoutes from './routes/tax.routes';
import familyRoutes from './routes/family.routes';
import healthRoutes from './routes/health.routes';
import { NAVRefreshJob } from './jobs/nav-refresh.job';
import { HistoryRefreshJob } from './jobs/history-refresh.job';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/portfolio', portfolioRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/health', healthRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

NAVRefreshJob.start();
HistoryRefreshJob.start();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
