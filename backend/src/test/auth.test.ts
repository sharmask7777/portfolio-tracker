import request from 'supertest';
import { app } from '../index';
import { prisma, cleanupDatabase } from '../services/db.service';
import { AuthService } from '../services/authService';
import { CacheService } from '../services/cache.service';

describe('Authentication API', () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'Password123!',
  };

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-',
        },
      },
    });
    await CacheService.disconnect();
    await cleanupDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return a token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', testUser.email);
      expect(res.body.user).toHaveProperty('id');

      // Verify user was created in DB
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      expect(user).toBeDefined();
      expect(user?.password).not.toBe(testUser.password); // Should be hashed
    });

    it('should fail if email already exists', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('User already exists');
    });

    it('should fail if email or password missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'no-password@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login an existing user and return a token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(testUser);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should fail with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should fail with non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'password' });

      expect(res.status).toBe(401);
    });
  });

  describe('authMiddleware', () => {
    it('should allow access with valid token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send(testUser);
      
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('email', testUser.email);
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid token');
    });

    it('should fail with missing token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Missing or invalid token');
    });
  });
});
