const nodemailer = require('nodemailer');
const dnsSync = require('dns');
try { dnsSync.setDefaultResultOrder('ipv4first'); } catch {}
const dns = require('dns').promises;

// Common disposable, fake, or synthetic domains
const BLOCKED_DOMAINS = [
  'tempmail.com', 'throwawaymail.com', '10minutemail.com', 'mailinator.com',
  'guerrillamail.com', 'sharklasers.com', 'yopmail.com', 'fakemail.com',
  'fake.com', 'test.com', 'example.com', 'dummy.com', 'trashmail.com',
  'disposable.com', 'dispostable.com', 'mailcatch.com', 'inboxkitten.com'
];

// Recognized genuine email providers & institutional TLDs
const KNOWN_VALID_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com',
  'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'zoho.com', 'proton.me', 'protonmail.com', 'trustvault.demo',
  'trustvault.edu', 'college.edu'
];

/**
 * Validates email or roll number input and formats it cleanly
 * Strictly validates that email is genuine, correctly formatted, and has active mail servers
 */
async function validateEmailAddress(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Student Roll No or Email address is required.' };
  }

  let clean = input.toLowerCase().trim();

  // If user entered without '@', verify it matches an academic roll number pattern (e.g. "26MX337", "24CS102")
  if (!clean.includes('@')) {
    const rollPattern = /^[0-9]{2}[a-z]{2}[0-9]{3,4}$/i;
    if (rollPattern.test(clean)) {
      const rollNo = clean.toUpperCase();
      const normalizedEmail = `${clean}@trustvault.edu`;
      return { valid: true, email: normalizedEmail, roll: rollNo, isRollNo: true };
    }
    return { valid: false, error: 'Please enter a valid email address or college roll number (e.g. 26MX337).' };
  }

  // RFC-standard email pattern check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(clean)) {
    return { valid: false, error: 'Please enter a valid email format (e.g. yourname@gmail.com or name@college.edu).' };
  }

  const parts = clean.split('@');
  const localPart = parts[0];
  const domain = parts[1];

  if (!domain || !domain.includes('.')) {
    return { valid: false, error: 'Please enter a valid domain (e.g. name@college.edu or name@gmail.com).' };
  }

  // Reject blocked disposable or fake domains
  if (BLOCKED_DOMAINS.includes(domain) || domain.includes('fake') || domain.includes('disposable') || domain.includes('tempmail')) {
    return { valid: false, error: 'Disposable or fake temporary email addresses are not allowed. Please enter your real email address.' };
  }

  // Reject suspicious synthetic keywords in local part
  if (localPart === 'fake' || localPart === 'fakemail' || localPart === 'test' || localPart === 'dummy') {
    return { valid: false, error: 'Please enter your genuine personal or college email address.' };
  }

  // If domain is among known genuine domains or college institutional domains, approve immediately
  const isKnownValid = KNOWN_VALID_DOMAINS.includes(domain) ||
                       domain.endsWith('.edu') ||
                       domain.endsWith('.ac.in') ||
                       domain.endsWith('.edu.in');

  if (!isKnownValid) {
    // Attempt DNS MX lookup for custom or unknown domains to guarantee domain actually exists
    try {
      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('DNS_TIMEOUT')), 4000);
        if (timer.unref) timer.unref();
      });
      const mxRecords = await Promise.race([dns.resolveMx(domain), timeoutPromise]);
      clearTimeout(timer);

      if (!mxRecords || mxRecords.length === 0) {
        return {
          valid: false,
          error: `The email domain "@${domain}" has no mail servers and cannot receive email. Please enter a genuine, active email address.`
        };
      }
    } catch (dnsErr) {
      // Only reject if DNS definitively reports the domain doesn't exist; allow through on network/DNS timeouts
      if (dnsErr && (dnsErr.code === 'ENOTFOUND' || dnsErr.code === 'ENODATA')) {
        return {
          valid: false,
          error: `The email domain "@${domain}" could not be verified. Please enter a genuine email (e.g. Gmail, Outlook, Yahoo, or your official college email).`
        };
      }
    }
  }

  // Extract possible roll number if localPart has pattern like "26mx337"
  const rollMatch = localPart.match(/\b([0-9]{2}[a-z]{2}[0-9]{3,4})\b/i);
  const detectedRoll = rollMatch ? rollMatch[1].toUpperCase() : undefined;

  return { valid: true, email: clean, roll: detectedRoll };
}

/**
 * Configure Nodemailer transport with connection pooling for fast, reliable delivery
 */
