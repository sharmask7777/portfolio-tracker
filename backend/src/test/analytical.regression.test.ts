import { XRayService } from '../services/xray.service';
import { OverlapService } from '../services/overlap.service';
import { HealthService } from '../services/health.service';
import { GoalService } from '../services/goal.service';
import { prisma, cleanupDatabase } from '../services/db.service';
import { AuthService } from '../services/authService';

describe('Analytical Services Regression Suite', () => {
  let userId: string;
  let profileId: string;
  let portfolioId: string;

  beforeAll(async () => {
    // Create a real test user
    const user = await prisma.user.create({
      data: {
        email: `regression-${Date.now()}@example.com`,
        password: await AuthService.hashPassword('password'),
      },
    });
    userId = user.id;

    // Create profile
    const profile = await prisma.managedProfile.create({
      data: {
        userId,
        name: 'Regression Profile',
        pan: `PAN${Date.now()}`.substring(0, 10),
      }
    });
    profileId = profile.id;

    // Create portfolio
    const portfolio = await prisma.portfolio.create({
      data: {
        userId,
        managedProfileId: profileId,
        name: 'Regression Portfolio',
      }
    });
    portfolioId = portfolio.id;
  });

  afterAll(async () => {
    await prisma.portfolio.deleteMany({ where: { userId } });
    await prisma.managedProfile.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await cleanupDatabase();
  });

  describe('X-Ray Service Scope Support', () => {
    it('should support consolidated scope', async () => {
      const data = await XRayService.getXRayData('consolidated', userId);
      expect(data).toBeDefined();
    });

    it('should support profile scope', async () => {
      const data = await XRayService.getXRayData(profileId, userId);
      expect(data).toBeDefined();
    });

    it('should support specific portfolio scope', async () => {
      const data = await XRayService.getXRayData(portfolioId, userId);
      expect(data).toBeDefined();
    });
  });

  describe('Stock Intersection Service Scope Support', () => {
    it('should support consolidated scope', async () => {
      const data = await OverlapService.getPortfolioExposures('consolidated', userId);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Health Service Scope Support', () => {
    it('should generate insights for consolidated scope', async () => {
      const insights = await HealthService.getPortfolioHealth('consolidated', userId);
      expect(Array.isArray(insights)).toBe(true);
    });
  });

  describe('Goal Service Scope Support', () => {
    it('should list goals with metrics for consolidated scope', async () => {
      const goals = await GoalService.listGoals('consolidated', 1000000, userId);
      expect(Array.isArray(goals)).toBe(true);
    });
  });
});
