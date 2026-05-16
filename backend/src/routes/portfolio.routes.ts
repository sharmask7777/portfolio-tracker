import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ParserService } from '../services/parser.service';
import fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { password } = req.body;
    const filePath = req.file.path;

    const data = await ParserService.parseCAS(filePath, password);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.status(200).json(data);
  } catch (error: any) {
    // Clean up if error occurred
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
