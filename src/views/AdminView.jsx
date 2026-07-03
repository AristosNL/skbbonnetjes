import { useState } from 'react';
import Icon from '../lib/icons.jsx';
import { resetData, invalidateReceipts } from '../lib/api.js';

export default function AdminView() {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState('');

  const doReset = async () => {
    setBusy(true); setErr(''); setMsg(null);
    try { const r = await resetData(); invalidateReceipts(); setMsg(r); setConfirm(''); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-title">Beheer</h1>
        <p className="page-sub">Begin met een schone lei en laad je hele historie opnieuw in.</p>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <div className="alert warn"><Icon name="alert" size={15} /> Dit verplaatst de map <strong>Bonnen</strong> en het overzichtsbestand naar de prullenbak van je Drive. Bij je volgende scan worden ze automatisch opnieuw aangemaakt.</div>

        {msg && <div className="alert ok"><Icon name="check" size={15} /> Gewist. Map en overzicht staan in de prullenbak — scan een bon om opnieuw te beginnen.</div>}
        {err && <div className="alert err">{err}</div>}

        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '4px 0 10px' }}>Typ <strong>VERWIJDER</strong> om te bevestigen.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 200 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="VERWIJDER" />
          <button className="btn" style={{ background: 'var(--red-ink)' }} disabled={confirm !== 'VERWIJDER' || busy} onClick={doReset}>
            <Icon name="trash" size={17} /> {busy ? 'Bezig…' : 'Alles verwijderen'}
          </button>
        </div>
      </div>
    </div>
  );
}
