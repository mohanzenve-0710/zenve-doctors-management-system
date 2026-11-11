import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, CalendarDays, CheckCircle2, Clock, FilePlus2, PawPrint, UserPlus, Users } from 'lucide-react';
import api, { errMsg, fileUrl } from '../api';
import { fmtDate, fmtTime, STATUS_COLORS } from '../helpers';
import { Avatar, Empty, Spinner, StatusBadge } from '../components/ui';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('weekly');
  const [analytics, setAnalytics] = useState([]);
  const [report, setReport] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/today'),
      api.get('/dashboard/recent-appointments'),
      api.get('/dashboard/recent-patients'),
      api.get('/dashboard/recent-activities'),
    ])
      .then(([s, t, ra, rp, act]) =>
        setData({ stats: s.data, today: t.data, recent: ra.data, patients: rp.data, activities: act.data }))
      .catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    api.get('/dashboard/analytics', { params: { period } }).then((r) => setAnalytics(r.data.data)).catch(() => {});
    api.get('/dashboard/reports', { params: { period } }).then((r) => setReport(r.data)).catch(() => {});
  }, [period]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <Spinner />;
  const { stats, today, recent, patients, activities } = data;

  const cards = [
    { label: 'Total Appointments', value: stats.total_appointments, icon: CalendarDays, tone: 'blue' },
    { label: "Today's Appointments", value: stats.today_appointments, icon: CalendarCheck, tone: 'green' },
    { label: 'Registered Patients', value: stats.total_patients, icon: Users, tone: 'purple' },
    { label: 'Completed Consultations', value: stats.completed_consultations, icon: CheckCircle2, tone: 'teal' },
    { label: 'Pending Appointments', value: stats.pending_appointments, icon: Clock, tone: 'amber' },
  ];
  const pie = stats.status_overview.filter((s) => s.count > 0);

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={() => navigate('/patients', { state: { add: true } })}><UserPlus size={16} /> Add Patient</button>
          <button className="btn btn-primary" onClick={() => navigate('/appointments', { state: { add: true } })}><CalendarDays size={16} /> New Appointment</button>
          <button className="btn btn-primary" onClick={() => navigate('/prescriptions/new')}><FilePlus2 size={16} /> New Prescription</button>
        </div>
      </div>

      <div className="stat-grid">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div className="stat-card" key={label}>
            <span className={`stat-icon tone-${tone}`}><Icon size={20} /></span>
            <div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h3>Appointment Analytics</h3>
            <div className="seg">
              <button className={period === 'weekly' ? 'on' : ''} onClick={() => setPeriod('weekly')}>Weekly</button>
              <button className={period === 'monthly' ? 'on' : ''} onClick={() => setPeriod('monthly')}>Monthly</button>
            </div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={analytics} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e9f3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#1d5fd1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#1a9d5b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cancelled" name="Cancelled" fill="#d64550" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {report && (
            <p className="muted small" style={{ marginBottom: 0 }}>
              {period === 'weekly' ? 'Last 7 days' : 'Last 30 days'}: <b>{report.total_appointments}</b> appointments,
              {' '}<b>{report.new_patients}</b> new patients, <b>{report.prescriptions_issued}</b> prescriptions issued.
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h3>Appointment Status Overview</h3></div>
          {pie.length === 0 ? <Empty text="No appointments yet" /> : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {pie.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h3>Today's Appointments</h3><Link to="/appointments" className="link small">View All</Link></div>
        {today.length === 0 ? <Empty text="No appointments scheduled for today" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Time</th><th>Patient</th><th>Pet</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>{today.map((a) => (
              <tr key={a.id}><td>{fmtTime(a.appointment_time)}</td><td>{a.owner_name}</td>
                <td>{a.pet_name} ({a.species})</td><td>{a.reason}</td><td><StatusBadge status={a.status} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h3>Recent Appointments</h3></div>
          {recent.length === 0 ? <Empty text="No appointments yet" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Pet</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>{recent.map((a) => (
                <tr key={a.id}><td>{fmtDate(a.appointment_date)}<div className="muted small">{fmtTime(a.appointment_time)}</div></td>
                  <td>{a.pet_name}<div className="muted small">{a.owner_name}</div></td><td>{a.reason}</td>
                  <td><StatusBadge status={a.status} /></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h3>Recent Patient Records</h3><Link to="/patients" className="link small">View All</Link></div>
          {patients.length === 0 ? <Empty text="No patients yet" /> : (
            <ul className="list">{patients.map((p) => (
              <li key={p.id}>
                <Link to={`/patients/${p.id}`} className="list-row">
                  {p.image ? <Avatar src={fileUrl(p.image)} name={p.pet_name} size={40} /> :
                    <span className="avatar avatar-fallback" style={{ width: 40, height: 40 }}><PawPrint size={18} /></span>}
                  <div><b>{p.pet_name}</b> <span className="muted">· {p.species}{p.breed ? ` / ${p.breed}` : ''}</span>
                    <div className="muted small">Owner: {p.owner_name} · {p.owner_phone}</div></div>
                </Link>
              </li>
            ))}</ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h3>Recent Activity</h3></div>
        {activities.length === 0 ? <Empty text="Nothing yet — activity will appear here" /> : (
          <ul className="timeline">{activities.map((a, i) => (
            <li key={i}><span className={`dot dot-${a.type}`} /><span>{a.text}</span>
              <span className="muted small">{fmtDate(a.happened_at)}</span></li>
          ))}</ul>
        )}
      </section>
    </>
  );
}
