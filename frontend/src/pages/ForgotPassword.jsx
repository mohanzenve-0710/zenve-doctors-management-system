import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, PawPrint } from 'lucide-react';
import api, { errMsg } from '../api';
import { isEmail } from '../helpers';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isEmail(email)) return setError('Enter a valid email address');
    setBusy(true);
    try {
      const r = await api.post('/auth/forgot-password', { email: email.trim() });
      setDone(r.data.message);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <PawPrint size={64} />
        <h1>Forgot your password?</h1>
        <p>No problem — we'll send you a link to set a new one.</p>
      </div>
      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <h2>Reset Password</h2>
          <p className="muted center small">Enter the email address you registered with.</p>
          {error && <div className="alert alert-error">{error}</div>}
          {done && <div className="alert alert-success">{done}</div>}
          <div className="input-icon">
            <Mail size={17} />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          <p className="muted center small"><Link to="/login" className="link">Back to login</Link></p>
        </form>
      </div>
    </div>
  );
}
