// update-receipt.js
// POST { match: {datum, leverancier, incl}, patch: {...} }
// Werkt losse velden van de matchende rij bij. `patch` mag elk van deze bevatten:
//   datum, leverancier, categorie, excl, btw, incl, review (boolean)
// Match gebeurt op de datum/leverancier/incl van vóór deze wijziging (dezelfde
// sleutel als dedup/delete), zodat je ook het bedrag of de datum zelf kunt corrigeren.

const { clients, ensureSheet, readSheet } = require('./_google');
const { verify } = require('./_auth');
const { CATEGORIES } = require('./_receiptConfig');

const CORS = { 'Content-Type': 'application/json' };
const reply = (statusCode, obj) => ({ statusCode, headers: CORS, body: JSON.stringify(obj) });
const key = (d, l, i) => `${String(d).trim()}|${String(l).trim().toLowerCase()}|${Number(i).toFixed(2)}`;

// kolomletter per patch-veld (A=datum, B=leverancier, C=categorie, D=excl, E=btw, F=incl, H=review)
const COL = { datum: 'A', leverancier: 'B', categorie: 'C', excl: 'D', btw: 'E', incl: 'F', review: 'H' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Gebruik POST.' });
  if (!verify(event)) return reply(401, { ok: false, error: 'Niet ingelogd.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { ok: false, error: 'Ongeldige JSON.' }); }

  const { match, patch } = body;
  if (!match?.datum || !match?.leverancier || match?.incl == null) {
    return reply(400, { ok: false, error: 'match (datum, leverancier, incl) is verplicht.' });
  }
  if (!patch || !Object.keys(patch).length) return reply(400, { ok: false, error: 'patch is leeg.' });
  if (patch.datum && !/^\d{2}-\d{2}-\d{4}$/.test(patch.datum)) return reply(400, { ok: false, error: 'datum moet DD-MM-JJJJ zijn.' });
  if (patch.categorie && !Object.prototype.hasOwnProperty.call(CATEGORIES, patch.categorie)) return reply(400, { ok: false, error: 'Onbekende categorie.' });
  if (!process.env.GOOGLE_REFRESH_TOKEN) return reply(500, { ok: false, error: 'Google-credentials niet geconfigureerd.' });

  try {
    const { drive, sheets } = clients();
    const sheetId = await ensureSheet(drive, sheets);
    const rows = await readSheet(sheets, sheetId);

    const target = key(match.datum, match.leverancier, match.incl);
    const idx = rows.findIndex((r) => r[0] && key(r[0], r[1], r[5]) === target);
    if (idx === -1) return reply(404, { ok: false, error: 'Bon niet gevonden (mogelijk gewijzigd of verwijderd — herlaad de lijst).' });

    const rowNum = idx + 2; // header + 1-indexed
    const data = [];
    for (const [f, col] of Object.entries(COL)) {
      if (!Object.prototype.hasOwnProperty.call(patch, f)) continue;
      const value = f === 'review' ? (patch.review ? 'JA' : '') : (['excl', 'btw', 'incl'].includes(f) ? Number(patch[f]) : patch[f]);
      data.push({ range: `${col}${rowNum}`, values: [[value]] });
    }
    if (!data.length) return reply(400, { ok: false, error: 'Geen geldige velden om bij te werken.' });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });

    return reply(200, { ok: true });
  } catch (err) {
    return reply(502, { ok: false, error: `Bijwerken mislukt: ${err.message}` });
  }
};
