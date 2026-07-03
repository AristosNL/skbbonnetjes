# Bonnen-app

Foto van een bon → Claude leest leverancier, datum, btw en categorie uit → afbeelding naar Google Drive, regel naar een Sheet, jaarexport naar Excel.

## Bestanden

| Bestand | Rol |
|---|---|
| `src/ReceiptScanner.jsx` | Frontend: foto → review → opslaan |
| `netlify/functions/extract-receipt.js` | Bon uitlezen (Claude vision) |
| `netlify/functions/save-receipt.js` | Naar Drive + Sheet |
| `netlify/functions/export-xlsx.js` | Jaarexport `.xlsx` |
| `netlify/functions/_receiptConfig.js` | Prompt, schema, categorieën, validatie |
| `netlify/functions/_google.js` | Drive/Sheets-helpers |
| `netlify/functions/_xlsx.js` | Excel-generator |
| `get-refresh-token.js` | Eenmalig: Google refresh token ophalen |

## Endpoints

| Endpoint | Methode | In → uit |
|---|---|---|
| `/login` | POST | `{password}` → cookie bij match met `APP_PASSWORD` |
| `/logout` | POST | wist de cookie |
| `/me` | GET | 200 = ingelogd, 401 = niet |
| `/list-receipts` | GET | → `{receipts:[…]}` (voor Overzicht en Bonnetjes) |
| `/delete-receipt` | POST | `{datum, leverancier, incl}` → verwijdert rij + trasht Drive-bestand |
| `/update-category` | POST | `{datum, leverancier, incl, categorie}` → herrubriceert een bon |
| `/extract-receipt` | POST | `{image_base64, media_type}` → gevalideerde bon-JSON (401 zonder cookie) |
| `/save-receipt` | POST | `{data, image_base64, media_type}` → `{bon_link, sheet_id}` (401 zonder cookie) |
| `/export-xlsx?year=2026` | GET | → `.xlsx`-download (401 zonder cookie) |

## Env-vars (Netlify)

| Var | Waar vandaan |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth-client |
| `GOOGLE_CLIENT_SECRET` | idem |
| `GOOGLE_REFRESH_TOKEN` | `get-refresh-token.js` |
| `APP_PASSWORD` | zelf kiezen — login-wachtwoord |
| `COOKIE_SECRET` | zelf genereren: `openssl rand -hex 32` |

## Installatie

1. **Repo klaarzetten**
   ```bash
   npm install
   npm i -g netlify-cli   # als je die nog niet hebt
   ```

2. **Anthropic key** aanmaken op console.anthropic.com.

3. **Google Cloud** (console.cloud.google.com):
   - Nieuw project → APIs & Services.
   - Zet **Google Drive API** en **Google Sheets API** aan.
   - OAuth consent screen: External, jouw e-mail als testgebruiker.
   - Credentials → OAuth client ID → **Web application**, redirect-URI `http://localhost:53682`. Noteer id + secret.

4. **Refresh token ophalen** (eenmalig, lokaal):
   ```bash
   export GOOGLE_CLIENT_ID=...
   export GOOGLE_CLIENT_SECRET=...
   node get-refresh-token.js      # open de URL, geef toestemming
   ```

5. **Netlify koppelen en env zetten**:
   ```bash
   netlify init                   # koppel de repo aan een site
   netlify env:set ANTHROPIC_API_KEY ...
   netlify env:set GOOGLE_CLIENT_ID ...
   netlify env:set GOOGLE_CLIENT_SECRET ...
   netlify env:set GOOGLE_REFRESH_TOKEN ...
   netlify env:set APP_PASSWORD ...
   netlify env:set COOKIE_SECRET $(openssl rand -hex 32)
   ```

6. **Lokaal testen**:
   ```bash
   netlify dev                    # app + functions op http://localhost:8888
   ```
   Map `Bonnen/JJJJ/MM` en het bestand `Bonnen-administratie` worden bij de eerste bon vanzelf aangemaakt.

7. **Live**:
   ```bash
   netlify deploy --prod
   ```

## Aandachtspunten

Zet in productie `Access-Control-Allow-Origin` in de functions op je eigen domein i.p.v. `*`. De foto wordt client-side verkleind vóór upload (6 MB-limiet). Verifieer de actuele BUA-drempel voor representatie voordat je op de aftrekbaarheids-splitsing vertrouwt voor de aangifte.
