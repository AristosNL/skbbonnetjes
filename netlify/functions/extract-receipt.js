// extract-receipt.js
// POST { image_base64, media_type } -> { ok, data } | { ok:false, error }
// Roept Claude vision aan met geforceerde tool-use en valideert de rekensom.

const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT, RECEIPT_TOOL, enrich } = require('./_receiptConfig');
const { verify } = require('./_auth');

const MODEL = 'claude-sonnet-5'; // swap-baar; Sonnet is prima voor bonnen, Opus overkill
const ALLOWED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const CORS = {
  'Access-Control-Allow-Origin': '*', // zet in productie op je eigen domein
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const reply = (statusCode, obj) => ({ statusCode, headers: CORS, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Gebruik POST.' });
  if (!verify(event)) return reply(401, { ok: false, error: 'Niet ingelogd.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { ok: false, error: 'Ongeldige JSON in body.' });
  }

  const { image_base64, media_type } = body;
  if (!image_base64) return reply(400, { ok: false, error: 'image_base64 ontbreekt.' });
  if (!ALLOWED_MEDIA.includes(media_type)) {
    return reply(400, { ok: false, error: `media_type moet één van: ${ALLOWED_MEDIA.join(', ')}` });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return reply(500, { ok: false, error: 'ANTHROPIC_API_KEY niet geconfigureerd.' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const mediaBlock = media_type === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type, data: image_base64 } }
      : { type: 'image', source: { type: 'base64', media_type, data: image_base64 } };

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [RECEIPT_TOOL],
      tool_choice: { type: 'tool', name: RECEIPT_TOOL.name }, // dwingt schema-output af
      messages: [
        {
          role: 'user',
          content: [
            mediaBlock,
            { type: 'text', text: 'Lees deze bon uit en roep record_receipt aan.' },
          ],
        },
      ],
    });

    const toolUse = msg.content.find((c) => c.type === 'tool_use' && c.name === RECEIPT_TOOL.name);
    if (!toolUse) return reply(502, { ok: false, error: 'Model gaf geen gestructureerde output terug.' });

    return reply(200, { ok: true, data: enrich(toolUse.input) });
  } catch (err) {
    return reply(502, { ok: false, error: `Extractie mislukt: ${err.message}` });
  }
};
