// reset-data.js
// POST { confirm: "VERWIJDER" } -> zet de Bonnen-map en het overzichtsbestand
// in de prullenbak van Drive (herstelbaar). Auth-gated.

const { clients, resetAll } = require('./_google');
const { verify } = require('./_auth');

const CORS = { 'Content-Type': 'application/json' };
const reply = (statusCode, obj) => ({ statusCode, headers: CORS, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Gebruik POST.' });
  if (!verify(event)) return reply(401, { ok: false, error: 'Niet ingelogd.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { ok: false, error: 'Ongeldige JSON.' }); }
  if (body.confirm !== 'VERWIJDER') {
    return reply(400, { ok: false, error: 'Bevestiging ontbreekt.' });
  }
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return reply(500, { ok: false, error: 'Google-credentials niet geconfigureerd.' });
  }

  try {
    const { drive } = clients();
    const result = await resetAll(drive);
    return reply(200, { ok: true, ...result });
  } catch (err) {
    return reply(502, { ok: false, error: `Wissen mislukt: ${err.message}` });
  }
};
