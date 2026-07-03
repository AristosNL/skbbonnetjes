// delete-receipt.js
// POST { datum, leverancier, incl } -> verwijdert de matchende rij uit de Sheet
// en trasht het bijbehorende Drive-bestand. Match op dezelfde sleutel als dedup.

const { clients, ensureSheet, readSheet, deleteRow, trashFileByUrl } = require('./_google');
const { verify } = require('./_auth');

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
  const { datum, leverancier, incl } = body;
  if (!datum || !leverancier || incl == null) return reply(400, { ok: false, error: 'datum, leverancier en incl zijn verplicht.' });
  if (!process.env.GOOGLE_REFRESH_TOKEN) return reply(500, { ok: false, error: 'Google-credentials niet geconfigureerd.' });

  try {
    const { drive, sheets } = clients();
    const sheetId = await ensureSheet(drive, sheets);
    const rows = await readSheet(sheets, sheetId); // vanaf A2

    const target = key(datum, leverancier, incl);
    const idx = rows.findIndex((r) => r[0] && key(r[0], r[1], r[5]) === target);
    if (idx === -1) return reply(404, { ok: false, error: 'Bon niet gevonden (mogelijk al verwijderd).' });

    const bonUrl = rows[idx][8];
    await deleteRow(sheets, sheetId, idx + 2); // +2: header + 1-indexed
    if (bonUrl) await trashFileByUrl(drive, bonUrl).catch(() => {}); // rij-verwijdering mag niet stranden op een file-fout

    return reply(200, { ok: true });
  } catch (err) {
    return reply(502, { ok: false, error: `Verwijderen mislukt: ${err.message}` });
  }
};
