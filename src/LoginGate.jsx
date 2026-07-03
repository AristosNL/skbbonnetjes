import { useState, useEffect, useCallback } from 'react';
import Icon from './lib/icons.jsx';
import { checkAuth, login as apiLogin, logout as apiLogout } from './lib/api.js';

export default function LoginGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | out | in
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { checkAuth().then((ok) => setStatus(ok ? 'in' : 'out')).catch(() => setStatus('out')); }, []);

  const doLogin = useCallback(async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await apiLogin(password); setStatus('in'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }, [password]);

  const doLogout = useCallback(async () => { await apiLogout(); setStatus('out'); setPassword(''); }, []);

  if (status === 'checking') return null;

  if (status === 'out') {
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={doLogin}>
          <div className="login-brand">
            <img src="/icon-192.png" alt="" className="brand-glyph" />
            <h1 className="login-title">Bonnetjes</h1>
          </div>
          {error && <div className="alert err">{error}</div>}
          <input className="input" style={{ width: '100%', marginBottom: 12 }} type="password" placeholder="Wachtwoord" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Bezig…' : 'Inloggen'}</button>
        </form>
      </div>
    );
  }

  return typeof children === 'function' ? children(doLogout) : children;
}
