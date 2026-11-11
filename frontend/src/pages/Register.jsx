import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import api, { errMsg } from '../api';
import { isEmail, isPhone, passwordProblem } from '../helpers';
import { Field, useToast } from '../components/ui';

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', specialization: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Full name is required';
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address';
    const pw = passwordProblem(form.password);
    if (pw) errs.password = pw;
    if (!isPhone(form.phone)) errs.phone = 'Enter a valid phone number (10+ digits)';
    setErrors(errs);
    setServerError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.post('/auth/register', form);
      toast('Account created. Please log in.');
      navigate('/login');
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
        <h1>Join your clinic's<br />digital front desk.</h1>
        <p>Create your doctor account and start managing your practice in minutes.</p>
      </div>
      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <h2>Create Doctor Account</h2>
          {serverError && <div className="alert alert-error">{serverError}</div>}
          <Field label="Full Name" required error={errors.full_name}>
            <input className="input" value={form.full_name} onChange={set('full_name')} placeholder="Dr. Full Name" />
          </Field>
          <Field label="Email" required error={errors.email}>
            <input className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Password" required error={errors.password} hint="Minimum 8 characters, with a letter and a number">
            <input className="input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
          <Field label="Specialization">
            <input className="input" value={form.specialization} onChange={set('specialization')} placeholder="e.g. Veterinary Medicine" />
          </Field>
          <Field label="Phone" required error={errors.phone}>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="9876543210" />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Register'}</button>
          <p className="muted center small">Already have an account? <Link to="/login" className="link">Login</Link></p>
        </form>
      </div>
    </div>
  );
}
