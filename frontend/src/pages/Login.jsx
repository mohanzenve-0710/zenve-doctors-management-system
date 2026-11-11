import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, PawPrint } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { errMsg } from '../api';
import { isEmail } from '../helpers';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address';
    if (!form.password) errs.password = 'Password is required';
    setErrors(errs);
    setServerError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await login(form.email.trim(), form.password, form.remember);
      navigate('/dashboard');
    } catch (err) {
      setServerError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <PawPrint size={64} />
        <h1>Care for every paw,<br />in one place.</h1>
        <p>Appointments, patients and prescriptions — organised for your veterinary practice.</p>
      </div>
      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-logo"><PawPrint size={34} /></div>
          <h2>Doctor Management System</h2>
          <p className="muted center">(Veterinary)</p>

          {serverError && <div className="alert alert-error">{serverError}</div>}

          <div className={`input-icon ${errors.email ? 'has-error' : ''}`}>
            <Mail size={17} />
            <input type="email" placeholder="Email" value={form.email} onChange={set('email')} autoComplete="email" />
          </div>
          {errors.email && <div className="field-error">{errors.email}</div>}

          <div className={`input-icon ${errors.password ? 'has-error' : ''}`}>
            <Lock size={17} />
            <input type={show ? 'text' : 'password'} placeholder="Password" value={form.password}
              onChange={set('password')} autoComplete="current-password" />
            <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label="Show or hide password">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.password && <div className="field-error">{errors.password}</div>}

          <div className="row-between">
            <label className="check"><input type="checkbox" checked={form.remember} onChange={set('remember')} /> Remember me</label>
            <Link to="/forgot-password" className="link">Forgot password?</Link>
          </div>

          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
          <p className="muted center small">Don't have an account? <Link to="/register" className="link">Register</Link></p>
        </form>
      </div>
    </div>
  );
}
