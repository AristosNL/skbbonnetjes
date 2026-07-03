// ReceiptScanner.jsx
// Single-file component: foto -> extractie -> bewerkbaar review -> opslaan in Drive/Sheet.
// Twee modi: "Eén bon" (scan + review) en "Testmodus" (meerdere JPEG's batch-uitlezen).
// Endpoints: /.netlify/functions/extract-receipt en /save-receipt
// Stijl: gelijk aan de Km-registratie app (salie-groen + crème, Playfair/DM Sans).

import { useState, useMemo, useCallback } from 'react';

const CATEGORIES = {
  kantoorbenodigdheden: true,
  'software/abonnementen': true,
  reiskosten: true,
  brandstof: true,
  horeca: false,
  representatie: 'beperkt',
  hardware: true,
  overig: true,
};
const TOL = 0.02;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const AFTREK_TXT = { true: 'ja', false: 'nee', beperkt: 'beperkt' };
const eur = (n) => `€ ${(Number(n) || 0).toFixed(2)}`;
const buildPayload = (d) => ({
  leverancier: d.leverancier, datum: d.datum, valuta: d.valuta || 'EUR',
  btw_regels: d.btw_regels || [], bedrag_excl_btw: d.bedrag_excl_btw, btw_totaal: d.btw_totaal,
  bedrag_incl_btw: d.bedrag_incl_btw, categorie: d.categorie, leesbaarheid: d.leesbaarheid || 'goed',
  btw_aftrekbaar: CATEGORIES[d.categorie], needs_review: d.needs_review,
});

// --- Palet (Km-registratie app) ---
const SAGE = '#5a845c';
const SAGE_DK = '#456847';
const SAGE_50 = '#f4f7f4';
const LINE = '#e6ede6';
const CREAM = '#FAF7F2';
const INK = '#1C1C1E';
const BODY = "'DM Sans', system-ui, sans-serif";
const DISPLAY = "'Playfair Display', Georgia, serif";

