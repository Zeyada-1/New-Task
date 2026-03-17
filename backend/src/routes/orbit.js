import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/orbit — all orbit groups (top-level tasks + their subtasks + subtasks of subtasks)
router.get('/', async (req, res) => {
  try {
    const orbits = await prisma.task.findMany({
      where: { userId: req.userId, parentId: null },
      include: {
        subtasks: {
          orderBy: { createdAt: 'asc' },
          include: {
            subtasks: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orbits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orbit — create a new orbit (center sphere task)
router.post(
  '/',
  [body('title').trim().notEmpty().isLength({ max: 200 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const orbit = await prisma.task.create({
        data: { title: req.body.title.trim(), userId: req.userId },
        include: { subtasks: true },
      });
      res.status(201).json(orbit);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /api/orbit/:id/subtasks — add a subtask to an orbit
router.post(
  '/:id/subtasks',
  [
    body('title').trim().notEmpty().isLength({ max: 200 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('category').optional().trim().isLength({ max: 50 }),
    body('color').optional().isHexColor(),
    body('dueDate').optional().isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const parent = await prisma.task.findFirst({
        where: { id: req.params.id, userId: req.userId },
      });
      if (!parent) return res.status(404).json({ error: 'Task not found' });

      const { title, description, priority, category, color, dueDate } = req.body;
      const subtask = await prisma.task.create({
        data: {
          title: title.trim(),
          userId: req.userId,
          parentId: req.params.id,
          ...(description && { description: description.trim() }),
          ...(priority && { priority }),
          ...(category && { category }),
          ...(color && { color }),
          ...(dueDate && { dueDate: new Date(dueDate) }),
        },
      });
      // When a new subtask is added, parent is no longer auto-complete
      if (parent.completed) {
        await prisma.task.update({ where: { id: parent.id }, data: { completed: false, completedAt: null } });
      }
      res.status(201).json(subtask);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PATCH /api/orbit/subtasks/:id/toggle — toggle subtask completion + bubble up to ancestors
router.patch('/subtasks/:id/toggle', async (req, res) => {
  try {
    const subtask = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!subtask?.parentId) return res.status(404).json({ error: 'Subtask not found' });

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        completed: !subtask.completed,
        completedAt: !subtask.completed ? new Date() : null,
      },
    });

    // Walk up parent chain and re-evaluate completion at each level
    let currentParentId = subtask.parentId;
    while (currentParentId) {
      const children = await prisma.task.findMany({ where: { parentId: currentParentId } });
      const allDone = children.every(c => (c.id === updated.id ? updated.completed : c.completed));
      const parent = await prisma.task.update({
        where: { id: currentParentId },
        data: { completed: allDone, completedAt: allDone ? new Date() : null },
      });
      currentParentId = parent.parentId;
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/orbit/subtasks/:id — delete a single subtask (MUST be before /:id)
router.delete('/subtasks/:id', async (req, res) => {
  try {
    const subtask = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!subtask?.parentId) return res.status(404).json({ error: 'Subtask not found' });

    await prisma.task.delete({ where: { id: req.params.id } });

    // Re-check parent completion after deletion
    const remaining = await prisma.task.findMany({ where: { parentId: subtask.parentId } });
    if (remaining.length > 0) {
      const allDone = remaining.every(s => s.completed);
      await prisma.task.update({
        where: { id: subtask.parentId },
        data: { completed: allDone, completedAt: allDone ? new Date() : null },
      });
    } else {
      // No subtasks left — mark parent as not complete
      await prisma.task.update({
        where: { id: subtask.parentId },
        data: { completed: false, completedAt: null },
      });
    }

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/orbit/:id — delete an orbit and cascade-delete all its subtasks
router.delete('/:id', async (req, res) => {
  try {
    const orbit = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.userId, parentId: null },
    });
    if (!orbit) return res.status(404).json({ error: 'Orbit not found' });

    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
