import { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../lib/icons.jsx';
import { getReceipts, fmtEur, MONTHS, parseDatum, deleteReceipt, updateReceipt, invalidateReceipts, CATEGORIES } from '../lib/api.js';

const rowKey = (x) => `${x.datum}|${x.leverancier}|${x.incl}`;
const DATUM_RE = /^\d{2}-\d{2}-\d{4}$/;

export default function BonnenView() {
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [confirmKey, setConfirmKey] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [sort, setSort] = useState({ key: 'datum', dir: 'desc' });

  useEffect(() => { getReceipts().then(setReceipts).catch((e) => setError(e.message)); }, []);

  const years = useMemo(
    () => (receipts ? [...new Set(receipts.map((x) => parseDatum(x.datum).y).filter(Boolean))].sort((a, b) => b - a) : []),
    [receipts],
  );

  // Werkt een rij bij: optimistisch in de UI, met de oude waarden als matchsleutel voor de server.
  const patchRow = useCallback(async (x, patch) => {
    const k = rowKey(x);
    setBusyKey(k); setError('');
    const match = { datum: x.datum, leverancier: x.leverancier, incl: x.incl };
    setReceipts((rs) => rs.map((r) => (rowKey(r) === k ? { ...r, ...patch } : r)));
    try {
      await updateReceipt(match, patch);
      invalidateReceipts();
    } catch (e) {
      setError(e.message);
      setReceipts((rs) => rs.map((r) => (rowKey(r) === k ? { ...r, ...Object.fromEntries(Object.keys(patch).map((f) => [f, x[f]])) } : r)));
    } finally {
      setBusyKey(null);
    }
  }, []);

  const onDelete = useCallback(async (x) => {
    const k = rowKey(x);
    setBusyKey(k); setError('');
    try {
      await deleteReceipt(x.datum, x.leverancier, x.incl);
      invalidateReceipts();
      setReceipts((prev) => prev.filter((r) => rowKey(r) !== k));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null); setConfirmKey(null);
    }
  }, []);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const rows = useMemo(() => {
    let r = (receipts || []).slice();
    if (year !== 'all') r = r.filter((x) => parseDatum(x.datum).y === +year);
    if (month !== 'all') r = r.filter((x) => parseDatum(x.datum).m === +month);
    if (q.trim()) { const s = q.toLowerCase(); r = r.filter((x) => x.leverancier.toLowerCase().includes(s) || x.categorie.toLowerCase().includes(s)); }

    const dir = sort.dir === 'asc' ? 1 : -1;
    r.sort((a, b) => {
      let av, bv;
      if (sort.key === 'datum') {
        const A = parseDatum(a.datum), B = parseDatum(b.datum);
        av = A.y * 10000 + A.m * 100 + A.d; bv = B.y * 10000 + B.m * 100 + B.d;
      } else if (['excl', 'btw', 'incl'].includes(sort.key)) {
        av = a[sort.key]; bv = b[sort.key];
      } else {
        av = String(a[sort.key] || '').toLowerCase(); bv = String(b[sort.key] || '').toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return r;
  }, [receipts, q, year, month, sort]);

  const totaal = useMemo(() => rows.reduce((a, x) => a + x.incl, 0), [rows]);

  if (error && !receipts) return <div className="container"><div className="alert err">{error}</div></div>;
  if (!receipts) return <div className="container"><p className="page-sub">Laden…</p></div>;

  const Th = ({ field, children, right }) => (
    <th className={right ? 'r' : ''} onClick={() => toggleSort(field)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {children} <span style={{ opacity: sort.key === field ? 1 : 0.25 }}>{sort.key === field ? (sort.dir === 'asc' ? '▲' : '▼') : '▲'}</span>
    </th>
  );

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-title">Bonnetjes</h1>
        <p className="page-sub">{rows.length} bonnen · {fmtEur(totaal)} incl. btw</p>
      </div>

      {error && <div className="alert err">{error}</div>}

      <div className="filters">
        <div className="search"><Icon name="search" size={16} /><input placeholder="Zoek leverancier of categorie" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="pill-select" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="all">Alle jaren</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="pill-select" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">Alle maanden</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="card"><div className="empty"><h3>Geen bonnen gevonden</h3><p>Pas je filters aan of scan een nieuwe bon.</p></div></div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <Th field="datum">Datum</Th>
              <Th field="leverancier">Leverancier</Th>
              <Th field="categorie">Categorie</Th>
              <Th field="excl" right>Excl.</Th>
              <Th field="btw" right>Btw</Th>
              <Th field="incl" right>Incl.</Th>
              <th>Controle</th><th></th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((x) => {
                const k = rowKey(x);
                const busy = busyKey === k;
                return (
                  <tr key={k}>
                    <td><EditableText value={x.datum} pattern={DATUM_RE} disabled={busy} onSave={(v) => patchRow(x, { datum: v })} /></td>
                    <td className="ell"><EditableText value={x.leverancier} disabled={busy} onSave={(v) => patchRow(x, { leverancier: v })} /></td>
                    <td>
                      <select className="cat-select" value={x.categorie || 'overig'} disabled={busy} onChange={(e) => patchRow(x, { categorie: e.target.value })}>
                        {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="r"><EditableAmount value={x.excl} disabled={busy} onSave={(v) => patchRow(x, { excl: v })} /></td>
                    <td className="r"><EditableAmount value={x.btw} disabled={busy} onSave={(v) => patchRow(x, { btw: v })} /></td>
                    <td className="r"><EditableAmount value={x.incl} disabled={busy} onSave={(v) => patchRow(x, { incl: v })} /></td>
                    <td>
                      {x.review ? (
                        <button className="badge warn" style={{ border: 'none', cursor: 'pointer' }} disabled={busy} onClick={() => patchRow(x, { review: false })} title="Markeer als gecontroleerd">
                          controleren
                        </button>
                      ) : <span className="badge ok">gecontroleerd</span>}
                    </td>
                    <td>{x.bon && <a href={x.bon} target="_blank" rel="noreferrer" title="Bon openen"><Icon name="ext" size={16} /></a>}</td>
                    <td>
                      {confirmKey === k ? (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button style={{ background: 'var(--red-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 13 }} disabled={busy} onClick={() => onDelete(x)}>
                            {busy ? '…' : 'Zeker'}
                          </button>
                          <button className="btn-ghost btn-sm" onClick={() => setConfirmKey(null)}>Annuleer</button>
                        </span>
                      ) : (
                        <button className="btn-ghost btn-sm" title="Verwijderen" onClick={() => setConfirmKey(k)}><Icon name="trash" size={14} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Klik-om-te-bewerken tekstveld. Slaat op bij Enter/blur; Escape annuleert.
function EditableText({ value, onSave, disabled, pattern }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => { setVal(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (val === value) return;
    if (pattern && !pattern.test(val)) { setVal(value); return; }
    if (!val.trim()) { setVal(value); return; }
    onSave(val.trim());
  };

  if (!editing) {
    return <span onClick={() => !disabled && setEditing(true)} style={{ cursor: disabled ? 'default' : 'text', borderBottom: '1px dashed transparent' }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.borderBottomColor = 'var(--line)')} onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}>{value}</span>;
  }
  return (
    <input
      className="input" style={{ padding: '4px 6px', fontSize: 13.5, width: pattern ? 100 : 160 }}
      autoFocus value={val} onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
    />
  );
}

function EditableAmount({ value, onSave, disabled }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => { setVal(value); }, [value]);

  const commit = () => {
    setEditing(false);
    const n = Number(String(val).replace(',', '.'));
    if (Number.isNaN(n) || n === value) { setVal(value); return; }
    onSave(Math.round(n * 100) / 100);
  };

  if (!editing) {
    return <span onClick={() => !disabled && setEditing(true)} style={{ cursor: disabled ? 'default' : 'text', borderBottom: '1px dashed transparent' }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.borderBottomColor = 'var(--line)')} onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}>{fmtEur(value)}</span>;
  }
  return (
    <input
      className="num" autoFocus type="number" step="0.01" value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
    />
  );
}