async function toResizedBase64(file, max = 1600, quality = 0.8) {
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

async function extract(picture) {
  const res = await fetch('/.netlify/functions/extract-receipt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: picture.image_base64, media_type: picture.media_type }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

async function saveReceipt(data, image_base64, media_type) {
  const res = await fetch('/.netlify/functions/save-receipt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, image_base64, media_type }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error);
  return j;
}

function validate(d, incl) {
  const issues = [];
  if (!/^\d{2}-\d{2}-\d{4}$/.test(d.datum || '')) issues.push('datumformaat (DD-MM-JJJJ)');
  if (!CATEGORIES.hasOwnProperty(d.categorie)) issues.push('kies een categorie');
  const sumG = r2((d.btw_regels || []).reduce((a, x) => a + (Number(x.grondslag) || 0), 0));
  const sumB = r2((d.btw_regels || []).reduce((a, x) => a + (Number(x.btw) || 0), 0));
  if (Math.abs(r2(sumG + sumB) - r2(incl)) > TOL) issues.push('excl + btw ≠ incl');
  (d.btw_regels || []).forEach((x, i) => {
    const verwacht = r2((Number(x.grondslag) || 0) * (Number(x.tarief) || 0) / 100);
    if (Math.abs(verwacht - r2(x.btw)) > TOL) issues.push(`btw-regel ${i + 1} rekent niet`);
  });
  return issues;
}

const s = {
  page: { minHeight: '100%', background: CREAM },
  wrap: { maxWidth: 720, margin: '0 auto', padding: 20, fontFamily: BODY, color: INK },
  title: { fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, margin: '4px 0 12px' },
  seg: { display: 'inline-flex', border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden', marginBottom: 4 },
  segBtn: { padding: '8px 16px', border: 'none', background: '#fff', color: '#5a6b5b', fontSize: 14, cursor: 'pointer', fontFamily: BODY },
  segOn: { background: SAGE, color: '#fff' },
  card: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, marginTop: 14, boxShadow: '0 4px 16px rgba(90,132,92,0.06)' },
  row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 },
  label: { flex: '0 0 130px', fontSize: 13, color: '#5a6b5b' },
  input: { flex: 1, padding: '9px 11px', border: `1px solid #d6e0d6`, borderRadius: 10, fontSize: 14, minWidth: 0, fontFamily: BODY, color: INK, background: '#fff' },
  num: { width: 92, padding: '7px 9px', border: `1px solid #d6e0d6`, borderRadius: 10, fontSize: 14, textAlign: 'right', fontFamily: BODY },
  btn: { padding: '11px 20px', border: 'none', borderRadius: 10, background: SAGE, color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: BODY },
  btnGhost: { padding: '9px 14px', border: `1px solid ${SAGE}`, borderRadius: 10, background: '#fff', color: SAGE, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: BODY },
  warn: { background: '#fbf3e3', border: '1px solid #e6c98a', color: '#7a5200', borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 14 },
  ok: { background: '#eaf1ea', border: `1px solid #b9cdb9`, color: SAGE_DK, borderRadius: 12, padding: 12, fontSize: 14 },
  regel: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 },
  panel: { background: SAGE_50, border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, marginTop: 12 },
  total: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, padding: '5px 0' },
  section: { margin: '14px 0 6px', fontSize: 13, color: '#5a6b5b', fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 6px', borderBottom: `2px solid ${LINE}`, color: '#5a6b5b', fontWeight: 600, whiteSpace: 'nowrap' },
  td: { padding: '8px 6px', borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' },
  tdNum: { padding: '8px 6px', borderBottom: `1px solid ${LINE}`, textAlign: 'right', whiteSpace: 'nowrap' },
  pill: (bg, col) => ({ background: bg, color: col, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 500 }),
};

const STATUS = {
  wacht: ['#eef1ee', '#5a6b5b', 'wacht'],
  bezig: ['#fff6e5', '#7a5200', 'bezig…'],
  klaar: ['#eaf1ea', SAGE_DK, 'uitgelezen'],
  opslaan: ['#fff6e5', '#7a5200', 'opslaan…'],
  opgeslagen: [SAGE, '#fff', 'opgeslagen'],
  fout: ['#fbe3e3', '#8a1c0a', 'fout'],
};

export default function ReceiptScanner() {
  const [mode, setMode] = useState('single'); // single | test
  return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
      <div style={s.wrap}>
        <h2 style={s.title}>Bon scannen</h2>
        <div style={s.seg}>
          <button style={{ ...s.segBtn, ...(mode === 'single' ? s.segOn : {}) }} onClick={() => setMode('single')}>Eén bon</button>
          <button style={{ ...s.segBtn, ...(mode === 'test' ? s.segOn : {}) }} onClick={() => setMode('test')}>Testmodus</button>
        </div>
        {mode === 'single' ? <SingleFlow /> : <TestFlow />}
      </div>
    </div>
  );
}

// ---------- Eén bon ----------
function SingleFlow() {
  const [phase, setPhase] = useState('idle');
  const [img, setImg] = useState(null);
  const [form, setForm] = useState(null);
  const [incl, setIncl] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const excl = useMemo(() => r2((form?.btw_regels || []).reduce((a, x) => a + (Number(x.grondslag) || 0), 0)), [form]);
  const btw = useMemo(() => r2((form?.btw_regels || []).reduce((a, x) => a + (Number(x.btw) || 0), 0)), [form]);
  const issues = useMemo(() => (form ? validate(form, incl) : []), [form, incl]);
  const needsReview = issues.length > 0 || form?.leesbaarheid === 'slecht';

  const onFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setResult(null);
    const picture = await toResizedBase64(file);
    setImg(picture); setPhase('extracting');
    try {
      const data = await extract(picture);
      setForm({ ...data, btw_regels: data.btw_regels?.length ? data.btw_regels : [{ tarief: 21, grondslag: 0, btw: 0 }] });
      setIncl(data.bedrag_incl_btw ?? '');
      setPhase('review');
    } catch (err) { setError(err.message); setPhase('idle'); }
  }, []);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setRegel = (i, k, v) => setForm((f) => ({ ...f, btw_regels: f.btw_regels.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const addRegel = () => setForm((f) => ({ ...f, btw_regels: [...f.btw_regels, { tarief: 9, grondslag: 0, btw: 0 }] }));
  const delRegel = (i) => setForm((f) => ({ ...f, btw_regels: f.btw_regels.filter((_, j) => j !== i) }));

  const save = useCallback(async () => {
    setPhase('saving'); setError('');
    const data = {
      leverancier: form.leverancier, datum: form.datum, valuta: form.valuta || 'EUR',
      btw_regels: form.btw_regels.map((x) => ({ tarief: Number(x.tarief), grondslag: r2(x.grondslag), btw: r2(x.btw) })),
      bedrag_excl_btw: excl, btw_totaal: btw, bedrag_incl_btw: r2(incl),
      categorie: form.categorie, leesbaarheid: form.leesbaarheid || 'goed',
      btw_aftrekbaar: CATEGORIES[form.categorie], needs_review: needsReview, validation_issues: issues,
    };
    try { setResult(await saveReceipt(data, img.image_base64, img.media_type)); setPhase('done'); }
    catch (err) { setError(err.message); setPhase('review'); }
  }, [form, img, excl, btw, incl, needsReview, issues]);

  const reset = () => { setPhase('idle'); setImg(null); setForm(null); setIncl(''); setResult(null); setError(''); };

  return (
    <>
      {error && <div style={s.warn}>{error}</div>}

      {(phase === 'idle' || phase === 'extracting') && (
        <div style={s.card}>
          <label style={s.btn}>
            {phase === 'extracting' ? 'Uitlezen…' : 'Foto maken / kiezen'}
            <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={phase === 'extracting'} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      {phase === 'done' && (
        <div style={s.card}>
          <div style={s.ok}>Opgeslagen in Drive.</div>
          <p style={{ fontSize: 14 }}><a href={result.bon_link} target="_blank" rel="noreferrer" style={{ color: SAGE_DK }}>Bon openen</a></p>
          <button style={s.btn} onClick={reset}>Volgende bon</button>
        </div>
      )}

      {form && (phase === 'review' || phase === 'saving') && (
        <div style={s.card}>
          {img?.preview && <img src={img.preview} alt="bon" style={{ maxWidth: '100%', borderRadius: 12, marginBottom: 14 }} />}
          {needsReview && <div style={s.warn}>Controleer even — {issues.length ? issues.join('; ') : 'bon slecht leesbaar'}.</div>}

          <div style={s.row}><span style={s.label}>Leverancier</span>
            <input style={s.input} value={form.leverancier || ''} onChange={(e) => setField('leverancier', e.target.value)} /></div>
          <div style={s.row}><span style={s.label}>Datum</span>
            <input style={s.input} value={form.datum || ''} placeholder="DD-MM-JJJJ" onChange={(e) => setField('datum', e.target.value)} /></div>
          <div style={s.row}><span style={s.label}>Categorie</span>
            <select style={s.input} value={form.categorie || ''} onChange={(e) => setField('categorie', e.target.value)}>
              <option value="" disabled>kies…</option>
              {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div style={{ ...s.row, fontSize: 12, color: '#8a978b' }}><span style={s.label} />
            <span>btw aftrekbaar: {AFTREK_TXT[String(CATEGORIES[form.categorie])] ?? '—'}</span></div>

          <div style={s.section}>Btw-regels</div>
          {form.btw_regels.map((r, i) => (
            <div key={i} style={s.regel}>
              <input style={s.num} type="number" step="1" value={r.tarief ?? ''} onChange={(e) => setRegel(i, 'tarief', e.target.value)} />
              <span style={{ fontSize: 12 }}>%</span>
              <input style={s.num} type="number" step="0.01" value={r.grondslag ?? ''} placeholder="excl" onChange={(e) => setRegel(i, 'grondslag', e.target.value)} />
              <input style={s.num} type="number" step="0.01" value={r.btw ?? ''} placeholder="btw" onChange={(e) => setRegel(i, 'btw', e.target.value)} />
              <button style={s.btnGhost} onClick={() => delRegel(i)}>×</button>
            </div>
          ))}
          <button style={s.btnGhost} onClick={addRegel}>+ regel</button>

          <div style={s.panel}>
            <div style={s.total}><span>Excl. btw</span><span>{eur(excl)}</span></div>
            <div style={s.total}><span>Btw</span><span>{eur(btw)}</span></div>
            <div style={{ ...s.total, fontWeight: 600 }}><span>Incl. btw</span>
              <input style={{ ...s.num, fontWeight: 600 }} type="number" step="0.01" value={incl ?? ''} onChange={(e) => setIncl(e.target.value)} /></div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button style={s.btn} onClick={save} disabled={phase === 'saving'}>{phase === 'saving' ? 'Opslaan…' : 'Opslaan in Drive'}</button>
            <button style={s.btnGhost} onClick={reset}>Annuleren</button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Testmodus ----------
function TestFlow() {
  const [batch, setBatch] = useState([]);
  const [running, setRunning] = useState(false);
  const [autoSave, setAutoSave] = useState(true);

  const patch = (i, upd) => setBatch((b) => b.map((r, j) => (j === i ? { ...r, ...upd } : r)));

  const onFiles = useCallback(async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBatch(files.map((f) => ({ name: f.name, status: 'wacht' })));
    setRunning(true);
    for (let i = 0; i < files.length; i += 1) {
      patch(i, { status: 'bezig' });
      try {
        const pic = await toResizedBase64(files[i]);
        const data = await extract(pic);
        if (autoSave) {
          patch(i, { status: 'opslaan', data, img: pic });
          const r = await saveReceipt(buildPayload(data), pic.image_base64, pic.media_type);
          patch(i, { status: 'opgeslagen', data, img: pic, link: r.bon_link });
        } else {
          patch(i, { status: 'klaar', data, img: pic });
        }
      } catch (err) {
        patch(i, { status: 'fout', error: err.message });
      }
    }
    setRunning(false);
  }, [autoSave]);

  const saveOne = useCallback(async (i, row) => {
    if (!row.data) return;
    patch(i, { status: 'opslaan' });
    try { const r = await saveReceipt(buildPayload(row.data), row.img.image_base64, row.img.media_type); patch(i, { status: 'opgeslagen', link: r.bon_link }); }
    catch (err) { patch(i, { status: 'fout', error: err.message }); }
  }, []);

  const saveAll = useCallback(async () => {
    for (let i = 0; i < batch.length; i += 1) {
      const row = batch[i];
      if (row.status === 'klaar') await saveOne(i, row); // eslint-disable-line no-await-in-loop
    }
  }, [batch, saveOne]);

  const done = batch.filter((r) => r.status !== 'wacht' && r.status !== 'bezig').length;
  const savable = batch.some((r) => r.status === 'klaar');

  return (
    <>
      <div style={s.card}>
        <label style={s.btn}>
          {running ? `Verwerken… ${done}/${batch.length}` : 'JPEG\u2019s kiezen (meerdere)'}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} disabled={running} style={{ display: 'none' }} />
        </label>
        <label style={{ marginLeft: 12, fontSize: 13, color: '#5a6b5b', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} disabled={running} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Direct opslaan in Drive
        </label>
        {savable && !running && (
          <button style={{ ...s.btnGhost, marginLeft: 10 }} onClick={saveAll}>Rest opslaan</button>
        )}
      </div>

      {batch.length > 0 && (
        <div style={{ ...s.card, overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Bestand</th>
                <th style={s.th}>Leverancier</th>
                <th style={s.th}>Datum</th>
                <th style={s.th}>Categorie</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Excl.</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Btw</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Incl.</th>
                <th style={s.th}>Review</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {batch.map((r, i) => {
                const [bg, col, txt] = STATUS[r.status] || STATUS.wacht;
                const d = r.data;
                return (
                  <tr key={i}>
                    <td style={{ ...s.td, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.name}>{r.name}</td>
                    <td style={s.td}>{d?.leverancier ?? (r.error ? '—' : '')}</td>
                    <td style={s.td}>{d?.datum ?? ''}</td>
                    <td style={s.td}>{d?.categorie ?? ''}</td>
                    <td style={s.tdNum}>{d ? eur(d.bedrag_excl_btw) : ''}</td>
                    <td style={s.tdNum}>{d ? eur(d.btw_totaal) : ''}</td>
                    <td style={s.tdNum}>{d ? eur(d.bedrag_incl_btw) : ''}</td>
                    <td style={s.td}>{d ? (d.needs_review ? <span style={s.pill('#fbf3e3', '#7a5200')}>controleren</span> : <span style={s.pill('#eaf1ea', SAGE_DK)}>ok</span>) : ''}</td>
                    <td style={s.td}>
                      {r.status === 'klaar'
                        ? <button style={s.btnGhost} onClick={() => saveOne(i, r)}>Opslaan</button>
                        : r.status === 'opgeslagen'
                          ? <a href={r.link} target="_blank" rel="noreferrer" style={s.pill(bg, col)}>{txt}</a>
                          : <span style={s.pill(bg, col)} title={r.error || ''}>{txt}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
