// logout.js -> wist de auth-cookie.

const { clearCookieHeader } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: {}, body: '' };
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearCookieHeader() },
    body: JSON.stringify({ ok: true }),
  };
};
