import { FamilyService } from '../services/family.service';
import { prisma } from '../services/db.service';

describe('FamilyService Managed Profiles', () => {
  let userId: string;

  beforeAll(async () => {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'password',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.managedProfile.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('should create a managed profile', async () => {
    const profile = await FamilyService.createManagedProfile(userId, 'ABCDE1234F', 'John Doe');
    expect(profile.name).toBe('John Doe');
    expect(profile.pan).toBe('ABCDE1234F');
    expect(profile.userId).toBe(userId);
  });

  it('should get managed profiles for a user', async () => {
    const profiles = await FamilyService.getManagedProfiles(userId);
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.find((p: any) => p.name === 'John Doe')).toBeDefined();
  });

  it('should update managed profile name', async () => {
    const profiles = await FamilyService.getManagedProfiles(userId);
    const profileId = profiles.find((p: any) => p.pan === 'ABCDE1234F')!.id;
    const updated = await FamilyService.updateManagedProfileName(userId, profileId, 'John Updated');
    expect(updated.name).toBe('John Updated');
  });

  it('should not update profile if user does not own it', async () => {
    const otherUser = await prisma.user.create({
      data: { email: `other-${Date.now()}@example.com`, password: 'password' }
    });
    const profiles = await FamilyService.getManagedProfiles(userId);
    const profileId = profiles[0].id;

    await expect(FamilyService.updateManagedProfileName(otherUser.id, profileId, 'Hack'))
      .rejects.toThrow('Profile not found or unauthorized');

    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it('should get or create managed profile', async () => {
    const pan = 'XYZ1234567';
    const profile = await FamilyService.getOrCreateManagedProfile(userId, pan);
    expect(profile.pan).toBe(pan);
    expect(profile.name).toBe(pan); // Default name is PAN if not provided

    const again = await FamilyService.getOrCreateManagedProfile(userId, pan);
    expect(again.id).toBe(profile.id);
  });
});
