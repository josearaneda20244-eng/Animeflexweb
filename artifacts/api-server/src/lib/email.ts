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
    // Support both generic SMTP and Gmail-specific env vars
    const smtpHost = process.env["SMTP_HOST"] ?? (process.env["GMAIL_USER"] ? "smtp.gmail.com" : undefined);
    if (!smtpHost) throw new Error("SMTP_NOT_CONFIGURED");

    const smtpUser = process.env["SMTP_USER"] ?? process.env["GMAIL_USER"];
    const smtpPass = process.env["SMTP_PASS"] ?? process.env["GMAIL_PASS"];
    const smtpPort = parseInt(process.env["SMTP_PORT"] ?? "587");
    const isSecure = smtpPort === 465;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 15000,
      greetingTimeout:   10000,
      socketTimeout:     20000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    const from =
      process.env["SMTP_FROM"] ??
      smtpUser ??
      "noreply@animeflex.app";

    await transporter.sendMail({ from, to, subject, html, text });
  }

  export function emailTemplate(content: string): string {
    return `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#09090E;color:#F1F1F5;padding:0;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">
        <div style="padding:32px 32px 0;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06)">
          <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:24px">
            <div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#7C6FFF,#5B52F5);display:inline-flex;align-items:center;justify-content:center">
              <span style="color:#fff;font-size:13px">▶</span>
            </div>
            <span style="font-size:18px;font-weight:900"><span style="color:#F1F1F5">Anime</span><span style="color:#7C6FFF">FLEX</span></span>
          </div>
        </div>
        <div style="padding:32px">
          ${content}
        </div>
        <div style="padding:16px 32px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06)">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0">AnimeFlex — animeflex.lat · Mira anime gratis en HD</p>
        </div>
      </div>
    `;
  }
  