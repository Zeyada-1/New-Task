import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const passwordRules = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
];

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('username').trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/),
    ...passwordRules,
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, username, password } = req.body;

    try {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        return res.status(409).json({ error: 'email_taken', field: 'email' });
      }
      const usernameExists = await prisma.user.findUnique({ where: { username } });
      if (usernameExists) {
        return res.status(409).json({ error: 'username_taken', field: 'username' });
      }

      const hashed = await bcrypt.hash(password, 12);
      const emailVerifyToken = crypto.randomBytes(32).toString('hex');
      const emailVerifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const user = await prisma.user.create({
        data: { email, username, password: hashed, emailVerifyToken, emailVerifyTokenExpiry },
      });

      // Send verification email — don't fail registration if email fails
      sendVerificationEmail(email, emailVerifyToken).catch((err) => {
        console.error('[EMAIL] Failed to send verification email:', err.message);
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatar: user.avatar,
          emailVerified: false,
        },
        message: 'Account created! Check your email to verify your address.',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatar: user.avatar,
          emailVerified: user.emailVerified,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/auth/verify-email?token=...
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyTokenExpiry: { gt: new Date() },
      },
    });
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyTokenExpiry: null },
    });

    res.json({ message: 'Email verified successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/resend-verification (auth required)
router.post('/resend-verification', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email already verified' });

    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifyToken, emailVerifyTokenExpiry } });
    await sendVerificationEmail(user.email, emailVerifyToken);

    res.json({ message: 'Verification email sent!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      // Always respond with success to prevent email enumeration
      if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });

      sendPasswordResetEmail(email, resetToken).catch((err) => {
        console.error('[EMAIL] Failed to send reset email:', err.message);
      });

      res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  [body('token').notEmpty(), ...passwordRules],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { token, password } = req.body;

    try {
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: { gt: new Date() },
        },
      });
      if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });

      const hashed = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, resetToken: null, resetTokenExpiry: null },
      });

      res.json({ message: 'Password reset successfully!' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
