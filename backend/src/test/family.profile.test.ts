import { FamilyService } from '../services/family.service';
import { prisma, cleanupDatabase } from '../services/db.service';

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
    await cleanupDatabase();
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

  it('should update managed profile tax slab', async () => {
    const profiles = await FamilyService.getManagedProfiles(userId);
    const profileId = profiles.find((p: any) => p.pan === 'ABCDE1234F')!.id;
    const updated = await FamilyService.updateManagedProfileTaxSlab(userId, profileId, 0.2);
    expect(updated.taxSlab).toBe(0.2);
  });

  it('should not update tax slab if user does not own it', async () => {
    const otherUser = await prisma.user.create({
      data: { email: `other-tax-${Date.now()}@example.com`, password: 'password' }
    });
    const profiles = await FamilyService.getManagedProfiles(userId);
    const profileId = profiles[0].id;

    await expect(FamilyService.updateManagedProfileTaxSlab(otherUser.id, profileId, 0.1))
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

  it('should delete managed profile and associated portfolios and folios', async () => {
    const profile = await FamilyService.createManagedProfile(userId, 'DELPAN1234', 'To Delete');
    const portfolio = await prisma.portfolio.create({
      data: {
        name: 'Portfolio to Delete',
        userId,
        managedProfileId: profile.id,
      },
    });
    const asset = await prisma.asset.create({
      data: {
        type: 'MUTUAL_FUND',
        name: 'Asset to Delete',
        isin: `DEL_ISIN_${Date.now()}`,
      },
    });
    const folio = await prisma.folio.create({
      data: {
        number: `FOLIO_DEL_${Date.now()}`,
        portfolioId: portfolio.id,
        assetId: asset.id,
        pan: 'DELPAN1234',
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(),
        type: 'PURCHASE',
        amount: 1000,
        units: 100,
        nav: 10,
        balance: 100,
        folioId: folio.id,
      },
    });

    // Attempt delete with unauthorized user
    const otherUser = await prisma.user.create({
      data: { email: `other-del-${Date.now()}@example.com`, password: 'password' },
    });
    await expect(FamilyService.deleteManagedProfile(otherUser.id, profile.id))
      .rejects.toThrow('Profile not found or unauthorized');
    await prisma.user.delete({ where: { id: otherUser.id } });

    // Authorized delete
    await FamilyService.deleteManagedProfile(userId, profile.id);

    // Verify profile, portfolio, and folio are gone
    const deletedProfile = await prisma.managedProfile.findUnique({ where: { id: profile.id } });
    expect(deletedProfile).toBeNull();
    const deletedPortfolio = await prisma.portfolio.findUnique({ where: { id: portfolio.id } });
    expect(deletedPortfolio).toBeNull();
    const deletedFolio = await prisma.folio.findUnique({ where: { id: folio.id } });
    expect(deletedFolio).toBeNull();

    // Clean up asset
    await prisma.asset.delete({ where: { id: asset.id } });
  });
});
