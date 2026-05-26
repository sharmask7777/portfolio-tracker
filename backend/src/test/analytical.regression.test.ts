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
    let testAsset: any;

    beforeAll(async () => {
      testAsset = await prisma.asset.create({
        data: {
          type: 'MUTUAL_FUND',
          name: `Test Fund ${Date.now()}`,
          isin: `INF-${Date.now()}`,
          amfiCode: `AMFI-${Date.now()}`,
        }
      });
    });

    afterAll(async () => {
      if (testAsset) {
        await prisma.asset.delete({ where: { id: testAsset.id } });
      }
    });

    it('should list goals with metrics for consolidated scope', async () => {
      const goals = await GoalService.listGoals('consolidated', 1000000, userId);
      expect(Array.isArray(goals)).toBe(true);
    });

    it('should resolve consolidated scope and create a goal', async () => {
      const goal = await GoalService.createGoal(
        'consolidated',
        'Consolidated Goal',
        500000,
        new Date('2035-12-31'),
        userId,
        [testAsset.id]
      );
      expect(goal).toBeDefined();
      expect(goal.portfolioId).toBe(portfolioId); // Should resolve to user's first portfolio
      expect(goal.assets).toHaveLength(1);
      expect(goal.assets[0].id).toBe(testAsset.id);

      // Clean up goal
      await GoalService.deleteGoal(goal.id);
    });

    it('should resolve managed profile scope and create a goal', async () => {
      const goal = await GoalService.createGoal(
        profileId,
        'Profile Goal',
        300000,
        new Date('2040-12-31'),
        userId
      );
      expect(goal).toBeDefined();
      expect(goal.portfolioId).toBe(portfolioId); // Should resolve to profile's portfolio

      // Test list goals shows it
      const goals = await GoalService.listGoals(profileId, 100000, userId);
      const found = goals.find(g => g.id === goal.id);
      expect(found).toBeDefined();

      // Test update goal
      const updated = await GoalService.updateGoal(
        goal.id,
        'Updated Profile Goal',
        400000,
        new Date('2041-12-31'),
        [testAsset.id]
      );
      expect(updated.name).toBe('Updated Profile Goal');
      expect(updated.targetAmount).toBe(400000);
      expect(updated.assets).toHaveLength(1);

      // Clean up goal
      await GoalService.deleteGoal(goal.id);
    });
  });
});
