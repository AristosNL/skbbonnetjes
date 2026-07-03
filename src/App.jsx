import LoginGate from './LoginGate.jsx';
import ReceiptScanner from './ReceiptScanner.jsx';

export default function App() {
  return (
    <LoginGate>
      <ReceiptScanner />
    </LoginGate>
  );
}
