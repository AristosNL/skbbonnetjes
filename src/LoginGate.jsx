// LoginGate.jsx
// Wrapper: toont loginscherm tot /me bevestigt dat de auth-cookie geldig is.
// Gebruik: <LoginGate><ReceiptScanner /></LoginGate>

import { useState, useEffect, useCallback } from 'react';

const SAGE = '#5a845c';
const SAGE_DK = '#456847';
const LINE = '#e6ede6';
const CREAM = '#FAF7F2';
const INK = '#1C1C1E';
const BODY = "'DM Sans', system-ui, sans-serif";
const DISPLAY = "'Playfair Display', Georgia, serif";

const s = {
  page: { minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BODY },
  card: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 28, width: 320, boxShadow: '0 4px 16px rgba(90,132,92,0.08)' },
  title: { fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, margin: '0 0 16px', color: INK },
  input: { width: '100%', padding: '10px 12px', border: `1px solid #d6e0d6`, borderRadius: 10, fontSize: 14, fontFamily: BODY, boxSizing: 'border-box', marginBottom: 10 },
  btn: { width: '100%', padding: '11px 0', border: 'none', borderRadius: 10, background: SAGE, color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: BODY },
  err: { color: '#8a1c0a', fontSize: 13, marginBottom: 10 },
  logout: { position: 'fixed', top: 14, right: 16, fontSize: 12, color: SAGE_DK, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: BODY },
};

export default function LoginGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | out | in
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/.netlify/functions/me')
      .then((r) => setStatus(r.ok ? 'in' : 'out'))
      .catch(() => setStatus('out'));
  }, []);

  const login = useCallback(async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/.netlify/functions/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'Inloggen mislukt.');
      setStatus('in');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [password]);

  const logout = useCallback(async () => {
    await fetch('/.netlify/functions/logout', { method: 'POST' });
    setStatus('out'); setPassword('');
  }, []);

  if (status === 'checking') return null;

  if (status === 'out') {
    return (
      <div style={s.page}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap');`}</style>
        <form style={s.card} onSubmit={login}>
          <h2 style={s.title}>Inloggen</h2>
          {error && <div style={s.err}>{error}</div>}
          <input
            style={s.input} type="password" placeholder="Wachtwoord" autoFocus
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <button style={s.btn} disabled={busy}>{busy ? 'Bezig…' : 'Inloggen'}</button>
        </form>
      </div>
    );
  }

  return (
    <>
      <button style={s.logout} onClick={logout}>Uitloggen</button>
      {children}
    </>
  );
}
