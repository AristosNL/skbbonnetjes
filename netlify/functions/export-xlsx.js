// export-xlsx.js
// GET /.netlify/functions/export-xlsx?year=2026
// Leest de Bonnen-administratie-Sheet en levert een .xlsx-download voor dat jaar.

const { clients, ensureSheet, readSheet } = require('./_google');
const { buildWorkbook } = require('./_xlsx');
const { verify } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Gebruik GET.' };
  }
  if (!verify(event)) return { statusCode: 401, body: 'Niet ingelogd.' };
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return { statusCode: 500, body: 'Google-credentials niet geconfigureerd.' };
  }

  const year = String(event.queryStringParameters?.year || new Date().getFullYear());

  try {
    const { drive, sheets } = clients();
    const sheetId = await ensureSheet(drive, sheets);
    const all = await readSheet(sheets, sheetId);           // rijen vanaf A2
    const rows = all.filter((r) => String(r[0] || '').endsWith(`-${year}`));

    const wb = buildWorkbook(rows, year);
    const buffer = await wb.xlsx.writeBuffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Bonnen-${year}.xlsx"`,
      },
      body: Buffer.from(buffer).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 502, body: `Export mislukt: ${err.message}` };
  }
};
