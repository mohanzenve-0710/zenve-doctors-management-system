import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FilePlus2, Pencil, Plus, Trash2 } from 'lucide-react';
import api, { errMsg, fileUrl } from '../api';
import { fmtDate, fmtTime, todayStr } from '../helpers';
import { Empty, Field, Spinner, StatusBadge, useToast } from '../components/ui';
import { PatientModal } from './Patients';

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('history');
  const [edit, setEdit] = useState(false);

  const load = useCallback(() => {
    api.get(`/patients/${id}`).then((r) => setP(r.data)).catch((e) => setError(errMsg(e)));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <div className="alert alert-error">{error} <Link to="/patients" className="link">Back to patients</Link></div>;
  if (!p) return <Spinner />;

  const tabs = [
    ['history', `Medical History (${p.medical_history.length})`],
    ['visits', `Previous Visits (${p.visits.length})`],
    ['vaccines', `Vaccinations (${p.vaccinations.length})`],
    ['rx', `Prescriptions (${p.prescriptions.length})`],
  ];

  return (
    <>
      <div className="page-head">
        <button className="btn btn-ghost" onClick={() => navigate('/patients')}><ArrowLeft size={16} /> Patients</button>
        <div className="quick-actions">
          <button className="btn btn-ghost" onClick={() => setEdit(true)}><Pencil size={16} /> Edit</button>
          <button className="btn btn-primary" onClick={() => navigate('/prescriptions/new', { state: { patient_id: p.id } })}><FilePlus2 size={16} /> New Prescription</button>
        </div>
      </div>

      <section className="card profile-head">
        {p.image ? <img className="avatar avatar-xl" src={fileUrl(p.image)} alt={p.pet_name} /> :
          <span className="avatar avatar-xl avatar-fallback">{p.pet_name[0]}</span>}
        <div className="profile-info">
          <h2>{p.pet_name}</h2>
          <div className="kv-grid">
            <KV k="Species" v={p.species} /><KV k="Breed" v={p.breed} />
            <KV k="Age" v={p.age != null ? `${p.age} years` : null} /><KV k="Gender" v={p.gender} />
            <KV k="Weight" v={p.weight != null ? `${p.weight} kg` : null} /><KV k="Blood group" v={p.blood_group} />
          </div>
        </div>
        <div className="profile-owner">
          <h4>Owner</h4>
          <div><b>{p.owner_name}</b></div>
          <div className="muted">{p.owner_phone}</div>
          {p.owner_email && <div className="muted">{p.owner_email}</div>}
          {p.owner_address && <div className="muted">{p.owner_address}</div>}
        </div>
        {p.notes && <div className="profile-notes"><h4>Notes</h4><p>{p.notes}</p></div>}
      </section>

      <div className="tabs">
        {tabs.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      <section className="card">
        {tab === 'history' && <History p={p} reload={load} toast={toast} />}
        {tab === 'vaccines' && <Vaccines p={p} reload={load} toast={toast} />}
        {tab === 'visits' && (p.visits.length === 0 ? <Empty text="No previous visits" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Time</th><th>Reason</th><th>Visit type</th><th>Status</th></tr></thead>
            <tbody>{p.visits.map((v) => (
              <tr key={v.id}><td>{fmtDate(v.appointment_date)}</td><td>{fmtTime(v.appointment_time)}</td>
                <td>{v.reason}</td><td>{v.visit_type}</td><td><StatusBadge status={v.status} /></td></tr>
            ))}</tbody>
          </table></div>
        ))}
        {tab === 'rx' && (p.prescriptions.length === 0 ? <Empty text="No prescriptions yet" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Diagnosis</th><th></th></tr></thead>
            <tbody>{p.prescriptions.map((r) => (
              <tr key={r.id}><td>{fmtDate(r.prescribed_on)}</td><td>{r.diagnosis}</td>
                <td className="actions"><Link className="link" to="/prescriptions" state={{ openId: r.id }}>View</Link></td></tr>
            ))}</tbody>
          </table></div>
        ))}
      </section>

      {edit && <PatientModal item={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); toast('Patient updated'); load(); }} />}
    </>
  );
}

