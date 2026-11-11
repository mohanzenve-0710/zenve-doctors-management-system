import { useEffect, useRef, useState } from 'react';
import { Camera, Mail, MapPin, Phone, Stethoscope } from 'lucide-react';
import api, { errMsg, fileUrl } from '../api';
import { useAuth } from '../AuthContext';
import { fmtDate, isEmail, isPhone, passwordProblem } from '../helpers';
import { Avatar, Field, Spinner, useToast } from '../components/ui';

const KEYS = ['full_name', 'email', 'phone', 'qualification', 'specialization', 'experience_years', 'clinic_name', 'clinic_address', 'address'];

export default function Profile() {
  const { refresh } = useAuth();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [account, setAccount] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    const [p, a] = await Promise.all([api.get('/profile'), api.get('/profile/account')]);
    setDoc(p.data);
    setAccount(a.data);
  };
  useEffect(() => { load().catch((e) => toast(errMsg(e), 'error')); /* eslint-disable-next-line */ }, []);

  if (!doc) return <Spinner />;

  const startEdit = () => {
    setForm(Object.fromEntries(KEYS.map((k) => [k, doc[k] ?? ''])));
    setErrors({});
    setEditing(true);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Name is required';
    if (!isEmail(form.email)) errs.email = 'Enter a valid email';
    if (!isPhone(form.phone)) errs.phone = 'Enter a valid mobile number';
    if (form.experience_years !== '' && !/^\d{1,2}$/.test(String(form.experience_years))) errs.experience_years = 'Whole years, e.g. 8';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.put('/profile', form);
      await Promise.all([load(), refresh()]);
      setEditing(false);
      toast('Profile updated');
    } catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
  };

  const uploadImage = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast('Image must be under 5 MB', 'error');
    const fd = new FormData();
    fd.append('image', f);
    try { await api.post('/profile/image', fd); await Promise.all([load(), refresh()]); toast('Profile picture updated'); }
    catch (err) { toast(errMsg(err), 'error'); }
    e.target.value = '';
  };

  return (
    <>
      <div className="page-head"><h1>My Profile</h1>
        {!editing && <button className="btn btn-primary" onClick={startEdit}>Edit Profile</button>}</div>

      <section className="card profile-head">
        <div className="avatar-edit">
          <Avatar src={fileUrl(doc.profile_image)} name={doc.full_name} size={110} />
          <button className="cam" onClick={() => fileRef.current.click()} title="Update profile picture"><Camera size={16} /></button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={uploadImage} />
        </div>

        {!editing ? (
          <div className="profile-info">
            <h2>{doc.full_name?.startsWith('Dr') ? doc.full_name : `Dr. ${doc.full_name}`}</h2>
            <div className="muted">{doc.specialization || 'Specialization not set'}{doc.qualification ? ` · ${doc.qualification}` : ''}</div>
            <div className="kv-list">
              <div><Mail size={16} /> {doc.email}</div>
              <div><Phone size={16} /> {doc.phone}</div>
              <div><Stethoscope size={16} /> {doc.experience_years != null ? `${doc.experience_years} years of experience` : 'Experience not set'}</div>
              <div><MapPin size={16} /> {[doc.clinic_name, doc.clinic_address].filter(Boolean).join(', ') || 'Clinic details not set'}</div>
              {doc.address && <div><MapPin size={16} /> Home: {doc.address}</div>}
            </div>
          </div>
        ) : (
          <form className="profile-form" onSubmit={save} noValidate>
            <div className="form-grid">
              <Field label="Full name" required error={errors.full_name}><input className="input" value={form.full_name} onChange={set('full_name')} /></Field>
              <Field label="Email" required error={errors.email}><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
              <Field label="Mobile number" required error={errors.phone}><input className="input" value={form.phone} onChange={set('phone')} /></Field>
              <Field label="Qualification"><input className="input" value={form.qualification} onChange={set('qualification')} placeholder="BVSc & AH, MVSc" /></Field>
              <Field label="Specialization"><input className="input" value={form.specialization} onChange={set('specialization')} /></Field>
              <Field label="Experience (years)" error={errors.experience_years}><input className="input" value={form.experience_years} onChange={set('experience_years')} /></Field>
              <Field label="Clinic name"><input className="input" value={form.clinic_name} onChange={set('clinic_name')} /></Field>
              <Field label="Clinic address"><input className="input" value={form.clinic_address} onChange={set('clinic_address')} /></Field>
            </div>
            <Field label="Home address"><input className="input" value={form.address} onChange={set('address')} /></Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        )}
      </section>

      <div className="grid-2">
        <ChangePassword toast={toast} />
        <section className="card">
          <div className="card-head"><h3>Account Details</h3></div>
          {account && (
            <div className="kv-grid">
              <div><div className="muted small">Member since</div>{fmtDate(account.member_since)}</div>
              <div><div className="muted small">Last login</div>{account.last_login ? fmtDate(account.last_login) : '-'}</div>
              <div><div className="muted small">Patients</div><b>{account.totals.patients}</b></div>
              <div><div className="muted small">Appointments</div><b>{account.totals.appointments}</b></div>
              <div><div className="muted small">Prescriptions</div><b>{account.totals.prescriptions}</b></div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ChangePassword({ toast }) {
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.current_password) return setError('Enter your current password');
    const problem = passwordProblem(f.new_password);
    if (problem) return setError(problem);
    if (f.new_password !== f.confirm) return setError('New passwords do not match');
    setBusy(true);
    try {
      await api.post('/profile/change-password', { current_password: f.current_password, new_password: f.new_password });
      setF({ current_password: '', new_password: '', confirm: '' });
      toast('Password changed');
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <section className="card">
      <div className="card-head"><h3>Change Password</h3></div>
      <form onSubmit={submit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}
        <Field label="Current password"><input className="input" type="password" value={f.current_password} onChange={set('current_password')} autoComplete="current-password" /></Field>
        <Field label="New password"><input className="input" type="password" value={f.new_password} onChange={set('new_password')} autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><input className="input" type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      </form>
    </section>
  );
}
