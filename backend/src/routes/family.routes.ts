import { Router, Request, Response } from 'express';
import { FamilyService } from '../services/family.service';
import { authMiddleware } from '../middleware/authMiddleware';
import { prisma } from '../services/db.service';

const router = Router();

router.use(authMiddleware);

/**
 * Lists all managed profiles for the current user.
 */
router.get('/profiles', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const profiles = await FamilyService.getManagedProfiles(userId);
    res.status(200).json(profiles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Updates a managed profile (name and/or taxSlab).
 */
router.patch('/profile/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, taxSlab } = req.body;

    // Verify ownership
    const profile = await prisma.managedProfile.findFirst({
      where: { id: id as string, userId },
    });

    if (!profile) {
      return res.status(403).json({ error: 'Profile not found or unauthorized' });
    }

    const data: any = {};
    if (name) data.name = name;
    if (typeof taxSlab === 'number') data.taxSlab = taxSlab;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
    }

    const updated = await prisma.managedProfile.update({
      where: { id: id as string },
      data,
    });

    res.status(200).json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
