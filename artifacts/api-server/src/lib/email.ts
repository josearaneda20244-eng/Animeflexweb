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
  const smtpHost = process.env["SMTP_HOST"];
  if (!smtpHost) throw new Error("SMTP_NOT_CONFIGURED");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env["SMTP_PORT"] ?? "587"),
    secure: process.env["SMTP_PORT"] === "465",
    auth: {
      user: process.env["SMTP_USER"],
      pass: process.env["SMTP_PASS"],
    },
  });

  const from =
    process.env["SMTP_FROM"] ??
    process.env["SMTP_USER"] ??
    "noreply@animeflex.app";

  await transporter.sendMail({ from, to, subject, html, text });
}

export function emailTemplate(content: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#090A12;color:#F1F1F5;padding:32px;border-radius:16px;border:1px solid rgba(255,255,255,0.07)">
      <div style="text-align:center;margin-bottom:28px">
        <span style="font-size:22px;font-weight:900"><span style="color:#F1F1F5">Anime</span><span style="color:#6C63FF">FLEX</span></span>
      </div>
      ${content}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0 16px"/>
      <p style="color:rgba(255,255,255,0.15);font-size:11px;text-align:center;margin:0">AnimeFlex — animeflex.replit.app</p>
    </div>
  `;
}
