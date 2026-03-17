import nodemailer from 'nodemailer';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const FROM = process.env.SMTP_FROM || '"Orbit" <no-reply@orbit.app>';

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: parseInt(SMTP_PORT || '587') === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function emailWrapper(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffbf7;border-radius:16px;border:1px solid #fed7aa;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#ea580c 0%,#c2410c 100%);padding:28px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:50%;text-align:center;vertical-align:middle;font-size:18px;">🪐</td>
                <td style="padding-left:12px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Orbit</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #fed7aa;">
            <p style="margin:0;font-size:12px;color:#a8a29e;text-align:center;">You received this email because an action was taken on your Orbit account.<br>If this wasn't you, you can safely ignore this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(to, token) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  const transporter = createTransporter();
  if (!transporter) {
    // Dev fallback: log a truncated token so the full secret isn't in logs
    console.log(`[EMAIL] Verification link for ${to} (token: ${token.slice(0, 8)}...)`);
    return;
  }
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1c1917;">Verify your email</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">You're almost in — just click the button below to confirm your email address and activate your Orbit account.</p>
    <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#ea580c,#c2410c);color:#ffffff;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.1px;">Verify Email Address</a>
    <p style="margin:24px 0 0;font-size:13px;color:#a8a29e;">This link expires in <strong style="color:#78716c;">24 hours</strong>. If you didn't create an account, you can ignore this email.</p>
  `;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verify your Orbit email address',
    html: emailWrapper(content),
  });
}

export async function sendPasswordResetEmail(to, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const transporter = createTransporter();
  if (!transporter) {
    // Dev fallback: log a truncated token so the full secret isn't in logs
    console.log(`[EMAIL] Password reset link for ${to} (token: ${token.slice(0, 8)}...)`);
    return;
  }
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1c1917;">Reset your password</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">We received a request to reset your password. Click the button below to choose a new one.</p>
    <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#ea580c,#c2410c);color:#ffffff;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.1px;">Reset Password</a>
    <p style="margin:24px 0 0;font-size:13px;color:#a8a29e;">This link expires in <strong style="color:#78716c;">1 hour</strong>. If you didn't request a reset, your password will remain unchanged.</p>
  `;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your Orbit password',
    html: emailWrapper(content),
  });
}
