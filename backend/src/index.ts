import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import portfolioRoutes from './routes/portfolio.routes';
import taxRoutes from './routes/tax.routes';
import { NAVRefreshJob } from './jobs/nav-refresh.job';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/portfolio', portfolioRoutes);
app.use('/api/tax', taxRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

NAVRefreshJob.start();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
