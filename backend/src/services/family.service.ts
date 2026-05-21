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

  /**
   * Creates a new managed profile for a family member.
   */
  public static async createManagedProfile(userId: string, pan: string, name: string) {
    return prisma.managedProfile.create({
      data: {
        userId,
        pan,
        name,
      },
    });
  }

  /**
   * Fetches all managed profiles for a user.
   */
  public static async getManagedProfiles(userId: string) {
    return prisma.managedProfile.findMany({
      where: { userId },
      include: {
        portfolios: true,
      },
    });
  }

  /**
   * Updates the name of a managed profile.
   */
  public static async updateManagedProfileName(userId: string, profileId: string, name: string) {
    const profile = await prisma.managedProfile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new Error('Profile not found or unauthorized');
    }

    return prisma.managedProfile.update({
      where: { id: profileId },
      data: { name },
    });
  }

  /**
   * Updates the tax slab of a managed profile.
   */
  public static async updateManagedProfileTaxSlab(userId: string, profileId: string, taxSlab: number) {
    const profile = await prisma.managedProfile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new Error('Profile not found or unauthorized');
    }

    return prisma.managedProfile.update({
      where: { id: profileId },
      data: { taxSlab },
    });
  }

  /**
   * Gets a managed profile by PAN, or creates one if it doesn't exist.
   */
  public static async getOrCreateManagedProfile(userId: string, pan: string) {
    const existing = await prisma.managedProfile.findUnique({
      where: {
        userId_pan: { userId, pan },
      },
    });

    if (existing) return existing;

    return prisma.managedProfile.create({
      data: {
        userId,
        pan,
        name: pan, // Default to PAN if name unknown
      },
    });
  }
}
