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
  const mono = "'JetBrains Mono','Courier New',Consolas,monospace";
  const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>[ VERIFICACIÓN DEL SISTEMA ] — AnimeFlex</title>
</head>
<body style="margin:0;padding:0;background-color:#04040A;font-family:${sans};">
  <!-- Preheader (oculto) -->
  <div style="display:none;font-size:1px;color:#04040A;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    [ ALERTA DEL SISTEMA ] Identidad pendiente de verificación · ${username}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#04040A;">
    <tr>
      <td align="center" style="padding:36px 14px;background-color:#04040A;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- LOGO + STATUS HEADER -->
          <tr>
            <td align="center" style="padding-bottom:18px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#DC2626;width:40px;height:40px;text-align:center;vertical-align:middle;font-family:${mono};">
                    <span style="color:#ffffff;font-size:18px;font-weight:900;line-height:40px;">▶</span>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;font-family:${sans};">
                      <span style="color:#F1F1F5;">ANIME</span><span style="color:#DC2626;">FLEX</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SYSTEM ALERT BAR -->
          <tr>
            <td align="center" style="padding-bottom:14px;">
              <span style="display:inline-block;font-family:${mono};font-size:11px;font-weight:800;color:#DC2626;letter-spacing:2.5px;text-transform:uppercase;">
                ● [ ALERTA DEL SISTEMA ] /// NIVEL: CRÍTICO
              </span>
            </td>
          </tr>

          <!-- MONOLITH CARD -->
          <tr>
            <td style="background-color:#08080F;border:1px solid #DC2626;">
              <!-- Inner top scanline -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:2px;background-color:#DC2626;line-height:2px;font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Header bar (SYS://) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:14px 24px;border-bottom:1px solid rgba(220,38,38,0.25);font-family:${mono};font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="left" style="color:rgba(255,255,255,0.45);font-family:${mono};">
                          SYS://animeflex.core
                        </td>
                        <td align="right" style="color:#DC2626;font-family:${mono};">
                          ● VERIFICACIÓN
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- HERO -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:36px 28px 8px;">
                    <!-- Hex icon (HTML/table version) -->
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 22px;">
                      <tr>
                        <td style="width:84px;height:84px;background-color:rgba(220,38,38,0.12);border:2px solid #DC2626;text-align:center;vertical-align:middle;font-family:${mono};">
                          <span style="color:#ffffff;font-size:42px;font-weight:900;line-height:80px;text-shadow:0 0 12px #DC2626;">!</span>
                        </td>
                      </tr>
                    </table>

                    <h1 style="color:#F8FAFC;font-family:${sans};font-size:26px;font-weight:900;margin:0 0 8px;letter-spacing:-0.4px;line-height:1.2;">
                      VERIFICACIÓN DE IDENTIDAD
                    </h1>
                    <p style="color:#DC2626;font-family:${mono};font-size:11px;font-weight:800;letter-spacing:2.2px;text-transform:uppercase;margin:0 0 6px;">
                      /// acceso restringido al sistema ///
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CONTENT -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:24px 28px 12px;">

                    <!-- USUARIO DETECTADO panel -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
                      <tr>
                        <td style="background-color:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.32);padding:14px 16px;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="font-family:${mono};font-size:10px;font-weight:800;color:rgba(255,255,255,0.5);letter-spacing:1.6px;text-transform:uppercase;padding-bottom:6px;">
                                [ USUARIO DETECTADO ]
                              </td>
                            </tr>
                            <tr>
                              <td style="font-family:${mono};font-size:18px;font-weight:900;color:#F1F1F5;letter-spacing:0.5px;">
                                › ${username}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="color:rgba(255,255,255,0.7);font-family:${sans};font-size:14.5px;line-height:1.7;margin:0 0 26px;">
                      El sistema requiere confirmar la propiedad de esta dirección de correo
                      antes de habilitar el acceso completo a la red AnimeFlex.
                      Ejecuta la verificación a continuación para activar tu cuenta.
                    </p>

                    <!-- CTA BUTTON -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
                      <tr>
                        <td align="center">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color:#DC2626;border:1px solid #F87171;">
                                <a href="${verifyUrl}" target="_blank" style="display:inline-block;color:#ffffff;font-family:${mono};font-size:14px;font-weight:900;text-decoration:none;padding:16px 36px;letter-spacing:2.2px;text-transform:uppercase;">
                                  [ EJECUTAR VERIFICACIÓN ›› ]
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- TOKEN box -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
                      <tr>
                        <td style="background-color:rgba(0,0,0,0.4);border:1px solid rgba(220,38,38,0.25);padding:12px 16px;text-align:center;">
                          <span style="display:inline-block;font-family:${mono};font-size:10px;font-weight:800;color:rgba(255,255,255,0.45);letter-spacing:1.6px;text-transform:uppercase;">
                            [ TOKEN VÁLIDO POR ]
                          </span>
                          <span style="display:inline-block;padding:0 10px;">&nbsp;</span>
                          <span style="display:inline-block;font-family:${mono};font-size:18px;font-weight:900;color:#F8FAFC;letter-spacing:1.2px;">
                            24:00:00
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- URL fallback -->
                    <p style="color:rgba(255,255,255,0.35);font-family:${mono};font-size:10px;text-align:center;margin:0 0 22px;letter-spacing:0.4px;">
                      Si el botón falla, copia y pega esta dirección:
                    </p>
                    <p style="color:rgba(220,38,38,0.7);font-family:${mono};font-size:11px;text-align:center;margin:0 0 24px;word-break:break-all;line-height:1.5;">
                      ${verifyUrl}
                    </p>

                  </td>
                </tr>
              </table>

              <!-- Footer line of card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:14px 24px;border-top:1px solid rgba(220,38,38,0.22);font-family:${mono};font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:1.2px;text-transform:uppercase;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="left" style="color:rgba(255,255,255,0.4);font-family:${mono};">
                          › Si no iniciaste este registro, ignora este mensaje
                        </td>
                        <td align="right" style="color:rgba(220,38,38,0.7);font-family:${mono};">
                          v4.0
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Bottom scanline -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:2px;background-color:#DC2626;line-height:2px;font-size:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding:22px 0 0;">
              <p style="color:rgba(255,255,255,0.3);font-family:${mono};font-size:10px;margin:0 0 6px;letter-spacing:2px;text-transform:uppercase;">
                ANIMEFLEX · SYSTEM_GUARD
              </p>
              <p style="color:rgba(255,255,255,0.18);font-family:${sans};font-size:11px;margin:0;">
                © 2026 AnimeFlex · animeflex.lat
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
