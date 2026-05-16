import { Router, Request, Response } from 'express';
import { FamilyService } from '../services/family.service';

const router = Router();

router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, userId = 'mock-user-123' } = req.body;
    const group = await FamilyService.createFamilyGroup(name, userId);
    res.status(200).json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/add-member', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const membership = await FamilyService.addMember(id as string, email);
    res.status(200).json(membership);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/list', async (req: Request, res: Response) => {
  try {
    const { userId = 'mock-user-123' } = req.query;
    const families = await FamilyService.getUserFamilies(userId as string);
    res.status(200).json(families);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
