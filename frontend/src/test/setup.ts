import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Lucide icons or other globals if needed
vi.mock('lucide-react', () => {
  const Icon = () => null;
  return {
    User: Icon,
    Edit2: Icon,
    Users: Icon,
    TrendingUp: Icon,
    TrendingDown: Icon,
    Wallet: Icon,
    Briefcase: Icon,
    Calculator: Icon,
    Download: Icon,
    X: Icon,
    AlertCircle: Icon,
    Info: Icon,
    Target: Icon,
    Plus: Icon,
    Calendar: Icon,
    Edit: Icon,
    Trash2: Icon,
    Check: Icon,
    Lightbulb: Icon,
    AlertTriangle: Icon,
    CheckCircle: Icon,
    LayoutDashboard: Icon,
    Mail: Icon,
    Lock: Icon,
    Loader2: Icon,
    PieChart: Icon,
    Layers: Icon,
    ShieldCheck: Icon,
    BrainCircuit: Icon,
    Sun: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
    ArrowUpDown: Icon,
    Search: Icon,
    Upload: Icon,
    Trophy: Icon,
    RefreshCw: Icon,
  };
});


