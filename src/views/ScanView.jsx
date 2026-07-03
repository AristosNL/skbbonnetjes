import { useState, useMemo, useCallback } from 'react';
import Icon from '../lib/icons.jsx';
import {
  extractReceipt, saveReceipt, invalidateReceipts,
  toResizedBase64, fmtEur, CATEGORIES, AFTREK_TXT,
} from '../lib/api.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const TOL = 0.02;

function validate(d, incl) {
  const issues = [];
  if (!/^\d{2}-\d{2}-\d{4}$/.test(d.datum || '')) issues.push('datum als DD-MM-JJJJ');
  if (!Object.prototype.hasOwnProperty.call(CATEGORIES, d.categorie)) issues.push('kies een categorie');
  const g = r2((d.btw_regels || []).reduce((a, x) => a + (Number(x.grondslag) || 0), 0));
  const b = r2((d.btw_regels || []).reduce((a, x) => a + (Number(x.btw) || 0), 0));
  if (Math.abs(r2(g + b) - r2(incl)) > TOL) issues.push('excl + btw ≠ incl');
  (d.btw_regels || []).forEach((x, i) => {
    const exp = r2((Number(x.grondslag) || 0) * (Number(x.tarief) || 0) / 100);
    if (Math.abs(exp - r2(x.btw)) > TOL) issues.push(`btw-regel ${i + 1} rekent niet`);
  });
  return issues;
}
const buildPayload = (d) => ({
  leverancier: d.leverancier, datum: d.datum, valuta: d.valuta || 'EUR',
  btw_regels: d.btw_regels || [], bedrag_excl_btw: d.bedrag_excl_btw, btw_totaal: d.btw_totaal,
  bedrag_incl_btw: d.bedrag_incl_btw, categorie: d.categorie, leesbaarheid: d.leesbaarheid || 'goed',
  btw_aftrekbaar: CATEGORIES[d.categorie], needs_review: d.needs_review,
});

export default function ScanView() {
  const [mode, setMode] = useState('single');
  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-title">Scannen</h1>
        <p className="page-sub">Maak een foto of kies een bestand. De gegevens worden automatisch uitgelezen.</p>
      </div>
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={mode === 'single' ? 'on' : ''} onClick={() => setMode('single')}>Eén bon</button>
        <button className={mode === 'test' ? 'on' : ''} onClick={() => setMode('test')}>Meerdere importeren</button>
      </div>
      {mode === 'single' ? <Single /> : <Batch />}
    </div>
  );
}

