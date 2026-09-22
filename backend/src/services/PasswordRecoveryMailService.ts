import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

interface PasswordRecoveryEmailInput {
  recipient: string;
  recipientName: string;
  temporaryPassword: string;
}

const IGSS_LOGO_CID = 'igss-logo';

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

function getIgssLogoPath(): string | null {
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'email', 'logo-igss.png'),
    path.join(process.cwd(), 'assets', 'email', 'logo-igss.png'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

export async function sendPasswordRecoveryEmail({
  recipient,
  recipientName,
  temporaryPassword,
}: PasswordRecoveryEmailInput): Promise<void> {
  const transporter = getMailTransporter();
  const sender = process.env.MAIL_FROM || process.env.MAIL_USER;
  const logoPath = getIgssLogoPath();
  const safeName = escapeHtml(recipientName);
  const safePassword = escapeHtml(temporaryPassword);

  const logoHtml = logoPath
    ? `<img src="cid:${IGSS_LOGO_CID}" alt="Instituto Guatemalteco de Seguridad Social" width="88" style="display:block;border:0;outline:none;text-decoration:none;width:88px;height:auto;" />`
    : '';

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
      'Instituto Guatemalteco de Seguridad Social',
      'SIGEC-IGSS',
    ].join('\n'),
    html: `
      <div style="margin:0;padding:0;background-color:#F5F7FA;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F7FA;">
          <tr>
            <td align="center" style="padding:24px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#FFFFFF;border:1px solid #D1D5D6;">
                <tr>
                  <td align="center" style="padding:20px 24px 12px 24px;background-color:#3B6B85;">
                    ${logoHtml ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:8px;background-color:#FFFFFF;">${logoHtml}</td></tr></table>` : ''}
                    <p style="margin:12px 0 0 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.4px;color:#D1D5D6;text-transform:uppercase;">
                      Instituto Guatemalteco de Seguridad Social
                    </p>
                    <h1 style="margin:6px 0 0 0;font-family:Arial,sans-serif;font-size:22px;line-height:1.3;color:#FFFFFF;">
                      SIGEC-IGSS
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="height:4px;line-height:4px;font-size:0;background-color:#6B8E38;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 8px 28px;font-family:Arial,sans-serif;color:#2C3E50;font-size:15px;line-height:1.55;">
                    <p style="margin:0 0 16px 0;">Estimado(a) <strong>${safeName}</strong>:</p>
                    <p style="margin:0 0 16px 0;">Se solicitó el restablecimiento de su contraseña en SIGEC-IGSS.</p>
                    <p style="margin:0 0 10px 0;">Su contraseña temporal es:</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 16px 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding:14px 16px;background-color:#E8EDF2;border:1px solid #D1D5D6;">
                          <code style="font-family:Consolas,'Courier New',monospace;font-size:18px;font-weight:700;letter-spacing:0;white-space:nowrap;color:#325A72;">${safePassword}</code>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 28px 28px;font-family:Arial,sans-serif;color:#2C3E50;font-size:15px;line-height:1.55;">
                    <p style="margin:0 0 16px 0;">Utilícela únicamente para iniciar sesión. El sistema le solicitará crear una nueva contraseña antes de permitirle acceder a los módulos institucionales.</p>
                    <p style="margin:0;">Si usted no realizó esta solicitud, comuníquese con el administrador del sistema.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 28px;background-color:#F5F7FA;border-top:1px solid #D1D5D6;font-family:Arial,sans-serif;font-size:12px;color:#5F6C7B;">
                    Instituto Guatemalteco de Seguridad Social<br />
                    Sistema Integral de Gestión de Expedientes de Compras
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
    attachments: logoPath
      ? [
          {
            filename: 'logo-igss.png',
            path: logoPath,
            cid: IGSS_LOGO_CID,
            contentDisposition: 'inline',
            contentType: 'image/png',
          },
        ]
      : [],
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
