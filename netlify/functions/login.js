// login.js
// POST { password } -> zet http-only cookie bij match met APP_PASSWORD.

const { sign, setCookieHeader } = require('./_auth');

const CORS = { 'Content-Type': 'application/json' };
const reply = (statusCode, obj, extraHeaders = {}) => ({ statusCode, headers: { ...CORS, ...extraHeaders }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Gebruik POST.' });
  if (!process.env.APP_PASSWORD || !process.env.COOKIE_SECRET) {
    return reply(500, { ok: false, error: 'APP_PASSWORD / COOKIE_SECRET niet geconfigureerd.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { ok: false, error: 'Ongeldige JSON.' }); }

  if (body.password !== process.env.APP_PASSWORD) {
    return reply(401, { ok: false, error: 'Onjuist wachtwoord.' });
  }

  return reply(200, { ok: true }, { 'Set-Cookie': setCookieHeader(sign()) });
};
