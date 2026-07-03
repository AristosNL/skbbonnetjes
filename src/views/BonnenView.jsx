import { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../lib/icons.jsx';
import { getReceipts, fmtEur, MONTHS, parseDatum, deleteReceipt, updateCategory, invalidateReceipts, CATEGORIES } from '../lib/api.js';

export default function BonnenView() {
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [confirmKey, setConfirmKey] = useState(null); // datum|leverancier|incl van rij die bevestiging vraagt
  const [busyKey, setBusyKey] = useState(null);

  const load = useCallback(() => { getReceipts().then(setReceipts).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  const years = useMemo(
    () => (receipts ? [...new Set(receipts.map((x) => parseDatum(x.datum).y).filter(Boolean))].sort((a, b) => b - a) : []),
    [receipts],
  );

  const rows = useMemo(() => {
    let r = (receipts || []).slice();
    if (year !== 'all') r = r.filter((x) => parseDatum(x.datum).y === +year);
    if (month !== 'all') r = r.filter((x) => parseDatum(x.datum).m === +month);
    if (q.trim()) { const s = q.toLowerCase(); r = r.filter((x) => x.leverancier.toLowerCase().includes(s) || x.categorie.toLowerCase().includes(s)); }
    return r.sort((a, b) => {
      const A = parseDatum(a.datum), B = parseDatum(b.datum);
      return (B.y - A.y) || (B.m - A.m) || (B.d - A.d);
    });
  }, [receipts, q, year, month]);

  const totaal = useMemo(() => rows.reduce((a, x) => a + x.incl, 0), [rows]);
  const rowKey = (x) => `${x.datum}|${x.leverancier}|${x.incl}`;

  const onCategory = useCallback(async (x, categorie) => {
    const k = rowKey(x);
    const prev = x.categorie;
    setReceipts((rs) => rs.map((r) => (rowKey(r) === k ? { ...r, categorie } : r)));
    try { await updateCategory(x.datum, x.leverancier, x.incl, categorie); invalidateReceipts(); }
    catch (e) { setError(e.message); setReceipts((rs) => rs.map((r) => (rowKey(r) === k ? { ...r, categorie: prev } : r))); }
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

  if (error) return <div className="container"><div className="alert err">{error}</div></div>;
  if (!receipts) return <div className="container"><p className="page-sub">Laden…</p></div>;

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-title">Bonnetjes</h1>
        <p className="page-sub">{rows.length} bonnen · {fmtEur(totaal)} incl. btw</p>
      </div>

      <div className="filters">
        <div className="search"><Icon name="search" size={16} /><input placeholder="Zoek leverancier of categorie" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="pill-select" value={year} onChange={(e) => { setYear(e.target.value); }}>
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
              <th>Datum</th><th>Leverancier</th><th>Categorie</th>
              <th className="r">Excl.</th><th className="r">Btw</th><th className="r">Incl.</th><th></th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((x) => {
                const k = rowKey(x);
                return (
                  <tr key={k}>
                    <td>{x.datum}</td>
                    <td className="ell" title={x.leverancier}>{x.leverancier}{x.review && <span className="badge warn" style={{ marginLeft: 6 }}>controleren</span>}</td>
                    <td>
                      <select className="cat-select" value={x.categorie || 'overig'} onChange={(e) => onCategory(x, e.target.value)}>
                        {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="r">{fmtEur(x.excl)}</td>
                    <td className="r">{fmtEur(x.btw)}</td>
                    <td className="r">{fmtEur(x.incl)}</td>
                    <td>{x.bon && <a href={x.bon} target="_blank" rel="noreferrer" title="Bon openen"><Icon name="ext" size={16} /></a>}</td>
                    <td>
                      {confirmKey === k ? (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="btn-sm" style={{ background: 'var(--red-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }} disabled={busyKey === k} onClick={() => onDelete(x)}>
                            {busyKey === k ? '…' : 'Zeker'}
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
