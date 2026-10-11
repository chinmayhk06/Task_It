const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

const sendEmail = async ({ to, subject, html, text, required = false }) => {
  const mailer = getTransporter();

  if (!mailer) {
    if (required) throw new Error('SMTP is not configured');
    console.log(`[EmailService] Skipping email because SMTP is not configured. To: ${to} | Subject: ${subject}`);
    return;
  }

  try {
    await mailer.sendMail({
      from: process.env.EMAIL_FROM || `"Task It" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });

    console.log(`[EmailService] Email sent to ${to}`);
  } catch (err) {
    if (required) throw err;
    console.error(`[EmailService] Failed to send email: ${err.message}`);
  }
};

module.exports = { sendEmail };
