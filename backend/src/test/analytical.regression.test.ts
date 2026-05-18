import { XRayService } from '../services/xray.service';
import { OverlapService } from '../services/overlap.service';
import { TaxService } from '../services/tax.service';
import { HealthService } from '../services/health.service';
import { GoalService } from '../services/goal.service';
import { prisma } from '../services/db.service';

describe('Analytical Services Regression Suite', () => {
  const mockUserId = 'mock-user-123';
  let profileId: string;
  let portfolioId: string;

  beforeAll(async () => {
    // Fetch real IDs from the database to ensure we're testing against the actual schema state
    const profile = await prisma.managedProfile.findFirst({
      where: { userId: mockUserId },
      include: { portfolios: true }
    });
    
    if (!profile || !profile.portfolios[0]) {
      throw new Error('Test setup failed: No mock data found in database. Run a CAS import first.');
    }

    profileId = profile.id;
    portfolioId = profile.portfolios[0].id;
  });

  describe('X-Ray Service Scope Support', () => {
    it('should support consolidated scope', async () => {
      const data = await XRayService.getXRayData('consolidated', mockUserId);
      expect(data).toBeDefined();
      expect(data.totalValue).toBeGreaterThan(0);
      expect(data.sectors.length).toBeGreaterThan(0);
    });

    it('should support profile scope', async () => {
      const data = await XRayService.getXRayData(profileId, mockUserId);
      expect(data).toBeDefined();
      expect(data.totalValue).toBeGreaterThan(0);
    });

    it('should support specific portfolio scope', async () => {
      const data = await XRayService.getXRayData(portfolioId, mockUserId);
      expect(data).toBeDefined();
      expect(data.totalValue).toBeGreaterThan(0);
    });
  });

  describe('Stock Intersection Service Scope Support', () => {
    it('should support consolidated scope', async () => {
      const data = await OverlapService.getPortfolioExposures('consolidated', mockUserId);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('contributions');
    });
  });

  describe('Health Service Scope Support', () => {
    it('should generate insights for consolidated scope', async () => {
      const insights = await HealthService.getPortfolioHealth('consolidated', mockUserId);
      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
    });
  });

  describe('Goal Service Scope Support', () => {
    it('should list goals with metrics for consolidated scope', async () => {
      const goals = await GoalService.listGoals('consolidated', 1000000, mockUserId);
      expect(Array.isArray(goals)).toBe(true);
      if (goals.length > 0) {
        expect(goals[0]).toHaveProperty('metrics');
        expect(goals[0].metrics).toHaveProperty('progressPercentage');
      }
    });
  });
});
