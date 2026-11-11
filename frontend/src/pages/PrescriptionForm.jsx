import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import api, { errMsg } from '../api';
import { fmtDate, fmtTime, todayStr } from '../helpers';
import { Field, Spinner, useToast } from '../components/ui';

const blankMed = () => ({ medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '' });

export default function PrescriptionForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [known, setKnown] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [form, setForm] = useState({
    patient_id: location.state?.patient_id || '', appointment_id: '', diagnosis: '',
    prescribed_on: todayStr(), notes: '', medicines: [blankMed()],
  });

  useEffect(() => {
    api.get('/patients').then((r) => setPatients(r.data)).catch(() => {});
    api.get('/prescriptions/medicines').then((r) => setKnown(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    api.get(`/prescriptions/${id}`).then((r) => {
      const d = r.data;
      setForm({
        patient_id: d.patient_id, appointment_id: d.appointment_id || '', diagnosis: d.diagnosis,
        prescribed_on: String(d.prescribed_on).slice(0, 10), notes: d.notes || '',
        medicines: d.medicines.map((m) => ({ medicine_name: m.medicine_name, dosage: m.dosage || '', frequency: m.frequency || '', duration: m.duration || '', instructions: m.instructions || '' })),
      });
    }).catch((e) => setServerError(errMsg(e))).finally(() => setLoading(false));
  }, [id, editing]);

  // appointments of the selected patient
  useEffect(() => {
    if (!form.patient_id) return setAppointments([]);
    api.get('/appointments', { params: { patient_id: form.patient_id } }).then((r) => setAppointments(r.data)).catch(() => {});
  }, [form.patient_id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setMed = (i, k, v) => {
    const medicines = form.medicines.map((m, idx) => (idx === i ? { ...m, [k]: v } : m));
    // picking a known medicine name pre-fills the rest if still empty
    if (k === 'medicine_name') {
      const hit = known.find((x) => x.medicine_name.toLowerCase() === v.toLowerCase());
      const cur = medicines[i];
      if (hit && !cur.dosage && !cur.frequency && !cur.duration && !cur.instructions) {
        medicines[i] = { ...cur, dosage: hit.dosage || '', frequency: hit.frequency || '', duration: hit.duration || '', instructions: hit.instructions || '' };
      }
    }
    setForm({ ...form, medicines });
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.patient_id) errs.patient_id = 'Select a patient';
    if (!form.diagnosis.trim()) errs.diagnosis = 'Diagnosis is required';
    if (!form.medicines.some((m) => m.medicine_name.trim())) errs.medicines = 'Add at least one medicine';
    setErrors(errs);
    setServerError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const payload = { ...form, appointment_id: form.appointment_id || null, medicines: form.medicines.filter((m) => m.medicine_name.trim()) };
      if (editing) await api.put(`/prescriptions/${id}`, payload); else await api.post('/prescriptions', payload);
      toast(editing ? 'Prescription updated' : 'Prescription created');
      navigate('/prescriptions');
    } catch (err) { setServerError(errMsg(err)); } finally { setBusy(false); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <button className="btn btn-ghost" onClick={() => navigate('/prescriptions')}><ArrowLeft size={16} /> Prescriptions</button>
        <h1 style={{ flex: 1, marginLeft: 12 }}>{editing ? 'Edit Prescription' : 'New Prescription'}</h1>
      </div>

      <form className="card" onSubmit={submit} noValidate>
        {serverError && <div className="alert alert-error">{serverError}</div>}
        <div className="form-grid">
          <Field label="Patient" required error={errors.patient_id}>
            <select className="input" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value, appointment_id: '' })}>
              <option value="">Select patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.owner_name} ({p.pet_name})</option>)}
            </select>
          </Field>
          <Field label="Appointment (optional)">
            <select className="input" value={form.appointment_id} onChange={set('appointment_id')} disabled={!form.patient_id}>
              <option value="">— none —</option>
              {appointments.map((a) => <option key={a.id} value={a.id}>{fmtDate(a.appointment_date)} {fmtTime(a.appointment_time)} — {a.reason}</option>)}
            </select>
          </Field>
          <Field label="Date"><input className="input" type="date" value={form.prescribed_on} onChange={set('prescribed_on')} /></Field>
          <Field label="Diagnosis" required error={errors.diagnosis}><input className="input" value={form.diagnosis} onChange={set('diagnosis')} placeholder="e.g. Skin Infection" /></Field>
        </div>

        <div className="card-head" style={{ marginTop: 8 }}>
          <h3>Medicines</h3>
          <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, medicines: [...form.medicines, blankMed()] })}><Plus size={16} /> Add medicine</button>
        </div>
        {errors.medicines && <div className="field-error" style={{ marginBottom: 8 }}>{errors.medicines}</div>}
        <datalist id="known-meds">{known.map((k) => <option key={k.medicine_name} value={k.medicine_name} />)}</datalist>

        {form.medicines.map((m, i) => (
          <div className="med-row" key={i}>
            <Field label={i === 0 ? 'Medicine name' : ''}><input className="input" list="known-meds" value={m.medicine_name} onChange={(e) => setMed(i, 'medicine_name', e.target.value)} placeholder="Medicine" /></Field>
            <Field label={i === 0 ? 'Dosage' : ''}><input className="input" value={m.dosage} onChange={(e) => setMed(i, 'dosage', e.target.value)} placeholder="250 mg" /></Field>
            <Field label={i === 0 ? 'Frequency' : ''}><input className="input" value={m.frequency} onChange={(e) => setMed(i, 'frequency', e.target.value)} placeholder="Twice daily" /></Field>
            <Field label={i === 0 ? 'Duration' : ''}><input className="input" value={m.duration} onChange={(e) => setMed(i, 'duration', e.target.value)} placeholder="7 days" /></Field>
            <Field label={i === 0 ? 'Instructions' : ''}><input className="input" value={m.instructions} onChange={(e) => setMed(i, 'instructions', e.target.value)} placeholder="After food" /></Field>
            <button type="button" className="icon-btn danger med-del" disabled={form.medicines.length === 1}
              onClick={() => setForm({ ...form, medicines: form.medicines.filter((_, idx) => idx !== i) })} title="Remove"><Trash2 size={16} /></button>
          </div>
        ))}

        <Field label="Additional notes"><textarea className="input" rows={3} value={form.notes} onChange={set('notes')} /></Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/prescriptions')}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update prescription' : 'Save prescription'}</button>
        </div>
      </form>
    </>
  );
}
