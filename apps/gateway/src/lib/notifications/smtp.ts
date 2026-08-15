import nodemailer from "nodemailer";

export async function sendSmtpEmail(opts: {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<string | undefined> {
  const transporter = nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    auth: opts.user && opts.password ? { user: opts.user, pass: opts.password } : undefined,
  });
  const info = await transporter.sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
  return typeof info.messageId === "string" ? info.messageId : undefined;
}