let cachedTransporter = null;
let cachedKey = '';

function getTransporter() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (user && pass) {
    const cleanPass = pass.replace(/\s+/g, '');
    const key = `${user}:${cleanPass}`;
    if (cachedTransporter && cachedKey === key) {
      return cachedTransporter;
    }

    cachedKey = key;
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4,
      auth: {
        user,
        pass: cleanPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
    return cachedTransporter;
  }

  return null;
}

/**
 * Sends mail via primary Gmail SSL (465) with automatic fallback to STARTTLS (587)
 */
async function sendWithFallback(mailOptions) {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, mode: 'console', error: 'SMTP credentials not configured in server/.env' };
  }

  const authUser = (process.env.SMTP_USER || '').trim();
  const cleanPass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');
  const envelopeOptions = {
    ...mailOptions,
    from: mailOptions.from || process.env.SMTP_FROM?.trim() || authUser,
    replyTo: authUser
  };

  try {
    const info = await transporter.sendMail(envelopeOptions);
    if (Array.isArray(info.rejected) && info.rejected.length > 0) {
      return { sent: false, mode: 'smtp', error: `Recipient rejected by mail server: ${info.rejected.join(', ')}` };
    }
    return { sent: true, mode: 'smtp', messageId: info.messageId };
  } catch (mailErr) {
    console.warn(`[TrustVault Mailer] Primary SMTP failed (${mailErr.message}), retrying via port 587 STARTTLS...`);
    try {
      const fallbackTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        family: 4,
        auth: { user: authUser, pass: cleanPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000
      });
      const info = await fallbackTransporter.sendMail(envelopeOptions);
      return { sent: true, mode: 'smtp-587', messageId: info.messageId };
    } catch (fallbackErr) {
      console.error(`[TrustVault Mailer] Failed to send email via SMTP: ${fallbackErr.message}`);
      return { sent: false, mode: 'console', fallback: true, error: fallbackErr.message };
    }
  }
}

/**
 * Sends real OTP email to the recipient's inbox (if SMTP configured) or provides console delivery
 */
async function sendOtpEmail({ to, code, name }) {
  const recipientName = name || to.split('@')[0];

  const htmlContent = `
  <div style="font-family: Arial, Helvetica, sans-serif; color: #111827; max-width: 520px; margin: 0 auto; padding: 20px;">
    <p style="font-size: 15px; margin: 0 0 12px 0;">Hello ${recipientName},</p>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">
      Your TrustVault sign-in verification code is:
    </p>
    <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; font-family: monospace; color: #0284c7; margin: 0 0 16px 0;">
      ${code}
    </p>
    <p style="font-size: 13px; color: #6b7280; margin: 0;">
      This code is valid for 15 minutes. If you did not request this, you can safely ignore this email.
    </p>
  </div>`;

  console.log('\n================================================================');
  console.log(`🔐 [TRUSTVAULT OTP DISPATCH]`);
  console.log(`   Recipient: ${to}`);
  console.log(`   OTP Code : [ ${code} ]`);
  console.log('================================================================\n');

  const result = await sendWithFallback({
    to,
    subject: `TrustVault Login Code: ${code}`,
    text: `Hello ${recipientName},\n\nYour TrustVault sign-in verification code is: ${code}\n\nThis code is valid for 15 minutes.`,
    html: htmlContent
  });

  if (result.sent) {
    console.log(`[TrustVault Mailer] Real email dispatched to ${to}! Message ID: ${result.messageId}`);
  }
  return { ...result, code };
}

/**
 * Sends encrypted documents ZIP archive attached directly to the recipient's email
 */
