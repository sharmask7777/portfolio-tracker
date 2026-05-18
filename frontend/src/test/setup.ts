import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Lucide icons or other globals if needed
vi.mock('lucide-react', () => ({
  User: () => 'UserIcon',
  Edit2: () => 'EditIcon',
  Users: () => 'UsersIcon',
  TrendingUp: () => 'TrendingUpIcon',
  TrendingDown: () => 'TrendingDownIcon',
  Wallet: () => 'WalletIcon',
  Briefcase: () => 'BriefcaseIcon',
  Calculator: () => 'CalculatorIcon',
}));
