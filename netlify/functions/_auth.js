// _auth.js
// JWT in signed, http-only cookie. Wachtwoord en secret komen uit env vars,
// staan nergens in de code.

const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'bonnen_auth';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dagen

function parseCookies(str) {
  const out = {};
  (str || '').split(';').forEach((p) => {
    const idx = p.indexOf('=');
    if (idx === -1) return;
    out[p.slice(0, idx).trim()] = decodeURIComponent(p.slice(idx + 1).trim());
  });
  return out;
}

function sign() {
  return jwt.sign({ ok: true }, process.env.COOKIE_SECRET, { expiresIn: MAX_AGE });
}

function verify(event) {
  const token = parseCookies(event.headers?.cookie)[COOKIE_NAME];
  if (!token) return false;
  try {
    jwt.verify(token, process.env.COOKIE_SECRET);
    return true;
  } catch {
    return false;
  }
}

function setCookieHeader(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

function clearCookieHeader() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

module.exports = { sign, verify, setCookieHeader, clearCookieHeader };
