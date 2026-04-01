import crypto from 'crypto';
import nodemailer from 'nodemailer';

function getSmtpConfig() {
    const host = process.env.SMTP_HOST || '';
    const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const from = process.env.EMAIL_FROM || user || 'noreply@example.com';

    return {
        enabled: Boolean(host && user && pass),
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: user && pass ? { user, pass } : undefined,
        from,
    };
}

let transporter = null;

function getTransporter() {
    const config = getSmtpConfig();
    if (!config.enabled) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth,
        });
    }
    return transporter;
}

export async function sendEmail({ to, subject, text, html = '' }) {
    const config = getSmtpConfig();
    const transport = getTransporter();

    if (!transport) {
        console.warn(`Email skipped because SMTP is not configured: ${subject} -> ${to}`);
        return { skipped: true };
    }

    await transport.sendMail({
        from: config.from,
        to,
        subject,
        text,
        html: html || `<pre>${text}</pre>`,
    });

    return { skipped: false };
}

export function generateOpaqueToken() {
    return crypto.randomBytes(24).toString('hex');
}

export function hashOpaqueToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateVerificationCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}
