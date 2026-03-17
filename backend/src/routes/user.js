import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/user/me — user profile
router.get('/me', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      isPublic: user.isPublic,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/user/settings  — update account visibility and/or avatar
router.patch('/settings', async (req, res) => {
  try {
    const { isPublic, avatar } = req.body;
    const data = {};

    if (typeof isPublic === 'boolean') data.isPublic = isPublic;

    const VALID_AVATARS = ['warrior', 'mage', 'archer', 'rogue'];
    if (avatar !== undefined) {
      if (!VALID_AVATARS.includes(avatar)) {
        return res.status(400).json({ error: 'Invalid avatar' });
      }
      data.avatar = avatar;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data,
    });
    res.json({ isPublic: updated.isPublic, avatar: updated.avatar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
