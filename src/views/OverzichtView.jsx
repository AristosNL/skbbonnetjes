import { useState, useEffect, useMemo } from 'react';
import { getReceipts, fmtEur, MONTHS, MONTHS_SHORT, parseDatum, AFTREK_TXT } from '../lib/api.js';

export default function OverzichtView() {
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState('');
  const [year, setYear] = useState(null);

  useEffect(() => {
    getReceipts().then((r) => {
      setReceipts(r);
      const years = [...new Set(r.map((x) => parseDatum(x.datum).y).filter(Boolean))].sort((a, b) => b - a);
      setYear(years[0] || new Date().getFullYear());
    }).catch((e) => setError(e.message));
  }, []);

  const years = useMemo(
    () => (receipts ? [...new Set(receipts.map((x) => parseDatum(x.datum).y).filter(Boolean))].sort((a, b) => b - a) : []),
    [receipts],
  );
  const rows = useMemo(() => (receipts || []).filter((x) => parseDatum(x.datum).y === year), [receipts, year]);

  const kpi = useMemo(() => {
    const sum = (f) => rows.reduce((a, x) => a + x[f], 0);
    const aftrek = rows.filter((x) => x.aftrekbaar === 'ja').reduce((a, x) => a + x.btw, 0);
    return { aantal: rows.length, incl: sum('incl'), btw: sum('btw'), aftrek };
  }, [rows]);

  const perMonth = useMemo(() => {
    const m = Array.from({ length: 12 }, () => ({ aantal: 0, excl: 0, btw: 0, incl: 0 }));
    rows.forEach((x) => { const mi = parseDatum(x.datum).m - 1; if (mi >= 0 && mi < 12) { m[mi].aantal += 1; m[mi].excl += x.excl; m[mi].btw += x.btw; m[mi].incl += x.incl; } });
    return m;
  }, [rows]);

  const perCat = useMemo(() => {
    const map = {};
    rows.forEach((x) => { const c = x.categorie || 'overig'; (map[c] ||= { aantal: 0, excl: 0, btw: 0, incl: 0, aftrekbaar: x.aftrekbaar }); map[c].aantal += 1; map[c].excl += x.excl; map[c].btw += x.btw; map[c].incl += x.incl; });
    return Object.entries(map).sort((a, b) => b[1].incl - a[1].incl);
  }, [rows]);

  if (error) return <div className="container"><div className="alert err">{error}</div></div>;
  if (!receipts) return <div className="container"><p className="page-sub">Laden…</p></div>;

  const maxIncl = Math.max(1, ...perMonth.map((x) => x.incl));

  return (
    <div className="container">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Overzicht</h1>
          <p className="page-sub">Uitgaven per maand en categorie.</p>
        </div>
        {years.length > 0 && (
          <select className="pill-select" value={year} onChange={(e) => setYear(+e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="card"><div className="empty"><h3>Nog geen bonnen in {year}</h3><p>Scan je eerste bon om hier je overzicht te zien.</p></div></div>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi"><div className="k-lab">Bonnen</div><div className="k-val">{kpi.aantal}</div></div>
            <div className="kpi"><div className="k-lab">Totaal incl.</div><div className="k-val">{fmtEur(kpi.incl)}</div></div>
            <div className="kpi"><div className="k-lab">Btw totaal</div><div className="k-val">{fmtEur(kpi.btw)}</div></div>
            <div className="kpi"><div className="k-lab">Aftrekbare btw</div><div className="k-val">{fmtEur(kpi.aftrek)}</div></div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginBottom: 12 }}>Incl. btw per maand</div>
            <MonthBars data={perMonth} max={maxIncl} />
          </div>

          <div className="card tbl-wrap">
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>Per categorie</div>
            <table className="tbl">
              <thead><tr><th>Categorie</th><th className="r">Aantal</th><th className="r">Excl.</th><th className="r">Btw</th><th className="r">Incl.</th><th>Aftrekbaar</th></tr></thead>
              <tbody>
                {perCat.map(([c, v]) => (
                  <tr key={c}>
                    <td>{c}</td><td className="r">{v.aantal}</td><td className="r">{fmtEur(v.excl)}</td>
                    <td className="r">{fmtEur(v.btw)}</td><td className="r">{fmtEur(v.incl)}</td>
                    <td><span className={`badge ${v.aftrekbaar === 'ja' ? 'ok' : v.aftrekbaar === 'nee' ? 'err' : 'warn'}`}>{v.aftrekbaar || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MonthBars({ data, max }) {
  const W = 640, H = 200, pad = 28, bw = (W - pad * 2) / 12;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Uitgaven per maand">
      {data.map((m, i) => {
        const h = (m.incl / max) * (H - 46);
        const x = pad + i * bw;
        return (
          <g key={i}>
            {m.incl > 0 && <text className="glabel" x={x + bw / 2} y={H - 34 - h - 4} textAnchor="middle">{Math.round(m.incl)}</text>}
            <rect className="bar" x={x + 4} y={H - 34 - h} width={bw - 8} height={h} rx="4">
              <title>{`${MONTHS[i]}: ${fmtEur(m.incl)} (${m.aantal})`}</title>
            </rect>
            <text className="axis" x={x + bw / 2} y={H - 14} textAnchor="middle">{MONTHS_SHORT[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
