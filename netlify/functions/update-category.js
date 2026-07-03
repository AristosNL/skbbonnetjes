// update-category.js
// POST { datum, leverancier, incl, categorie } -> werkt kolom C (categorie) bij
// van de matchende rij. Match op dezelfde sleutel als dedup/delete.

const { clients, ensureSheet, readSheet } = require('./_google');
const { verify } = require('./_auth');
const { CATEGORIES } = require('./_receiptConfig');

const CORS = { 'Content-Type': 'application/json' };
const reply = (statusCode, obj) => ({ statusCode, headers: CORS, body: JSON.stringify(obj) });
const key = (d, l, i) => `${String(d).trim()}|${String(l).trim().toLowerCase()}|${Number(i).toFixed(2)}`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Gebruik POST.' });
  if (!verify(event)) return reply(401, { ok: false, error: 'Niet ingelogd.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { ok: false, error: 'Ongeldige JSON.' }); }
  const { datum, leverancier, incl, categorie } = body;
  if (!datum || !leverancier || incl == null || !categorie) return reply(400, { ok: false, error: 'datum, leverancier, incl en categorie zijn verplicht.' });
  if (!Object.prototype.hasOwnProperty.call(CATEGORIES, categorie)) return reply(400, { ok: false, error: 'Onbekende categorie.' });
  if (!process.env.GOOGLE_REFRESH_TOKEN) return reply(500, { ok: false, error: 'Google-credentials niet geconfigureerd.' });

  try {
    const { drive, sheets } = clients();
    const sheetId = await ensureSheet(drive, sheets);
    const rows = await readSheet(sheets, sheetId);

    const target = key(datum, leverancier, incl);
    const idx = rows.findIndex((r) => r[0] && key(r[0], r[1], r[5]) === target);
    if (idx === -1) return reply(404, { ok: false, error: 'Bon niet gevonden.' });

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId, range: `C${idx + 2}`, valueInputOption: 'RAW',
      requestBody: { values: [[categorie]] },
    });

    return reply(200, { ok: true });
  } catch (err) {
    return reply(502, { ok: false, error: `Bijwerken mislukt: ${err.message}` });
  }
};
