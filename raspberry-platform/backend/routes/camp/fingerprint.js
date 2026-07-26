import express from 'express';
import { campDb as db } from '../../config/database.js';

const router = express.Router();

router.post('/scan', async (req, res) => {
  const random = Math.random();
  if (random < 0.7) {
    const person = db.prepare(
      'SELECT * FROM persons WHERE pre_registered = 1 ORDER BY RANDOM() LIMIT 1'
    ).get();
    if (person) return res.json({ matched: true, person });
  }
  return res.json({ matched: false });
});

export default router;
