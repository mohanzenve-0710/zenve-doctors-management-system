import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Eye, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import api, { downloadPrescription, errMsg, printPrescription } from '../api';
import { fmtDate } from '../helpers';
import { Confirm, Empty, Modal, Spinner, useToast } from '../components/ui';

export default function Prescriptions() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState(null);   // full prescription being viewed
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => {
    api.get('/prescriptions', { params: search ? { search } : {} }).then((r) => setItems(r.data)).catch((e) => setError(errMsg(e)));
  }, [search]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const open = useCallback(async (id) => {
    try { const r = await api.get(`/prescriptions/${id}`); setView(r.data); } catch (e) { toast(errMsg(e), 'error'); }
  }, [toast]);
  useEffect(() => { if (location.state?.openId) open(location.state.openId); }, [location.state, open]);

  const remove = async () => {
    try { await api.delete(`/prescriptions/${confirm.id}`); toast('Prescription deleted'); setConfirm(null); setView(null); load(); }
    catch (e) { toast(errMsg(e), 'error'); setConfirm(null); }
  };
  const run = (fn, id) => fn(id).catch((e) => toast(errMsg(e), 'error'));

  return (
    <>
      <div className="page-head">
        <h1>Prescriptions</h1>
        <button className="btn btn-primary" onClick={() => navigate('/prescriptions/new')}><Plus size={16} /> Add Prescription</button>
      </div>
      <div className="toolbar">
        <div className="search"><Search size={16} />
          <input placeholder="Search by pet, owner, diagnosis, medicine…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <section className="card">
        {items === null ? <Spinner /> : items.length === 0 ? <Empty text={search ? 'No prescriptions match your search' : 'No prescriptions yet.'} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>#</th><th>Date</th><th>Patient</th><th>Pet</th><th>Diagnosis</th><th>Medicines</th><th>Actions</th></tr></thead>
            <tbody>{items.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td><td>{fmtDate(r.prescribed_on)}</td><td>{r.owner_name}</td><td>{r.pet_name}</td>
                <td>{r.diagnosis}</td><td>{r.medicine_count}</td>
                <td className="actions">
                  <button className="icon-btn" title="View" onClick={() => open(r.id)}><Eye size={16} /></button>
                  <button className="icon-btn" title="Edit" onClick={() => navigate(`/prescriptions/${r.id}/edit`)}><Pencil size={16} /></button>
                  <button className="icon-btn" title="Download PDF" onClick={() => run(downloadPrescription, r.id)}><Download size={16} /></button>
                  <button className="icon-btn" title="Print" onClick={() => run(printPrescription, r.id)}><Printer size={16} /></button>
                  <button className="icon-btn danger" title="Delete" onClick={() => setConfirm(r)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      {view && (
        <Modal title={`Prescription #${view.id}`} onClose={() => setView(null)} wide>
          <div className="kv-grid">
            <div><div className="muted small">Date</div><b>{fmtDate(view.prescribed_on)}</b></div>
            <div><div className="muted small">Pet</div><b>{view.pet_name}</b> ({view.species})</div>
            <div><div className="muted small">Owner</div><b>{view.owner_name}</b></div>
            <div><div className="muted small">Diagnosis</div><b>{view.diagnosis}</b></div>
          </div>
          <div className="table-wrap" style={{ marginTop: 16 }}><table className="table">
            <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
            <tbody>{view.medicines.map((m) => (
              <tr key={m.id}><td><b>{m.medicine_name}</b></td><td>{m.dosage || '-'}</td><td>{m.frequency || '-'}</td>
                <td>{m.duration || '-'}</td><td>{m.instructions || '-'}</td></tr>
            ))}</tbody>
          </table></div>
          {view.notes && <p><span className="muted small">Notes</span><br />{view.notes}</p>}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => navigate(`/prescriptions/${view.id}/edit`)}><Pencil size={16} /> Edit</button>
            <button className="btn btn-ghost" onClick={() => run(printPrescription, view.id)}><Printer size={16} /> Print</button>
            <button className="btn btn-primary" onClick={() => run(downloadPrescription, view.id)}><Download size={16} /> Download PDF</button>
          </div>
        </Modal>
      )}
      {confirm && <Confirm message={`Delete the prescription for ${confirm.pet_name} (${confirm.diagnosis})?`} onConfirm={remove} onCancel={() => setConfirm(null)} />}
    </>
  );
}
