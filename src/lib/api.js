// api.js — fetch-helpers + kleine cache voor de bonnenlijst.
const F = (p) => `/.netlify/functions/${p}`;

async function post(path, body) {
  const res = await fetch(F(path), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!j.ok) { const e = new Error(j.error || 'Er ging iets mis.'); e.duplicate = !!j.duplicate; throw e; }
  return j;
}

export const extractReceipt = (image_base64, media_type) => post('extract-receipt', { image_base64, media_type });
export const saveReceipt = (data, image_base64, media_type) => post('save-receipt', { data, image_base64, media_type });
export const login = (password) => post('login', { password });
export const logout = () => fetch(F('logout'), { method: 'POST' });
export const checkAuth = () => fetch(F('me')).then((r) => r.ok);
export const exportUrl = (year) => F(`export-xlsx?year=${year}`);
export const resetData = () => post('reset-data', { confirm: 'VERWIJDER' });

let _cache = null;
export async function getReceipts(force = false) {
  if (force || !_cache) {
    _cache = fetch(F('list-receipts')).then((r) => r.json());
  }
  const j = await _cache;
  if (!j.ok) { _cache = null; throw new Error(j.error || 'Ophalen mislukt.'); }
  return j.receipts;
}
export function invalidateReceipts() { _cache = null; }

// Helpers
export const fmtEur = (n) => (Number(n) || 0).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });
export const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const parseDatum = (s) => { const [d, m, y] = String(s || '').split('-'); return { d: +d, m: +m, y: +y }; };

export async function toResizedBase64(file, max = 1600, quality = 0.8) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
  const image_base64 = await new Promise((r) => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result.split(',')[1]);
    fr.readAsDataURL(blob);
  });
  return { image_base64, media_type: 'image/jpeg', preview: URL.createObjectURL(blob) };
}

const isPdf = (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

// Afbeeldingen worden verkleind; PDF's gaan ongewijzigd als document mee.
export async function filePayload(file) {
  if (isPdf(file)) {
    const b64 = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result.split(',')[1]);
      fr.readAsDataURL(file);
    });
    return { image_base64: b64, media_type: 'application/pdf', preview: null, isPdf: true, name: file.name };
  }
  return { ...(await toResizedBase64(file)), isPdf: false, name: file.name };
}

export const CATEGORIES = {
  kantoorbenodigdheden: null,
  'software/abonnementen': null,
  reiskosten: null,
  brandstof: null,
  horeca: null,
  representatie: null,
  hardware: null,
  overig: null,
};
// Vrijgestelde bv: voorbelasting niet aftrekbaar (btw = kostprijs).
export const VAT_DEDUCTIBLE = false;
export const btwAftrekbaar = () => VAT_DEDUCTIBLE;
