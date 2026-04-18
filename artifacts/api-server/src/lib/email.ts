import nodemailer from "nodemailer";

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const resendKey = process.env["RESEND_API_KEY"];

  if (resendKey) {
    const from =
      process.env["RESEND_FROM"] ??
      process.env["SMTP_FROM"] ??
      "AnimeFlex <onboarding@resend.dev>";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Resend API error ${response.status}: ${body}`);
    }
    return;
  }

  const smtpUser = process.env["SMTP_USER"] ?? process.env["GMAIL_USER"];
  const smtpHost = process.env["SMTP_HOST"] ?? (smtpUser ? "smtp.gmail.com" : undefined);

  if (!smtpHost) throw new Error("SMTP_NOT_CONFIGURED");

  const smtpPass = process.env["SMTP_PASS"] ?? process.env["GMAIL_PASS"];
  const smtpPort = parseInt(process.env["SMTP_PORT"] ?? "587");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 15_000,
    greetingTimeout:   10_000,
    socketTimeout:     20_000,
    tls: { rejectUnauthorized: false },
  });

  const from =
    process.env["SMTP_FROM"] ??
    smtpUser ??
    "noreply@animeflex.app";

  await transporter.sendMail({ from, to, subject, html, text });
}

export function verificationEmailHtml(username: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifica tu correo — AnimeFlex</title></head>
<body style="margin:0;padding:0;background-color:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050508;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;">

          <!-- LOGO -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#7C6FFF,#5B52F5);border-radius:14px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:18px;font-weight:900;line-height:44px;">▶</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;">
                      <span style="color:#F1F1F5;">Anime</span><span style="color:#7C6FFF;">FLEX</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CARD -->
          <tr>
            <td style="background:#0D0D1A;border:1px solid rgba(124,111,255,0.2);border-radius:24px;overflow:hidden;">

              <!-- HERO BANNER -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#0a0a18 0%,#131030 50%,#0a0a18 100%);padding:40px 32px 36px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <!-- Icon circle -->
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
                      <tr>
                        <td style="width:80px;height:80px;background:linear-gradient(135deg,rgba(34,197,94,0.2),rgba(22,163,74,0.1));border:2px solid rgba(34,197,94,0.35);border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="font-size:32px;line-height:76px;">✉️</span>
                        </td>
                      </tr>
                    </table>
                    <h1 style="color:#F1F1F5;font-size:26px;font-weight:900;margin:0 0 10px;letter-spacing:-0.5px;">Verifica tu correo</h1>
                    <p style="color:rgba(255,255,255,0.45);font-size:15px;margin:0;line-height:1.5;">Un paso más para disfrutar AnimeFlex al máximo</p>
                  </td>
                </tr>
              </table>

              <!-- CONTENT -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 32px;">

                    <!-- Greeting -->
                    <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0 0 8px;line-height:1.6;">
                      Hola, <strong style="color:#F1F1F5;">${username}</strong> 👋
                    </p>
                    <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 32px;line-height:1.7;">
                      Gracias por registrarte en AnimeFlex. Para activar tu cuenta y acceder a todas las funciones, confirma tu dirección de correo electrónico haciendo clic en el botón de abajo.
                    </p>

                    <!-- Benefits row -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                      <tr>
                        <td style="background:rgba(124,111,255,0.08);border:1px solid rgba(124,111,255,0.15);border-radius:14px;padding:18px 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding:6px 0;">
                                <span style="color:#22C55E;font-size:14px;">✓</span>
                                <span style="color:rgba(255,255,255,0.65);font-size:13px;padding-left:10px;">Acceso completo a episodios y manga</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;">
                                <span style="color:#22C55E;font-size:14px;">✓</span>
                                <span style="color:rgba(255,255,255,0.65);font-size:13px;padding-left:10px;">Guarda favoritos y tu historial</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;">
                                <span style="color:#22C55E;font-size:14px;">✓</span>
                                <span style="color:rgba(255,255,255,0.65);font-size:13px;padding-left:10px;">Comenta y puntúa tus animes favoritos</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                      <tr>
                        <td align="center">
                          <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#22C55E,#16A34A);color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:16px 48px;border-radius:14px;letter-spacing:0.2px;">
                            ✓ &nbsp;Verificar mi correo
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry notice -->
                    <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:0 0 28px;">
                      Este enlace expira en <strong style="color:rgba(255,255,255,0.5);">24 horas</strong>
                    </p>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
                        <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0;line-height:1.6;">
                          Si no creaste una cuenta en AnimeFlex, puedes ignorar este correo con total seguridad.
                          Nadie más puede verificar esta dirección sin tu permiso.
                        </p>
                      </td></tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="color:rgba(255,255,255,0.18);font-size:12px;margin:0 0 6px;">
                © 2025 AnimeFlex · animeflex.lat
              </p>
              <p style="color:rgba(255,255,255,0.12);font-size:11px;margin:0;">
                Mira anime gratis en HD con subtítulos en español
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function resetPasswordEmailHtml(username: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Restablecer contraseña — AnimeFlex</title></head>
<body style="margin:0;padding:0;background-color:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050508;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;">

          <!-- LOGO -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#7C6FFF,#5B52F5);border-radius:14px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:18px;font-weight:900;line-height:44px;">▶</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;">
                      <span style="color:#F1F1F5;">Anime</span><span style="color:#7C6FFF;">FLEX</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CARD -->
          <tr>
            <td style="background:#0D0D1A;border:1px solid rgba(239,68,68,0.2);border-radius:24px;overflow:hidden;">

              <!-- HERO BANNER -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#0a0a18 0%,#160e0e 50%,#0a0a18 100%);padding:40px 32px 36px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
                      <tr>
                        <td style="width:80px;height:80px;background:linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.1));border:2px solid rgba(239,68,68,0.35);border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="font-size:32px;line-height:76px;">🔑</span>
                        </td>
                      </tr>
                    </table>
                    <h1 style="color:#F1F1F5;font-size:26px;font-weight:900;margin:0 0 10px;letter-spacing:-0.5px;">Restablecer contraseña</h1>
                    <p style="color:rgba(255,255,255,0.45);font-size:15px;margin:0;line-height:1.5;">Recibimos una solicitud para cambiar tu contraseña</p>
                  </td>
                </tr>
              </table>

              <!-- CONTENT -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 32px;">

                    <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0 0 8px;line-height:1.6;">
                      Hola, <strong style="color:#F1F1F5;">${username}</strong> 👋
                    </p>
                    <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 32px;line-height:1.7;">
                      Alguien (esperamos que tú) solicitó restablecer la contraseña de tu cuenta AnimeFlex.
                      Haz clic en el botón de abajo para elegir una nueva contraseña.
                    </p>

                    <!-- Warning box -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                      <tr>
                        <td style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:14px;padding:16px 20px;">
                          <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0;line-height:1.6;">
                            ⚠️ &nbsp;Este enlace es válido por <strong style="color:#F59E0B;">1 hora</strong> y solo puede usarse una vez.
                            Si no lo usas, tu contraseña actual seguirá siendo la misma.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                      <tr>
                        <td align="center">
                          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7C6FFF,#5B52F5);color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:16px 48px;border-radius:14px;letter-spacing:0.2px;">
                            🔑 &nbsp;Cambiar contraseña
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- URL fallback -->
                    <p style="color:rgba(255,255,255,0.25);font-size:11px;text-align:center;margin:0 0 28px;word-break:break-all;">
                      Si el botón no funciona, copia este enlace:<br>
                      <span style="color:rgba(124,111,255,0.6);">${resetUrl}</span>
                    </p>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
                        <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0;line-height:1.6;">
                          🛡️ &nbsp;Si no solicitaste cambiar tu contraseña, ignora este correo.
                          Tu cuenta está segura y nadie puede acceder sin tu contraseña actual.
                        </p>
                      </td></tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="color:rgba(255,255,255,0.18);font-size:12px;margin:0 0 6px;">
                © 2025 AnimeFlex · animeflex.lat
              </p>
              <p style="color:rgba(255,255,255,0.12);font-size:11px;margin:0;">
                Mira anime gratis en HD con subtítulos en español
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050508;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:22px;font-weight:900;">
                <span style="color:#F1F1F5;">Anime</span><span style="color:#7C6FFF;">FLEX</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:#0D0D1A;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <p style="color:rgba(255,255,255,0.15);font-size:12px;margin:0;">© 2025 AnimeFlex — animeflex.lat</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
