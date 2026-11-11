import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import api, { errMsg } from '../api';
import { passwordProblem } from '../helpers';
import { Field, useToast } from '../components/ui';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(pw);
    if (problem) return setError(problem);
    if (pw !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: pw });
      toast('Password updated. Please log in.');
      navigate('/login');
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
        <h1>Choose a new password</h1>
        <p>Pick something strong that you don't use anywhere else.</p>
      </div>
      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <h2>New Password</h2>
          {!token && <div className="alert alert-error">This reset link is missing its token. Request a new one.</div>}
          {error && <div className="alert alert-error">{error}</div>}
          <Field label="New password" required>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" required>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy || !token}>{busy ? 'Saving…' : 'Update password'}</button>
          <p className="muted center small"><Link to="/login" className="link">Back to login</Link></p>
        </form>
      </div>
    </div>
  );
}
