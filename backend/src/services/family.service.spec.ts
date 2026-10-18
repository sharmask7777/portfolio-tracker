import { FamilyService } from './family.service';
import { prisma } from './db.service';

jest.mock('./db.service', () => ({
  prisma: {
    $transaction: jest.fn((cb) => cb(prisma)),
    familyGroup: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    familyMember: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    managedProfile: {
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    transaction: {
      deleteMany: jest.fn(),
    },
    folio: {
      deleteMany: jest.fn(),
    },
    portfolioHistory: {
      deleteMany: jest.fn(),
    },
    goal: {
      deleteMany: jest.fn(),
    },
    portfolio: {
      deleteMany: jest.fn(),
    },
  },
}));

describe('FamilyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a family group and add owner', async () => {
    (prisma.familyGroup.create as jest.Mock).mockResolvedValue({ id: 'g1', name: 'Sharma Family' });
    
    const group = await FamilyService.createFamilyGroup('Sharma Family', 'u1');
    
    expect(prisma.familyGroup.create).toHaveBeenCalled();
    expect(prisma.familyMember.create).toHaveBeenCalledWith({
      data: { userId: 'u1', groupId: 'g1', role: 'OWNER' }
    });
    expect(group.id).toBe('g1');
  });

  it('should fetch all portfolios for a family group', async () => {
    (prisma.familyGroup.findUnique as jest.Mock).mockResolvedValue({
      id: 'g1',
      members: [
        { user: { portfolios: [{ id: 'p1', folios: [] }] } },
        { user: { portfolios: [{ id: 'p2', folios: [] }] } },
      ],
    });

    const portfolios = await FamilyService.getFamilyPortfolios('g1');
    expect(portfolios.length).toBe(2);
    expect(portfolios[0].id).toBe('p1');
    expect(portfolios[1].id).toBe('p2');
  });

  it('should delete a managed profile and associated portfolios and folios', async () => {
    (prisma.managedProfile.findFirst as jest.Mock).mockResolvedValue({
      id: 'mp1',
      userId: 'u1',
      portfolios: [
        {
          id: 'p1',
          folios: [{ id: 'f1' }, { id: 'f2' }],
        },
      ],
    });
    (prisma.managedProfile.delete as jest.Mock).mockResolvedValue({ id: 'mp1' });

    const result = await FamilyService.deleteManagedProfile('u1', 'mp1');

    expect(prisma.managedProfile.findFirst).toHaveBeenCalledWith({
      where: { id: 'mp1', userId: 'u1' },
      include: { portfolios: { include: { folios: true } } },
    });
    expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
      where: { folioId: { in: ['f1', 'f2'] } },
    });
    expect(prisma.folio.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['f1', 'f2'] } },
    });
    expect(prisma.portfolio.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1'] } },
    });
    expect(prisma.managedProfile.delete).toHaveBeenCalledWith({
      where: { id: 'mp1' },
    });
    expect(result.id).toBe('mp1');
  });

  it('should throw error when deleting profile that does not exist or belong to user', async () => {
    (prisma.managedProfile.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(FamilyService.deleteManagedProfile('u1', 'mp-nonexistent'))
      .rejects.toThrow('Profile not found or unauthorized');
  });
});
