'use strict';
/**
 * UniNMS Email Service
 * Uses nodemailer with SMTP. If SMTP_HOST is not set, emails are logged to
 * the console instead (useful for local dev without a mail server).
 */

const nodemailer = require('nodemailer');

const APP_URL = process.env.APP_URL || 'http://localhost:3001';
const FROM    = process.env.MAIL_FROM || 'UniNMS <noreply@uninms.edu.ng>';

// ── Transport ─────────────────────────────────────────────────────────────────

let transporter;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  // Dev fallback — log to console
  transporter = {
    sendMail: async (opts) => {
      console.log(`\n[email] TO: ${opts.to}\n[email] SUBJECT: ${opts.subject}\n[email] ---\n${opts.text}\n`);
      return { messageId: 'dev-console' };
    },
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function send({ to, subject, text, html }) {
  try {
    await transporter.sendMail({ from: FROM, to, subject, text, html: html || undefined });
  } catch (err) {
    // Never throw — email failure must not break the request
    console.error(`[email] Failed to send to ${to}: ${err.message}`);
  }
}

function btn(label, url) {
  return `<a href="${url}" style="display:inline-block;padding:10px 22px;background:#09432c;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${label}</a>`;
}

function layout(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f4f0;padding:32px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e5e0">
  <div style="background:#09432c;padding:24px 32px">
    <span style="color:#fff;font-size:20px;font-weight:700">UniNMS</span>
    <span style="color:rgba(255,255,255,.5);font-size:13px;margin-left:8px">National Knowledge Network</span>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">${title}</h2>
    ${bodyHtml}
  </div>
  <div style="padding:16px 32px;background:#faf9f7;border-top:1px solid #e8e5e0;font-size:12px;color:#999">
    This email was sent by UniNMS. Do not reply to this message.
  </div>
</div></body></html>`;
}

function p(text) {
  return `<p style="margin:0 0 14px;color:#444;line-height:1.6;font-size:14px">${text}</p>`;
}

// ── Journal email templates ───────────────────────────────────────────────────

/**
 * Sent to author when their manuscript is received.
 */
async function manuscriptReceived({ to, authorName, manuscriptTitle, submissionNo, journalTitle }) {
  const subject = `Submission received — ${submissionNo}`;
  const text =
    `Dear ${authorName},\n\nThank you for submitting "${manuscriptTitle}" to ${journalTitle}.\n` +
    `Your reference number is: ${submissionNo}\n\nYou can track your submission at: ${APP_URL}/journals/my/submissions\n\nRegards,\nUniNMS Editorial System`;

  const html = layout('Manuscript received', `
    ${p(`Dear <strong>${authorName}</strong>,`)}
    ${p(`Thank you for submitting your manuscript to <strong>${journalTitle}</strong>.`)}
    <div style="background:#f0f9f4;border:1px solid #c3e6d3;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.05em">Reference number</p>
      <p style="margin:0;font-size:22px;font-weight:700;color:#09432c;font-family:monospace">${submissionNo}</p>
    </div>
    ${p(`Manuscript: <strong>${manuscriptTitle}</strong>`)}
    ${p('The editor will review your submission and may assign peer reviewers. You will be notified at each stage.')}
    <p style="margin:16px 0 0">${btn('Track my submission', `${APP_URL}/journals/my/submissions`)}</p>
  `);

  await send({ to, subject, text, html });
}

/**
 * Sent to reviewer when they are invited to review.
 */
async function reviewerInvited({ to, reviewerName, manuscriptTitle, journalTitle, dueDate }) {
  const subject = `Peer review invitation — ${journalTitle}`;
  const dueLine = dueDate ? `The review is due by <strong>${new Date(dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.` : '';
  const text =
    `Dear ${reviewerName},\n\nYou have been invited to review "${manuscriptTitle}" for ${journalTitle}.\n` +
    `${dueDate ? `Due: ${dueDate}\n` : ''}` +
    `Please accept or decline at: ${APP_URL}/reviewer\n\nRegards,\nUniNMS Editorial System`;

  const html = layout('Peer review invitation', `
    ${p(`Dear <strong>${reviewerName}</strong>,`)}
    ${p(`You have been invited to review a manuscript for <strong>${journalTitle}</strong>.`)}
    ${p(`Manuscript: <strong>${manuscriptTitle}</strong>`)}
    ${dueLine ? p(dueLine) : ''}
    ${p('Please log in to accept or decline this invitation. If you decline, the editor will invite another reviewer.')}
    <p style="margin:16px 0 0">${btn('View invitation', `${APP_URL}/reviewer`)}</p>
  `);

  await send({ to, subject, text, html });
}

/**
 * Sent to author when an editorial decision is made.
 */
async function editorialDecision({ to, authorName, manuscriptTitle, decision, letter, journalTitle }) {
  const DECISION_LABEL = {
    accept:          'Accepted',
    minor_revision:  'Minor revision required',
    major_revision:  'Major revision required',
    reject:          'Not accepted',
  };
  const label = DECISION_LABEL[decision] ?? decision;
  const subject = `Editorial decision: ${label} — ${manuscriptTitle}`;

  const DECISION_COLOR = {
    accept:         '#09432c',
    minor_revision: '#b45309',
    major_revision: '#c2410c',
    reject:         '#b91c1c',
  };
  const color = DECISION_COLOR[decision] ?? '#555';

  const text =
    `Dear ${authorName},\n\nWe have reached a decision on your manuscript "${manuscriptTitle}" submitted to ${journalTitle}.\n\n` +
    `Decision: ${label}\n\n${letter ? `Editor's comments:\n${letter}\n\n` : ''}` +
    `Log in to view: ${APP_URL}/journals/my/submissions\n\nRegards,\nUniNMS Editorial System`;

  const html = layout(`Editorial decision: ${label}`, `
    ${p(`Dear <strong>${authorName}</strong>,`)}
    ${p(`We have reached a decision on your submission to <strong>${journalTitle}</strong>.`)}
    ${p(`Manuscript: <strong>${manuscriptTitle}</strong>`)}
    <div style="background:#f8f8f8;border-left:4px solid ${color};padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
      <p style="margin:0;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.05em">Decision</p>
      <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${color}">${label}</p>
    </div>
    ${letter ? `<div style="background:#faf9f7;border:1px solid #e8e5e0;border-radius:8px;padding:16px;margin:16px 0">${p('<strong>Editor\'s comments:</strong>')}${p(letter.replace(/\n/g, '<br>'))}</div>` : ''}
    <p style="margin:16px 0 0">${btn('View submission', `${APP_URL}/journals/my/submissions`)}</p>
  `);

  await send({ to, subject, text, html });
}

/**
 * Sent to author when their manuscript is published.
 */
async function manuscriptPublished({ to, authorName, manuscriptTitle, journalTitle, journalSlug, doi }) {
  const subject = `Your article has been published — ${journalTitle}`;
  const text =
    `Dear ${authorName},\n\nCongratulations! Your article "${manuscriptTitle}" has been published in ${journalTitle}.\n` +
    `${doi ? `DOI: https://doi.org/${doi}\n` : ''}` +
    `View journal: ${APP_URL}/journals/${journalSlug}\n\nRegards,\nUniNMS Editorial System`;

  const html = layout('Article published!', `
    ${p(`Dear <strong>${authorName}</strong>,`)}
    ${p(`Congratulations! Your article has been published in <strong>${journalTitle}</strong>.`)}
    ${p(`Article: <strong>${manuscriptTitle}</strong>`)}
    ${doi ? `<div style="background:#f0f9f4;border:1px solid #c3e6d3;border-radius:8px;padding:12px 16px;margin:16px 0">${p(`DOI: <a href="https://doi.org/${doi}" style="color:#09432c;font-family:monospace">${doi}</a>`)}</div>` : ''}
    <p style="margin:16px 0 0">${btn('View published article', `${APP_URL}/journals/${journalSlug}`)}</p>
  `);

  await send({ to, subject, text, html });
}

module.exports = {
  manuscriptReceived,
  reviewerInvited,
  editorialDecision,
  manuscriptPublished,
};
