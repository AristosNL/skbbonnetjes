// me.js -> 200 als cookie geldig is, anders 401. Gebruikt door de frontend
// bij het laden om te bepalen of het loginscherm getoond moet worden.

const { verify } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: {}, body: '' };
  const ok = verify(event);
  return { statusCode: ok ? 200 : 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok }) };
};
