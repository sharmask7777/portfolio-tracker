import { prisma } from './db.service';

export class FamilyService {
  /**
   * Creates a new family group and adds the owner as a member.
   */
  public static async createFamilyGroup(name: string, ownerId: string) {
    return prisma.$transaction(async (tx) => {
      const group = await tx.familyGroup.create({
        data: {
          name,
          ownerId,
        },
      });

      await tx.familyMember.create({
        data: {
          userId: ownerId,
          groupId: group.id,
          role: 'OWNER',
        },
      });

      return group;
    });
  }

  /**
   * Adds a user to an existing family group.
   */
  public static async addMember(groupId: string, email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('User not found with provided email');
    }

    return prisma.familyMember.create({
      data: {
        userId: user.id,
        groupId,
        role: 'MEMBER',
      },
    });
  }

  /**
   * Fetches all portfolios associated with a family group.
   */
  public static async getFamilyPortfolios(groupId: string) {
    const group = await prisma.familyGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              include: {
                portfolios: {
                  include: {
                    folios: {
                      include: {
                        asset: true,
                        transactions: { orderBy: { date: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!group) throw new Error('Family group not found');

    // Flatten all portfolios from all members
    return group.members.flatMap((m) => m.user.portfolios);
  }

  /**
   * Lists family groups for a specific user.
   */
  public static async getUserFamilies(userId: string) {
    return prisma.familyGroup.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }
}
