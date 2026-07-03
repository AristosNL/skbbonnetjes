// _google.js
// Drive- en Sheets-helpers. Auth via OAuth refresh token (eigen account).
// Scope: drive.file + spreadsheets => app beheert alleen eigen bestanden.

const { google } = require('googleapis');
const { Readable } = require('stream');

const ROOT_FOLDER = 'Bonnen';
const SHEET_NAME = 'Bonnen-administratie';
const HEADER = [
  'Datum', 'Leverancier', 'Categorie', 'Excl. btw', 'Btw', 'Incl. btw',
  'Btw aftrekbaar', 'Review nodig', 'Bon', 'Vastgelegd op',
];

function clients() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return {
    drive: google.drive({ version: 'v3', auth }),
    sheets: google.sheets({ version: 'v4', auth }),
  };
}

const esc = (s) => String(s).replace(/'/g, "\\'");

async function ensureFolder(drive, name, parentId) {
  const q = [
    `name='${esc(name)}'`,
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
    `'${parentId || 'root'}' in parents`,
  ].join(' and ');
  const { data } = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
  if (data.files[0]) return data.files[0].id;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });
  return created.data.id;
}

// Bonnen/JJJJ/MM afgeleid uit datum DD-MM-YYYY
async function ensureFolderPath(drive, datum) {
  const [, mm, yyyy] = datum.split('-');
  const root = await ensureFolder(drive, ROOT_FOLDER, null);
  const jaar = await ensureFolder(drive, yyyy || 'onbekend', root);
  return ensureFolder(drive, mm || 'onbekend', jaar);
}

async function uploadImage(drive, folderId, name, mediaType, base64) {
  const { data } = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType: mediaType, body: Readable.from(Buffer.from(base64, 'base64')) },
    fields: 'id, webViewLink',
  });
  return data; // { id, webViewLink }
}

async function ensureSheet(drive, sheets) {
  const { data } = await drive.files.list({
    q: `name='${esc(SHEET_NAME)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id)', pageSize: 1,
  });
  if (data.files[0]) return data.files[0].id;
  const created = await sheets.spreadsheets.create({
    requestBody: { properties: { title: SHEET_NAME } },
    fields: 'spreadsheetId',
  });
  const id = created.data.spreadsheetId;
  await sheets.spreadsheets.values.update({
    spreadsheetId: id, range: 'A1', valueInputOption: 'RAW',
    requestBody: { values: [HEADER] },
  });
  return id;
}

async function appendRow(sheets, sheetId, row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId, range: 'A1',
    valueInputOption: 'RAW', // datum blijft tekst (geen date-coercion), getallen blijven getal
    requestBody: { values: [row] },
  });
}

async function readSheet(sheets, sheetId, range = 'A2:J') {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId, range, valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return data.values || [];
}

module.exports = { clients, ensureFolderPath, uploadImage, ensureSheet, appendRow, readSheet };
