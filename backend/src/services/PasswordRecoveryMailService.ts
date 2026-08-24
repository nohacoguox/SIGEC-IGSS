import nodemailer from 'nodemailer';

interface PasswordRecoveryEmailInput {
  recipient: string;
  recipientName: string;
  temporaryPassword: string;
}

function getMailTransporter() {
  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT || 587);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error('El servicio de correo no está disponible.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user, pass },
  });
}

export async function sendPasswordRecoveryEmail({
  recipient,
  recipientName,
  temporaryPassword,
}: PasswordRecoveryEmailInput): Promise<void> {
  const transporter = getMailTransporter();
  const sender = process.env.MAIL_FROM || process.env.MAIL_USER;

  await transporter.sendMail({
    from: sender,
    to: recipient,
    subject: 'SIGEC-IGSS — Contraseña temporal de recuperación',
    text: [
      `Estimado(a) ${recipientName}:`,
      '',
      'Se solicitó el restablecimiento de su contraseña en SIGEC-IGSS.',
      `Su contraseña temporal es: ${temporaryPassword}`,
      '',
      'Utilícela únicamente para iniciar sesión. El sistema le solicitará crear una nueva contraseña antes de permitirle acceder a los módulos institucionales.',
      'Si usted no realizó esta solicitud, comuníquese con el administrador del sistema.',
      '',
      'SIGEC-IGSS',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #17212B; line-height: 1.55;">
        <h2 style="color: #183A5A;">SIGEC-IGSS</h2>
        <p>Estimado(a) <strong>${escapeHtml(recipientName)}</strong>:</p>
        <p>Se solicitó el restablecimiento de su contraseña en SIGEC-IGSS.</p>
        <p>Su contraseña temporal es:</p>
        <p style="font-size: 20px; font-weight: 700; letter-spacing: 1px; color: #183A5A;">${escapeHtml(temporaryPassword)}</p>
        <p>Utilícela únicamente para iniciar sesión. El sistema le solicitará crear una nueva contraseña antes de permitirle acceder a los módulos institucionales.</p>
        <p>Si usted no realizó esta solicitud, comuníquese con el administrador del sistema.</p>
        <p style="margin-top: 28px;">SIGEC-IGSS</p>
      </div>
    `,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character] ?? character));
}
