import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Camera, Eye, PawPrint, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import api, { errMsg, fileUrl } from '../api';
import { BLOOD_GROUPS, GENDERS, isEmail, isPhone, SPECIES } from '../helpers';
import { Confirm, Empty, Field, Modal, Spinner, useToast } from '../components/ui';

const blank = {
  owner_name: '', owner_phone: '', owner_email: '', owner_address: '',
  pet_name: '', species: 'Dog', breed: '', age: '', gender: 'Male', weight: '', blood_group: '', notes: '',
};

export function PetThumb({ src, size = 38 }) {
  return src ? <img className="avatar" src={fileUrl(src)} alt="" style={{ width: size, height: size }} />
    : <span className="avatar avatar-fallback" style={{ width: size, height: size }}><PawPrint size={size * 0.5} /></span>;
}

export default function Patients() {
  const toast = useToast();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => {
    api.get('/patients', { params: search ? { search } : {} }).then((r) => setItems(r.data)).catch((e) => setError(errMsg(e)));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { if (location.state?.add) setModal({}); }, [location.state]);

  const remove = async () => {
    try { await api.delete(`/patients/${confirm.id}`); toast('Patient deleted'); setConfirm(null); load(); }
    catch (e) { toast(errMsg(e), 'error'); setConfirm(null); }
  };

  return (
    <>
      <div className="page-head">
        <h1>Patients</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Add Patient</button>
      </div>
      <div className="toolbar">
        <div className="search"><Search size={16} />
          <input placeholder="Search by pet, owner, phone, breed…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <section className="card">
        {items === null ? <Spinner /> : items.length === 0 ? <Empty text={search ? 'No patients match your search' : 'No patients yet. Click “Add Patient” to register one.'} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>#</th><th>Pet</th><th>Owner Name</th><th>Species</th><th>Breed</th><th>Age</th><th>Phone</th><th>Actions</th></tr></thead>
            <tbody>{items.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td><Link to={`/patients/${p.id}`} className="pet-cell"><PetThumb src={p.image} /><b>{p.pet_name}</b></Link></td>
                <td>{p.owner_name}</td><td>{p.species}</td><td>{p.breed || '-'}</td>
                <td>{p.age !== null && p.age !== undefined ? `${p.age} yr` : '-'}</td><td>{p.owner_phone}</td>
                <td className="actions">
                  <Link to={`/patients/${p.id}`} className="icon-btn" title="View profile"><Eye size={16} /></Link>
                  <button className="icon-btn" title="Edit" onClick={() => setModal({ item: p })}><Pencil size={16} /></button>
                  <button className="icon-btn danger" title="Delete" onClick={() => setConfirm(p)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      {modal && <PatientModal item={modal.item} onClose={() => setModal(null)}
        onSaved={() => { setModal(null); toast('Patient saved'); load(); }} />}
      {confirm && <Confirm message={`Delete ${confirm.pet_name} (owner ${confirm.owner_name})? Their appointments, prescriptions and history will also be deleted.`}
        onConfirm={remove} onCancel={() => setConfirm(null)} />}
    </>
  );
}

export function PatientModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? Object.fromEntries(Object.keys(blank).map((k) => [k, item[k] ?? ''])) : blank);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(item?.image ? fileUrl(item.image) : null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pick = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setServerError('Image must be under 5 MB');
    setServerError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.owner_name.trim()) errs.owner_name = 'Owner name is required';
    if (!isPhone(form.owner_phone)) errs.owner_phone = 'Enter a valid phone (10+ digits)';
    if (form.owner_email && !isEmail(form.owner_email)) errs.owner_email = 'Enter a valid email';
    if (!form.pet_name.trim()) errs.pet_name = 'Pet name is required';
    if (!form.species) errs.species = 'Species is required';
    if (form.age !== '' && (isNaN(form.age) || form.age < 0)) errs.age = 'Enter a valid age';
    if (form.weight !== '' && (isNaN(form.weight) || form.weight <= 0)) errs.weight = 'Enter a valid weight';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = item ? await api.put(`/patients/${item.id}`, form) : await api.post('/patients', form);
      if (file) {
        const fd = new FormData();
        fd.append('image', file);
        await api.post(`/patients/${res.data.id}/image`, fd);
      }
      onSaved(res.data);
    } catch (err) { setServerError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Modal title={item ? 'Edit Patient' : 'Add Patient'} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        {serverError && <div className="alert alert-error">{serverError}</div>}
        <div className="photo-pick">
          {preview ? <img className="avatar avatar-lg" src={preview} alt="Pet" /> : <span className="avatar avatar-lg avatar-fallback"><PawPrint size={30} /></span>}
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current.click()}><Camera size={16} /> {preview ? 'Change photo' : 'Upload pet photo'}</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick} />
        </div>

        <h4 className="form-section">Owner details</h4>
        <div className="form-grid">
          <Field label="Owner Name" required error={errors.owner_name}><input className="input" value={form.owner_name} onChange={set('owner_name')} /></Field>
          <Field label="Phone" required error={errors.owner_phone}><input className="input" value={form.owner_phone} onChange={set('owner_phone')} /></Field>
          <Field label="Email" error={errors.owner_email}><input className="input" type="email" value={form.owner_email} onChange={set('owner_email')} /></Field>
          <Field label="Address"><input className="input" value={form.owner_address} onChange={set('owner_address')} /></Field>
        </div>

        <h4 className="form-section">Pet details</h4>
        <div className="form-grid">
          <Field label="Pet Name" required error={errors.pet_name}><input className="input" value={form.pet_name} onChange={set('pet_name')} /></Field>
          <Field label="Species" required error={errors.species}>
            <select className="input" value={form.species} onChange={set('species')}>
              {[...new Set([...SPECIES, form.species])].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Breed"><input className="input" value={form.breed} onChange={set('breed')} /></Field>
          <Field label="Age (Years)" error={errors.age}><input className="input" type="number" step="0.1" min="0" value={form.age} onChange={set('age')} /></Field>
          <Field label="Gender"><select className="input" value={form.gender} onChange={set('gender')}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <Field label="Weight (kg)" error={errors.weight}><input className="input" type="number" step="0.01" min="0" value={form.weight} onChange={set('weight')} /></Field>
          <Field label="Blood Group">
            <input className="input" list="bg" value={form.blood_group} onChange={set('blood_group')} placeholder="e.g. DEA 1.1+" />
            <datalist id="bg">{BLOOD_GROUPS.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
        </div>
        <Field label="Notes"><textarea className="input" rows={3} value={form.notes} onChange={set('notes')} placeholder="Friendly and active…" /></Field>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
