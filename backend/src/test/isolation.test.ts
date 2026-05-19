import request from 'supertest';
import { app } from '../index';
import { prisma, cleanupDatabase } from '../services/db.service';
import { AuthService } from '../services/authService';
import { CacheService } from '../services/cache.service';

describe('Data Isolation', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let portfolioA: any;

  beforeAll(async () => {
    // Create User A
    userA = await prisma.user.create({
      data: {
        email: `usera-${Date.now()}@example.com`,
        password: await AuthService.hashPassword('password'),
      },
    });
    tokenA = AuthService.generateToken({ id: userA.id, email: userA.email });

    // Create User B
    userB = await prisma.user.create({
      data: {
        email: `userb-${Date.now()}@example.com`,
        password: await AuthService.hashPassword('password'),
      },
    });
    tokenB = AuthService.generateToken({ id: userB.id, email: userB.email });

    // Create a portfolio for User A
    portfolioA = await prisma.portfolio.create({
      data: {
        name: 'User A Portfolio',
        userId: userA.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.portfolio.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await CacheService.disconnect();
    await cleanupDatabase();
  });

  it('User B should not be able to see User A\'s portfolio exposures', async () => {
    const res = await request(app)
      .get(`/api/portfolio/${portfolioA.id}/exposures`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200); 
    expect(res.body).toEqual([]);
  });

  it('User B should not be able to see User A\'s portfolio summary', async () => {
    const res = await request(app)
      .get('/api/portfolio/summary')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.folios).toHaveLength(0);
    expect(res.body.metrics.totalValue).toBe(0);
  });

  it('User B should not be able to purge User A\'s data', async () => {
    const res = await request(app)
      .delete('/api/portfolio/purge')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);

    // Verify User A's portfolio still exists
    const checkA = await prisma.portfolio.findUnique({ where: { id: portfolioA.id } });
    expect(checkA).not.toBeNull();
  });
});
