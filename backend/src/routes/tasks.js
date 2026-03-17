import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/tasks — list all tasks for current user
router.get('/', async (req, res) => {
  try {
    const { completed, priority, category, sort = 'createdAt', order = 'desc' } = req.query;
    const where = { userId: req.userId, parentId: null };
    if (completed !== undefined) where.completed = completed === 'true';
    if (priority) where.priority = priority.toUpperCase();
    if (category) where.category = category;

    const tasks = await prisma.task.findMany({
      where,
      include: { subtasks: { orderBy: { createdAt: 'asc' } } },
      orderBy: { [sort]: order },
    });
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/:id — get a single task with subtasks
router.get('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { subtasks: { orderBy: { createdAt: 'asc' } } },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks — create a task
router.post(
  '/',
  [
    body('title').trim().notEmpty().isLength({ max: 200 }),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('category').optional().trim().isLength({ max: 50 }),
    body('color').optional().isString().isLength({ max: 20 }),
    body('dueDate').optional().custom(v => !isNaN(Date.parse(v))).withMessage('Invalid date'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, priority = 'MEDIUM', category = 'General', color, dueDate } = req.body;

    try {
      const task = await prisma.task.create({
        data: {
          title,
          description,
          priority,
          category,
          color: color || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          userId: req.userId,
        },
        include: { subtasks: { orderBy: { createdAt: 'asc' } } },
      });
      res.status(201).json(task);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PATCH /api/tasks/:id — update a task
router.patch(
  '/:id',
  [
    body('title').optional().trim().notEmpty().isLength({ max: 200 }),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('category').optional().trim().isLength({ max: 50 }),
    body('color').optional().isString().isLength({ max: 20 }),
    body('dueDate').optional().custom(v => !isNaN(Date.parse(v))).withMessage('Invalid date'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId } });
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const updateData = {};
      const { title, description, priority, category, color, dueDate } = req.body;
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (priority !== undefined) updateData.priority = priority;
      if (category !== undefined) updateData.category = category;
      if (color !== undefined) updateData.color = color || null;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

      const updated = await prisma.task.update({
        where: { id: req.params.id },
        data: updateData,
        include: { subtasks: { orderBy: { createdAt: 'asc' } } },
      });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PATCH /api/tasks/:id/complete — mark task as complete
router.patch('/:id/complete', async (req, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.completed) return res.status(400).json({ error: 'Task already completed' });

    const completedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: { completed: true, completedAt: new Date() },
    });

    res.json({ task: completedTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tasks/:id/uncomplete — undo completion
router.patch('/:id/uncomplete', async (req, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.completed) return res.status(400).json({ error: 'Task is not completed' });

    await prisma.task.update({ where: { id: req.params.id }, data: { completed: false, completedAt: null } });

    res.json({ message: 'Task uncompleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id — delete a task
router.delete('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
