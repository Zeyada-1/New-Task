import 'dotenv/config';
import jwt from 'jsonwebtoken';
import prisma from './src/lib/prisma.js';

const email = 'ahmedzeyada2004@gmail.com';
try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.log('User not found'); process.exit(0); }
  console.log('User found:', user.id, user.username);
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  console.log('Token generated OK, length:', token.length);
  console.log('LOGIN WOULD SUCCEED');
} catch(e) {
  console.error('ERROR:', e.message);
  console.error(e.stack);
} finally {
  process.exit(0);
}
