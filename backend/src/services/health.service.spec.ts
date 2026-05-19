import { HealthService } from './health.service';
import { XRayService } from './xray.service';
import { OverlapService } from './overlap.service';
import { GoalService } from './goal.service';

jest.mock('./xray.service');
jest.mock('./overlap.service');
jest.mock('./goal.service');

describe('HealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (GoalService.listGoals as jest.Mock).mockResolvedValue([]);
  });

  it('should detect high sector concentration risk', async () => {
    (XRayService.getXRayData as jest.Mock).mockResolvedValue({
      sectors: [{ name: 'Banking', percentage: 0.5, value: 5000 }],
      assetAllocation: { equity: { percentage: 0.9 } },
    });
    (OverlapService.getPortfolioExposures as jest.Mock).mockResolvedValue([]);

    const insights = await HealthService.getPortfolioHealth('p1', 'u1');
    const concentration = insights.find((i) => i.type === 'CONCENTRATION');
    
    expect(concentration).toBeDefined();
    expect(concentration?.severity).toBe('HIGH');
  });

  it('should detect high stock overlap risk', async () => {
    (XRayService.getXRayData as jest.Mock).mockResolvedValue({
      sectors: [],
      assetAllocation: { equity: { percentage: 0.5 } },
    });
    (OverlapService.getPortfolioExposures as jest.Mock).mockResolvedValue([
      { name: 'HDFC Bank', percentage: 0.2, contributions: [1, 2, 3] },
    ]);

    const insights = await HealthService.getPortfolioHealth('p1', 'u1');
    const overlap = insights.find((i) => i.type === 'OVERLAP');
    
    expect(overlap).toBeDefined();
    expect(overlap?.severity).toBe('HIGH');
  });
});
