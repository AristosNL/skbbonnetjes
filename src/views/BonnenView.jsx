import { useState, useEffect, useMemo } from 'react';
import Icon from '../lib/icons.jsx';
import { getReceipts, fmtEur, MONTHS, parseDatum } from '../lib/api.js';

export default function BonnenView() {
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');

  useEffect(() => { getReceipts().then(setReceipts).catch((e) => setError(e.message)); }, []);

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
              <th className="r">Excl.</th><th className="r">Btw</th><th className="r">Incl.</th><th>Aftrekbaar</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((x, i) => (
                <tr key={i}>
                  <td>{x.datum}</td>
                  <td className="ell" title={x.leverancier}>{x.leverancier}{x.review && <span className="badge warn" style={{ marginLeft: 6 }}>controleren</span>}</td>
                  <td>{x.categorie}</td>
                  <td className="r">{fmtEur(x.excl)}</td>
                  <td className="r">{fmtEur(x.btw)}</td>
                  <td className="r">{fmtEur(x.incl)}</td>
                  <td><span className={`badge ${x.aftrekbaar === 'ja' ? 'ok' : x.aftrekbaar === 'nee' ? 'err' : 'warn'}`}>{x.aftrekbaar || '—'}</span></td>
                  <td>{x.bon && <a href={x.bon} target="_blank" rel="noreferrer" title="Bon openen"><Icon name="ext" size={16} /></a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
