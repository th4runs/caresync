import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : Object.assign(new Error('Only JPG, PNG or WebP images are allowed'), { status: 400 }), ok);
  },
});

const r = Router();
r.post('/', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image received' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

export default r;
