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
    }
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
});