function Single() {
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
    const pic = await toResizedBase64(file);
    setImg(pic); setPhase('extracting');
    try {
      const { data } = await extractReceipt(pic.image_base64, pic.media_type);
      setForm({ ...data, btw_regels: data.btw_regels?.length ? data.btw_regels : [{ tarief: 21, grondslag: 0, btw: 0 }] });
      setIncl(data.bedrag_incl_btw ?? '');
      setPhase('review');
    } catch (err) { setError(err.message); setPhase('idle'); }
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setR = (i, k, v) => setForm((f) => ({ ...f, btw_regels: f.btw_regels.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const addR = () => setForm((f) => ({ ...f, btw_regels: [...f.btw_regels, { tarief: 9, grondslag: 0, btw: 0 }] }));
  const delR = (i) => setForm((f) => ({ ...f, btw_regels: f.btw_regels.filter((_, j) => j !== i) }));

  const save = useCallback(async () => {
    setPhase('saving'); setError('');
    const data = { ...buildPayload(form), bedrag_excl_btw: excl, btw_totaal: btw, bedrag_incl_btw: r2(incl), needs_review: needsReview, validation_issues: issues };
    try { const r = await saveReceipt(data, img.image_base64, img.media_type); invalidateReceipts(); setResult(r); setPhase('done'); }
    catch (err) { setError(err.message); setPhase('review'); }
  }, [form, img, excl, btw, incl, needsReview, issues]);

  const reset = () => { setPhase('idle'); setImg(null); setForm(null); setIncl(''); setResult(null); setError(''); };

  return (
    <>
      {error && <div className="alert err">{error}</div>}

      {(phase === 'idle' || phase === 'extracting') && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <label className="btn" style={{ cursor: 'pointer' }}>
            <Icon name="camera" size={18} />
            {phase === 'extracting' ? 'Uitlezen…' : 'Bon kiezen'}
            <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={phase === 'extracting'} style={{ display: 'none' }} />
          </label>
          <p className="page-sub" style={{ marginTop: 14 }}>JPEG, PNG of WebP</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="card">
          <div className="alert ok" style={{ marginBottom: 14 }}><Icon name="check" size={16} /> Opgeslagen in Drive.</div>
          <a className="btn-ghost" href={result.bon_link} target="_blank" rel="noreferrer"><Icon name="ext" size={16} /> Bon openen</a>
          <button className="btn" style={{ marginLeft: 8 }} onClick={reset}>Volgende bon</button>
        </div>
      )}

      {form && (phase === 'review' || phase === 'saving') && (
        <div className="card">
          {img?.preview && <img src={img.preview} alt="bon" style={{ maxWidth: '100%', borderRadius: 12, marginBottom: 16 }} />}
          {needsReview && <div className="alert warn"><Icon name="alert" size={15} /> Controleer even — {issues.length ? issues.join('; ') : 'bon slecht leesbaar'}.</div>}

          <div className="field"><label>Leverancier</label><input className="input" value={form.leverancier || ''} onChange={(e) => set('leverancier', e.target.value)} /></div>
          <div className="field"><label>Datum</label><input className="input" value={form.datum || ''} placeholder="DD-MM-JJJJ" onChange={(e) => set('datum', e.target.value)} /></div>
          <div className="field"><label>Categorie</label>
            <select className="select" value={form.categorie || ''} onChange={(e) => set('categorie', e.target.value)}>
              <option value="" disabled>kies…</option>
              {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label /><span style={{ fontSize: 12, color: 'var(--muted)' }}>btw aftrekbaar: {AFTREK_TXT[String(CATEGORIES[form.categorie])] ?? '—'}</span></div>

          <div style={{ margin: '14px 0 8px', fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>Btw-regels</div>
          {form.btw_regels.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <input className="num" type="number" step="1" value={r.tarief ?? ''} onChange={(e) => setR(i, 'tarief', e.target.value)} /><span style={{ fontSize: 12 }}>%</span>
              <input className="num" type="number" step="0.01" value={r.grondslag ?? ''} placeholder="excl" onChange={(e) => setR(i, 'grondslag', e.target.value)} />
              <input className="num" type="number" step="0.01" value={r.btw ?? ''} placeholder="btw" onChange={(e) => setR(i, 'btw', e.target.value)} />
              <button className="btn-ghost btn-sm" onClick={() => delR(i)}><Icon name="x" size={14} /></button>
            </div>
          ))}
          <button className="btn-ghost btn-sm" onClick={addR}><Icon name="plus" size={14} /> regel</button>

          <div className="panel">
            <div className="leader"><span className="lab">Excl. btw</span><span className="dots" /><span className="amt">{fmtEur(excl)}</span></div>
            <div className="leader"><span className="lab">Btw</span><span className="dots" /><span className="amt">{fmtEur(btw)}</span></div>
            <div className="leader total"><span className="lab">Incl. btw</span><span className="dots" />
              <input className="num" style={{ fontWeight: 600 }} type="number" step="0.01" value={incl ?? ''} onChange={(e) => setIncl(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
            <button className="btn" onClick={save} disabled={phase === 'saving'}>{phase === 'saving' ? 'Opslaan…' : 'Opslaan in Drive'}</button>
            <button className="btn-ghost" onClick={reset}>Annuleren</button>
          </div>
        </div>
      )}
    </>
  );
}

const STATUS = {
  wacht: ['mute', 'wacht'], bezig: ['warn', 'bezig…'], klaar: ['ok', 'uitgelezen'],
  opslaan: ['warn', 'opslaan…'], opgeslagen: ['ok', 'opgeslagen'], fout: ['err', 'fout'],
};

function Batch() {
  const [batch, setBatch] = useState([]);
  const [running, setRunning] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const patch = (i, u) => setBatch((b) => b.map((r, j) => (j === i ? { ...r, ...u } : r)));

  const onFiles = useCallback(async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBatch(files.map((f) => ({ name: f.name, status: 'wacht' })));
    setRunning(true);
    let saved = false;
    for (let i = 0; i < files.length; i += 1) {
      patch(i, { status: 'bezig' });
      try {
        const pic = await toResizedBase64(files[i]);
        const { data } = await extractReceipt(pic.image_base64, pic.media_type);
        if (autoSave) {
          patch(i, { status: 'opslaan', data, img: pic });
          const r = await saveReceipt(buildPayload(data), pic.image_base64, pic.media_type);
          patch(i, { status: 'opgeslagen', data, img: pic, link: r.bon_link }); saved = true;
        } else {
          patch(i, { status: 'klaar', data, img: pic });
        }
      } catch (err) { patch(i, { status: 'fout', error: err.message }); }
    }
    if (saved) invalidateReceipts();
    setRunning(false);
  }, [autoSave]);

  const saveOne = useCallback(async (i, row) => {
    if (!row.data) return;
    patch(i, { status: 'opslaan' });
    try { const r = await saveReceipt(buildPayload(row.data), row.img.image_base64, row.img.media_type); invalidateReceipts(); patch(i, { status: 'opgeslagen', link: r.bon_link }); }
    catch (err) { patch(i, { status: 'fout', error: err.message }); }
  }, []);

  const saveAll = useCallback(async () => {
    for (let i = 0; i < batch.length; i += 1) if (batch[i].status === 'klaar') await saveOne(i, batch[i]); // eslint-disable-line no-await-in-loop
  }, [batch, saveOne]);

  const done = batch.filter((r) => r.status !== 'wacht' && r.status !== 'bezig').length;
  const savable = batch.some((r) => r.status === 'klaar');

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label className="btn" style={{ cursor: 'pointer' }}>
            <Icon name="camera" size={18} />
            {running ? `Verwerken… ${done}/${batch.length}` : 'Bestanden kiezen'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} disabled={running} style={{ display: 'none' }} />
          </label>
          <label className="check"><input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} disabled={running} /> Direct opslaan in Drive</label>
          {savable && !running && <button className="btn-ghost" onClick={saveAll}>Rest opslaan</button>}
        </div>
      </div>

      {batch.length > 0 && (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Bestand</th><th>Leverancier</th><th>Datum</th><th>Categorie</th>
              <th className="r">Excl.</th><th className="r">Btw</th><th className="r">Incl.</th><th>Controle</th><th>Status</th>
            </tr></thead>
            <tbody>
              {batch.map((r, i) => {
                const [cls, txt] = STATUS[r.status] || STATUS.wacht;
                const d = r.data;
                return (
                  <tr key={i}>
                    <td className="ell" title={r.name}>{r.name}</td>
                    <td>{d?.leverancier ?? (r.error ? '—' : '')}</td>
                    <td>{d?.datum ?? ''}</td>
                    <td>{d?.categorie ?? ''}</td>
                    <td className="r">{d ? fmtEur(d.bedrag_excl_btw) : ''}</td>
                    <td className="r">{d ? fmtEur(d.btw_totaal) : ''}</td>
                    <td className="r">{d ? fmtEur(d.bedrag_incl_btw) : ''}</td>
                    <td>{d ? (d.needs_review ? <span className="badge warn">controleren</span> : <span className="badge ok">ok</span>) : ''}</td>
                    <td>
                      {r.status === 'klaar'
                        ? <button className="btn-ghost btn-sm" onClick={() => saveOne(i, r)}>Opslaan</button>
                        : r.status === 'opgeslagen' && r.link
                          ? <a className={`badge ${cls}`} href={r.link} target="_blank" rel="noreferrer">{txt}</a>
                          : <span className={`badge ${cls}`} title={r.error || ''}>{txt}</span>}
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
