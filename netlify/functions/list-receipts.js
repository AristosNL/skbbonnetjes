// list-receipts.js
// GET -> { ok, receipts: [...] }  (auth-gated)
// Leest alle regels uit de Bonnen-administratie-Sheet en geeft ze als objecten terug.

const { clients, ensureSheet, readSheet } = require('./_google');
const { verify } = require('./_auth');

const n = (x) => (typeof x === 'number' ? x : Number(String(x == null ? '' : x).replace(',', '.')) || 0);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: {}, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Gebruik GET.' };
  if (!verify(event)) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Niet ingelogd.' }) };
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Google-credentials niet geconfigureerd.' }) };
  }

  try {
    const { drive, sheets } = clients();
    const sheetId = await ensureSheet(drive, sheets);
    const rows = await readSheet(sheets, sheetId); // vanaf A2

    const receipts = rows
      .filter((r) => r[0]) // datum aanwezig
      .map((r) => ({
        datum: String(r[0]),
        leverancier: r[1] || '',
        categorie: r[2] || '',
        excl: n(r[3]),
        btw: n(r[4]),
        incl: n(r[5]),
        aftrekbaar: r[6] || '',
        review: (r[7] || '') === 'JA',
        bon: r[8] || '',
        vastgelegd: r[9] || '',
      }));

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, receipts }) };
  } catch (err) {
    return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: `Ophalen mislukt: ${err.message}` }) };
  }
};
