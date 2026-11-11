export const STATUSES = ['Waiting', 'Confirmed', 'In Consultation', 'Completed', 'Cancelled'];
export const VISIT_TYPES = ['Clinic', 'Home Visit', 'Video Consultation', 'Emergency'];
export const SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Cow', 'Horse', 'Goat', 'Other'];
export const GENDERS = ['Male', 'Female', 'Unknown'];
export const BLOOD_GROUPS = ['DEA 1.1+', 'DEA 1.1-', 'Type A', 'Type B', 'Type AB', 'Unknown'];

export const STATUS_COLORS = {
  Waiting: '#e0a100',
  Confirmed: '#1d5fd1',
  'In Consultation': '#7b4fd6',
  Completed: '#1a9d5b',
  Cancelled: '#d64550',
};

export const statusClass = (s) => 'badge badge-' + String(s || '').toLowerCase().replace(/\s+/g, '-');

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtDate = (s) => {
  if (!s) return '-';
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtTime = (t) => {
  if (!t) return '-';
  const [h, m] = String(t).split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};

export const initials = (name = '') =>
  name.replace(/^dr\.?\s*/i, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'D';

export const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v || '');
export const isPhone = (v) => /^\+?\d{10,15}$/.test((v || '').replace(/[\s-]/g, ''));
export const passwordProblem = (v) => {
  if (!v || v.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Use at least one letter and one number';
  return '';
};
