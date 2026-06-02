import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { prisma } from '@src/services/db.service';

jest.mock('@src/services/db.service', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
  cleanupDatabase: jest.fn(),
}));

beforeEach(() => {
  mockReset(prismaMock);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
