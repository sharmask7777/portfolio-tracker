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

    it('should resolve and aggregate stock exposures for mutual funds with real and synthetic ISINs', async () => {
      // Create or find mutual fund with real ISIN
      const mfAsset = await prisma.asset.upsert({
        where: { isin: 'INF879O01027' },
        update: {},
        create: {
          type: 'MUTUAL_FUND',
          name: 'Parag Parikh Flexi Cap Fund - Direct Plan Growth',
          isin: 'INF879O01027',
          amfiCode: '122639',
        },
      });

      // Create mutual fund with synthetic ISIN
      const synMfAsset = await prisma.asset.create({
        data: {
          type: 'MUTUAL_FUND',
          name: 'Axis Bluechip Fund - Direct Growth',
          isin: `MISSING-${Date.now()}`,
          amfiCode: null,
        },
      });

      const folio1 = await prisma.folio.create({
        data: {
          number: `FOLIO-MF-${Date.now()}`,
          portfolioId,
          assetId: mfAsset.id,
        },
      });

      const folio2 = await prisma.folio.create({
        data: {
          number: `FOLIO-SYN-${Date.now()}`,
          portfolioId,
          assetId: synMfAsset.id,
        },
      });

      await prisma.transaction.create({
        data: {
          folioId: folio1.id,
          date: new Date('2024-01-01'),
          type: 'PURCHASE',
          amount: 50000,
          units: 1000,
          nav: 50,
          balance: 1000,
        },
      });

      await prisma.transaction.create({
        data: {
          folioId: folio2.id,
          date: new Date('2024-01-01'),
          type: 'PURCHASE',
          amount: 50000,
          units: 1000,
          nav: 50,
          balance: 1000,
        },
      });

      const exposures = await OverlapService.getPortfolioExposures(portfolioId, userId);
      expect(exposures.length).toBeGreaterThan(0);
      expect(exposures[0].absoluteValue).toBeGreaterThan(0);
      expect(exposures[0].percentage).toBeGreaterThan(0);
      expect(exposures[0].percentage).toBeLessThanOrEqual(1);
      expect(exposures[0].contributions.length).toBeGreaterThanOrEqual(1);

      // Clean up test folios & assets
      await prisma.transaction.deleteMany({ where: { folio: { assetId: synMfAsset.id } } });
      await prisma.transaction.deleteMany({ where: { folioId: { in: [folio1.id, folio2.id] } } });
      await prisma.folio.deleteMany({ where: { assetId: synMfAsset.id } });
      await prisma.folio.deleteMany({ where: { id: { in: [folio1.id, folio2.id] } } });
      await prisma.asset.deleteMany({ where: { id: synMfAsset.id } });
      const remainingFolios = await prisma.folio.count({ where: { assetId: mfAsset.id } });
      if (remainingFolios === 0) {
        await prisma.asset.deleteMany({ where: { id: mfAsset.id } });
      }
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