const KV = ({ k, v }) => <div><div className="muted small">{k}</div><div>{v || '-'}</div></div>;

function History({ p, reload, toast }) {
  const [form, setForm] = useState({ title: '', description: '', recorded_on: todayStr() });
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast('Title is required', 'error');
    setBusy(true);
    try { await api.post(`/patients/${p.id}/medical-history`, form); setForm({ title: '', description: '', recorded_on: todayStr() }); toast('History entry added'); reload(); }
    catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
  };
  const del = async (h) => {
    try { await api.delete(`/patients/${p.id}/medical-history/${h.id}`); toast('Entry deleted'); reload(); }
    catch (err) { toast(errMsg(err), 'error'); }
  };
  return (
    <>
      <form className="inline-form" onSubmit={add}>
        <Field label="Condition / Event"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Skin allergy" /></Field>
        <Field label="Date"><input className="input" type="date" value={form.recorded_on} onChange={(e) => setForm({ ...form, recorded_on: e.target.value })} /></Field>
        <Field label="Details"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <button className="btn btn-primary" disabled={busy}><Plus size={16} /> Add</button>
      </form>
      {p.medical_history.length === 0 ? <Empty text="No medical history recorded" /> : (
        <ul className="list">{p.medical_history.map((h) => (
          <li key={h.id} className="list-row between">
            <div><b>{h.title}</b> <span className="muted small">· {fmtDate(h.recorded_on)}</span>
              {h.description && <div className="muted">{h.description}</div>}</div>
            <button className="icon-btn danger" onClick={() => del(h)} title="Delete"><Trash2 size={16} /></button>
          </li>
        ))}</ul>
      )}
    </>
  );
}

function Vaccines({ p, reload, toast }) {
  const blank = { vaccine_name: '', given_on: todayStr(), next_due_on: '', notes: '' };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    if (!form.vaccine_name.trim()) return toast('Vaccine name is required', 'error');
    setBusy(true);
    try { await api.post(`/patients/${p.id}/vaccinations`, form); setForm(blank); toast('Vaccination added'); reload(); }
    catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
  };
  const del = async (v) => {
    try { await api.delete(`/patients/${p.id}/vaccinations/${v.id}`); toast('Entry deleted'); reload(); }
    catch (err) { toast(errMsg(err), 'error'); }
  };
  const overdue = (v) => v.next_due_on && String(v.next_due_on).slice(0, 10) < todayStr();
  return (
    <>
      <form className="inline-form" onSubmit={add}>
        <Field label="Vaccine"><input className="input" value={form.vaccine_name} onChange={(e) => setForm({ ...form, vaccine_name: e.target.value })} placeholder="e.g. Rabies" /></Field>
        <Field label="Given on"><input className="input" type="date" value={form.given_on} onChange={(e) => setForm({ ...form, given_on: e.target.value })} /></Field>
        <Field label="Next due"><input className="input" type="date" value={form.next_due_on} onChange={(e) => setForm({ ...form, next_due_on: e.target.value })} /></Field>
        <button className="btn btn-primary" disabled={busy}><Plus size={16} /> Add</button>
      </form>
      {p.vaccinations.length === 0 ? <Empty text="No vaccinations recorded" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Vaccine</th><th>Given on</th><th>Next due</th><th></th></tr></thead>
          <tbody>{p.vaccinations.map((v) => (
            <tr key={v.id}><td><b>{v.vaccine_name}</b></td><td>{fmtDate(v.given_on)}</td>
              <td>{v.next_due_on ? <span className={overdue(v) ? 'text-red' : ''}>{fmtDate(v.next_due_on)}{overdue(v) ? ' (overdue)' : ''}</span> : '-'}</td>
              <td className="actions"><button className="icon-btn danger" onClick={() => del(v)}><Trash2 size={16} /></button></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