async function sendExportZipEmail({ to, name, zipBuffer, zipPassword, docCount, docTitles = [] }) {
  const recipientName = name || to.split('@')[0];
  const zipFileName = `TrustVault-Documents-${Date.now()}.zip`;

  const htmlContent = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b1120; color: #f8fafc; padding: 40px 20px; border-radius: 12px; max-width: 540px; margin: 0 auto; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background: #0284c7; color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: bold; letter-spacing: 0.5px;">
        🛡️ TRUSTVAULT ENCRYPTED EXPORT
      </div>
      <h2 style="color: #ffffff; margin: 16px 0 6px 0; font-size: 24px;">Your Vault Documents</h2>
      <p style="color: #94a3b8; font-size: 14px; margin: 0;">Academic &amp; Digital Identity Depository</p>
    </div>

    <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 24px; margin: 24px 0;">
      <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 14px 0;">Hello <b>${recipientName}</b>,</p>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
        Attached is your requested secure ZIP archive containing <b>${docCount}</b> verified academic document(s).
      </p>

      ${docTitles.length > 0 ? `
      <div style="background-color: #0f172a; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 6px;">Archived Documents:</span>
        <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 13px;">
          ${docTitles.map(t => `<li style="margin-bottom: 4px;">${t}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div style="background-color: #020617; border: 2px dashed #0284c7; border-radius: 8px; padding: 16px; text-align: center;">
        <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: bold; display: block; margin-bottom: 6px;">Archive Unlock Password:</span>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 26px; font-weight: bold; letter-spacing: 4px; color: #38bdf8;">
          ${zipPassword}
        </div>
      </div>
      <p style="color: #64748b; font-size: 12px; margin: 12px 0 0 0; text-align: center;">🔒 Use this password or your Vault PIN to extract the enclosed files.</p>
    </div>

    <div style="border-top: 1px solid #1e293b; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
      <p style="margin: 0 0 6px 0;">This email was sent to <b>${to}</b> from TrustVault Academic Portal.</p>
      <p style="margin: 0;">Each document in the attached ZIP has been cryptographically verified and recorded in the audit ledger.</p>
    </div>
  </div>`;

  console.log('\n================================================================');
  console.log(`📦 [TRUSTVAULT EXPORT ZIP DISPATCH]`);
  console.log(`   Recipient: ${to}`);
  console.log(`   Documents: ${docCount} items`);
  console.log(`   Password : [ ${zipPassword} ]`);
  console.log('================================================================\n');

  const result = await sendWithFallback({
    to,
    subject: `Your Encrypted Documents Archive (${docCount} files) - TrustVault`,
    text: `Hello ${recipientName},\n\nYour requested encrypted documents archive is attached.\n\nUnlock Password: ${zipPassword}\nDocuments: ${docCount}\n\nTrustVault Academic Portal`,
    html: htmlContent,
    attachments: [
      {
        filename: zipFileName,
        content: zipBuffer,
        contentType: 'application/zip'
      }
    ]
  });

  if (result.sent) {
    console.log(`[TrustVault Mailer] Export ZIP emailed to ${to}! Message ID: ${result.messageId}`);
  }
  return result;
}

/**
 * Sends a secure document share link to the recipient's email
 */
async function sendShareLinkEmail({ to, senderName, docTitle, shareUrl, expiresAt, maxViews = 5 }) {
  const recipientName = String(to || '').split('@')[0] || 'Recipient';
  const expStr = expiresAt ? new Date(expiresAt).toLocaleString() : '24 hours';
  const htmlContent = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b1120; color: #f8fafc; padding: 36px 20px; border-radius: 12px; max-width: 540px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: inline-block; background: #0284c7; color: white; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold;">
        TRUSTVAULT SECURE SHARE
      </div>
      <h2 style="color: #ffffff; margin: 14px 0 6px 0; font-size: 22px;">${docTitle}</h2>
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">Shared by ${senderName || 'a TrustVault user'}</p>
    </div>
    <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 22px; margin: 20px 0;">
      <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 14px 0;">Hello <b>${recipientName}</b>,</p>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0 0 18px 0;">
        <b>${senderName || 'A student'}</b> has shared a verified document (<b>${docTitle}</b>) with you via TrustVault.
      </p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${shareUrl}" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px;">
          Open Shared Document
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin: 14px 0 0 0; word-break: break-all;">
        Or copy link: <a href="${shareUrl}" style="color: #38bdf8;">${shareUrl}</a>
      </p>
      <p style="color: #64748b; font-size: 12px; margin: 12px 0 0 0;">
        Expires: ${expStr} · Max views: ${maxViews}
      </p>
    </div>
  </div>`;

  const result = await sendWithFallback({
    to,
    subject: `${senderName || 'TrustVault User'} shared "${docTitle}" with you - TrustVault`,
    text: `Hello ${recipientName},\n\n${senderName || 'A TrustVault user'} has shared "${docTitle}" with you.\n\nOpen link: ${shareUrl}\nExpires: ${expStr}\nMax views: ${maxViews}\n\nTrustVault Portal`,
    html: htmlContent
  });

  if (result.sent) {
    console.log(`[TrustVault Mailer] Share link emailed to ${to}! Message ID: ${result.messageId}`);
  }
  return result;
}

module.exports = {
  validateEmailAddress,
  sendOtpEmail,
  sendExportZipEmail,
  sendShareLinkEmail
};
