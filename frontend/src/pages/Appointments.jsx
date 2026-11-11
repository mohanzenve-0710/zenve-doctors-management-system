import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, List, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import api, { errMsg } from '../api';
import { fmtDate, fmtTime, STATUSES, STATUS_COLORS, todayStr, VISIT_TYPES } from '../helpers';
import { Confirm, Empty, Field, Modal, Spinner, StatusBadge, useToast } from '../components/ui';

const blank = () => ({ patient_id: '', appointment_date: todayStr(), appointment_time: '10:00', visit_type: 'Clinic', status: 'Waiting', reason: '', notes: '' });

export default function Appointments() {
  const toast = useToast();
  const location = useLocation();
  const [view, setView] = useState('list');
  const [filters, setFilters] = useState({ search: '', status: '', visit_type: '', date: '' });
  const [items, setItems] = useState(null);
  const [patients, setPatients] = useState([]);
  const [modal, setModal] = useState(null); // {item?}
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');

  // calendar
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calItems, setCalItems] = useState([]);
  const [selDay, setSelDay] = useState(todayStr());

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.get('/appointments', { params }).then((r) => setItems(r.data)).catch((e) => setError(errMsg(e)));
  }, [filters]);

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const loadCal = useCallback(() => {
    api.get('/appointments/calendar', { params: { month: monthKey } }).then((r) => setCalItems(r.data)).catch(() => {});
  }, [monthKey]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { if (view === 'calendar') loadCal(); }, [view, loadCal]);
  useEffect(() => { api.get('/patients').then((r) => setPatients(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (location.state?.add) setModal({}); }, [location.state]);

  const refresh = () => { load(); if (view === 'calendar') loadCal(); };

  const changeStatus = async (a, status) => {
    try { await api.patch(`/appointments/${a.id}/status`, { status }); toast(`Marked as ${status}`); refresh(); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  const remove = async () => {
    try { await api.delete(`/appointments/${confirm.id}`); toast('Appointment deleted'); setConfirm(null); refresh(); }
    catch (e) { toast(errMsg(e), 'error'); setConfirm(null); }
  };

  const renderRow = (a) => (
    <tr key={a.id}>
      <td>{fmtDate(a.appointment_date)}</td>
      <td>{fmtTime(a.appointment_time)}</td>
      <td><b>{a.pet_name}</b><div className="muted small">{a.species}</div></td>
      <td>{a.owner_name}<div className="muted small">{a.owner_phone}</div></td>
      <td>{a.visit_type}</td>
      <td>{a.reason}</td>
      <td>
        <select className={`status-select st-${a.status.toLowerCase().replace(/\s+/g, '-')}`} value={a.status}
          onChange={(e) => changeStatus(a, e.target.value)}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td className="actions">
        <button className="icon-btn" title="Edit" onClick={() => setModal({ item: a })}><Pencil size={16} /></button>
        <button className="icon-btn danger" title="Delete" onClick={() => setConfirm(a)}><Trash2 size={16} /></button>
      </td>
    </tr>
  );

  const renderTable = (rows) => rows.length === 0 ? <Empty text="No appointments found" /> : (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Date</th><th>Time</th><th>Pet</th><th>Owner</th><th>Visit Type</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{rows.map(renderRow)}</tbody>
    </table></div>
  );

  /* ----- calendar grid ----- */
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out = Array(first.getDay()).fill(null);
    for (let d = 1; d <= days; d++) out.push(`${monthKey}-${String(d).padStart(2, '0')}`);
    return out;
  }, [month, monthKey]);
  const byDay = useMemo(() => {
    const m = {};
    calItems.forEach((a) => { const k = String(a.appointment_date).slice(0, 10); (m[k] ||= []).push(a); });
    return m;
  }, [calItems]);

  return (
    <>
      <div className="page-head">
        <h1>Appointments</h1>
        <div className="quick-actions">
          <div className="seg">
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List size={14} /> List</button>
            <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}><CalendarDays size={14} /> Calendar</button>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16} /> Add Appointment</button>
        </div>
      </div>

      {view === 'list' && (
        <div className="toolbar">
          <div className="search"><Search size={16} />
            <input placeholder="Search by pet, owner, reason…" value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="input" value={filters.visit_type} onChange={(e) => setFilters({ ...filters, visit_type: e.target.value })}>
            <option value="">All visit types</option>{VISIT_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
          <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          {(filters.search || filters.status || filters.visit_type || filters.date) &&
            <button className="btn btn-ghost" onClick={() => setFilters({ search: '', status: '', visit_type: '', date: '' })}>Clear</button>}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {view === 'list' ? (
        <section className="card">{items === null ? <Spinner /> : renderTable(items)}</section>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
              <h3>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
              <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
            </div>
            <div className="cal">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
              {cells.map((d, i) => d === null ? <div key={'x' + i} className="cal-cell empty" /> : (
                <button key={d} className={`cal-cell ${d === selDay ? 'sel' : ''} ${d === todayStr() ? 'today' : ''}`} onClick={() => setSelDay(d)}>
                  <span className="cal-num">{Number(d.slice(8))}</span>
                  <span className="cal-dots">
                    {(byDay[d] || []).slice(0, 4).map((a) => <i key={a.id} style={{ background: STATUS_COLORS[a.status] }} />)}
                  </span>
                  {(byDay[d] || []).length > 0 && <span className="cal-count">{byDay[d].length}</span>}
                </button>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h3>Appointments on {fmtDate(selDay)}</h3></div>
            {renderTable(byDay[selDay] || [])}
          </section>
        </>
      )}

      {modal && (
        <AppointmentModal item={modal.item} defaultDate={view === 'calendar' ? selDay : undefined}
          patients={patients} onClose={() => setModal(null)}
          onSaved={() => { setModal(null); toast('Appointment saved'); refresh(); }} />
      )}
      {confirm && <Confirm message={`Delete the appointment for ${confirm.pet_name} on ${fmtDate(confirm.appointment_date)}? This cannot be undone.`}
        onConfirm={remove} onCancel={() => setConfirm(null)} />}
    </>
  );
}

function AppointmentModal({ item, patients, defaultDate, onClose, onSaved }) {
  const [form, setForm] = useState(item ? {
    patient_id: item.patient_id, appointment_date: String(item.appointment_date).slice(0, 10),
    appointment_time: String(item.appointment_time).slice(0, 5), visit_type: item.visit_type,
    status: item.status, reason: item.reason, notes: item.notes || '',
  } : { ...blank(), ...(defaultDate ? { appointment_date: defaultDate } : {}) });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.patient_id) errs.patient_id = 'Select a patient';
    if (!form.appointment_date) errs.appointment_date = 'Date is required';
    if (!form.appointment_time) errs.appointment_time = 'Time is required';
    if (!form.reason.trim()) errs.reason = 'Reason is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (item) await api.put(`/appointments/${item.id}`, form); else await api.post('/appointments', form);
      onSaved();
    } catch (err) { setServerError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Modal title={item ? 'Edit Appointment' : 'Add Appointment'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {serverError && <div className="alert alert-error">{serverError}</div>}
        {patients.length === 0 && <div className="alert alert-warn">You have no patients yet. Add a patient first.</div>}
        <Field label="Patient" required error={errors.patient_id}>
          <select className="input" value={form.patient_id} onChange={set('patient_id')}>
            <option value="">Select patient…</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.owner_name} ({p.pet_name})</option>)}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Date" required error={errors.appointment_date}><input className="input" type="date" value={form.appointment_date} onChange={set('appointment_date')} /></Field>
          <Field label="Time" required error={errors.appointment_time}><input className="input" type="time" value={form.appointment_time} onChange={set('appointment_time')} /></Field>
          <Field label="Visit type"><select className="input" value={form.visit_type} onChange={set('visit_type')}>{VISIT_TYPES.map((v) => <option key={v}>{v}</option>)}</select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={set('status')}>{STATUSES.map((v) => <option key={v}>{v}</option>)}</select></Field>
        </div>
        <Field label="Reason" required error={errors.reason}><input className="input" value={form.reason} onChange={set('reason')} placeholder="e.g. Follow-up checkup" /></Field>
        <Field label="Notes"><textarea className="input" rows={3} value={form.notes} onChange={set('notes')} /></Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
