import { useState } from 'react';
import Icon from './lib/icons.jsx';
import { logout } from './lib/api.js';
import LoginGate from './LoginGate.jsx';
import ScanView from './views/ScanView.jsx';
import OverzichtView from './views/OverzichtView.jsx';
import BonnenView from './views/BonnenView.jsx';
import ExportView from './views/ExportView.jsx';

const NAV = [
  { id: 'scan', label: 'Scannen', icon: 'camera', view: ScanView },
  { id: 'overzicht', label: 'Overzicht', icon: 'chart', view: OverzichtView },
  { id: 'bonnen', label: 'Bonnetjes', icon: 'receipt', view: BonnenView },
  { id: 'export', label: 'Export', icon: 'download', view: ExportView },
];

function Shell({ onLogout }) {
  const [active, setActive] = useState('scan');
  const View = NAV.find((n) => n.id === active).view;
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-glyph"><Icon name="receipt" size={20} /></span>
          <div><div className="brand-name">Bonnetjes</div><div className="brand-sub">uitgaven &amp; btw</div></div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={`nav-link ${active === n.id ? 'active' : ''}`} onClick={() => setActive(n.id)}>
              <Icon name={n.icon} size={19} /><span>{n.label}</span>
            </button>
          ))}
          <span className="nav-spacer" />
          <div className="nav-foot">
            <button className="nav-link" onClick={onLogout}><Icon name="logout" size={19} /><span>Uitloggen</span></button>
          </div>
        </nav>
      </aside>
      <main className="main"><View /></main>
    </div>
  );
}

export default function App() {
  return (
    <LoginGate>
      {(doLogout) => <Shell onLogout={doLogout} />}
    </LoginGate>
  );
}
