import { useState, useEffect, useMemo } from 'react';
import Icon from '../lib/icons.jsx';
import { getReceipts, exportUrl, parseDatum, fmtEur } from '../lib/api.js';

export default function ExportView() {
  const [receipts, setReceipts] = useState(null);
  const [year, setYear] = useState(null);

  useEffect(() => {
    getReceipts().then((r) => {
      setReceipts(r);
      const ys = [...new Set(r.map((x) => parseDatum(x.datum).y).filter(Boolean))].sort((a, b) => b - a);
      setYear(ys[0] || new Date().getFullYear());
    }).catch(() => setReceipts([]));
  }, []);

  const years = useMemo(
    () => (receipts ? [...new Set(receipts.map((x) => parseDatum(x.datum).y).filter(Boolean))].sort((a, b) => b - a) : []),
    [receipts],
  );
  const rows = useMemo(() => (receipts || []).filter((x) => parseDatum(x.datum).y === year), [receipts, year]);
  const totaal = rows.reduce((a, x) => a + x.incl, 0);

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-title">Export</h1>
        <p className="page-sub">Een Excel-bestand voor je accountant: detailregels plus totalen per categorie, per maand en de btw-aftrekbaarheid.</p>
      </div>

      <div className="card" style={{ maxWidth: 460 }}>
        <div className="field"><label>Jaar</label>
          {years.length ? (
            <select className="select" value={year || ''} onChange={(e) => setYear(+e.target.value)}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          ) : <span className="page-sub">Nog geen bonnen om te exporteren.</span>}
        </div>

        {years.length > 0 && (
          <>
            <div className="panel">
              <div className="leader"><span className="lab">Bonnen in {year}</span><span className="dots" /><span className="amt">{rows.length}</span></div>
              <div className="leader total"><span className="lab">Totaal incl.</span><span className="dots" /><span className="amt">{fmtEur(totaal)}</span></div>
            </div>
            <a className="btn" style={{ marginTop: 16 }} href={exportUrl(year)}>
              <Icon name="download" size={18} /> Download Bonnen-{year}.xlsx
            </a>
          </>
        )}
      </div>
    </div>
  );
}
