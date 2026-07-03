// save-receipt.js
// POST { data, image_base64, media_type }
//   data = geverifieerde output van extract-receipt
// -> uploadt de bon naar Bonnen/JJJJ/MM en voegt een regel toe aan het overzicht.

const { clients, ensureFolderPath, uploadImage, ensureSheet, appendRow, readSheet } = require('./_google');
const { verify } = require('./_auth');

const CORS = {
  'Access-Control-Allow-Origin': '*', // in productie: eigen domein
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};
const reply = (statusCode, obj) => ({ statusCode, headers: CORS, body: JSON.stringify(obj) });

const AFTREK_TXT = { true: 'ja', false: 'nee', beperkt: 'beperkt' };
const clean = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);
// Inhoudssleutel voor dedup: datum | leverancier | incl-bedrag.
const dupKey = (datum, leverancier, incl) => `${String(datum).trim()}|${String(leverancier).trim().toLowerCase()}|${Number(incl).toFixed(2)}`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Gebruik POST.' });
  if (!verify(event)) return reply(401, { ok: false, error: 'Niet ingelogd.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { ok: false, error: 'Ongeldige JSON.' }); }

  const { data, image_base64, media_type } = body;
  if (!data || !image_base64 || !media_type) {
    return reply(400, { ok: false, error: 'data, image_base64 en media_type zijn verplicht.' });
  }
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return reply(500, { ok: false, error: 'Google-credentials niet geconfigureerd.' });
  }

  try {
    const { drive, sheets } = clients();
    const sheetId = await ensureSheet(drive, sheets);

    // Duplicaatcontrole op datum + leverancier + incl-bedrag.
    const bestaande = await readSheet(sheets, sheetId);
    const key = dupKey(data.datum, data.leverancier, data.bedrag_incl_btw);
    const isDup = bestaande.some((r) => r[0] && dupKey(r[0], r[1], r[5]) === key);
    if (isDup) {
      return reply(409, { ok: false, duplicate: true, error: 'Deze bon is al ingeladen (zelfde datum, leverancier en bedrag).' });
    }

    const ext = media_type === 'application/pdf' ? 'pdf'
      : media_type === 'image/png' ? 'png'
        : media_type === 'image/webp' ? 'webp' : 'jpg';
    const bestandsnaam = `${clean(data.datum)}_${clean(data.leverancier)}_${data.bedrag_incl_btw}.${ext}`;

    const folderId = await ensureFolderPath(drive, data.datum);
    const file = await uploadImage(drive, folderId, bestandsnaam, media_type, image_base64);

    const row = [
      data.datum,
      data.leverancier,
      data.categorie,
      data.bedrag_excl_btw,
      data.btw_totaal,
      data.bedrag_incl_btw,
      AFTREK_TXT[String(data.btw_aftrekbaar)] ?? '',
      data.needs_review ? 'JA' : '',
      file.webViewLink,
      new Date().toISOString().slice(0, 19).replace('T', ' '),
    ];
    await appendRow(sheets, sheetId, row);

    return reply(200, { ok: true, bon_link: file.webViewLink, file_id: file.id, sheet_id: sheetId });
  } catch (err) {
    return reply(502, { ok: false, error: `Opslaan mislukt: ${err.message}` });
  }
};
