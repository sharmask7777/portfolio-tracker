import { Router, Request, Response } from 'express';
import { FamilyService } from '../services/family.service';
import { prisma } from '../services/db.service';

const router = Router();

/**
 * Lists all managed profiles for the current user.
 */
router.get('/profiles', async (req: Request, res: Response) => {
  try {
    const { userId = 'mock-user-123' } = req.query;
    const profiles = await FamilyService.getManagedProfiles(userId as string);
    res.status(200).json(profiles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Renames a managed profile.
 */
router.patch('/profile/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, userId = 'mock-user-123' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Verify ownership and update
    const updated = await FamilyService.updateManagedProfileName(userId as string, id as string, name as string);
    res.status(200).json(updated);
  } catch (error: any) {
    if (error.message.includes('unauthorized') || error.message.includes('not found')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
