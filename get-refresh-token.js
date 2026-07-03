// get-refresh-token.js
// Eenmalig lokaal draaien om de GOOGLE_REFRESH_TOKEN op te halen.
//
//   export GOOGLE_CLIENT_ID=...
//   export GOOGLE_CLIENT_SECRET=...
//   node get-refresh-token.js
//
// Vereist: OAuth-client (type "Web application") met redirect-URI
//   http://localhost:53682

const http = require('http');
const { google } = require('googleapis');

const PORT = 53682;
const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `http://localhost:${PORT}`,
);

const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // forceert een refresh_token
  scope: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

console.log('\nOpen deze URL in je browser en geef toestemming:\n');
console.log(url, '\n');

http.createServer(async (req, res) => {
  const code = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('code');
  if (!code) { res.end('Geen code ontvangen.'); return; }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.end('Klaar. Sluit dit tabblad; de token staat in je terminal.');
    console.log('\n=== Zet dit in je Netlify env ===');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
  } catch (e) {
    res.end('Fout: ' + e.message);
  } finally {
    setTimeout(() => process.exit(0), 300);
  }
}).listen(PORT, () => console.log(`Wachten op redirect op http://localhost:${PORT} ...`));
