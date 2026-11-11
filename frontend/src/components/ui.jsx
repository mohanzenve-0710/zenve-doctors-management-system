import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { statusClass } from '../helpers';

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, message, type }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Confirm dialog ---------- */
export function Confirm({ title = 'Are you sure?', message, confirmText = 'Delete', onConfirm, onCancel, busy }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="muted" style={{ marginTop: 0 }}>{message}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Please wait…' : confirmText}</button>
      </div>
    </Modal>
  );
}

/* ---------- Bits ---------- */
export const StatusBadge = ({ status }) => <span className={statusClass(status)}>{status}</span>;

export const Spinner = ({ text = 'Loading…' }) => (
  <div className="center-note"><div className="spinner" /> {text}</div>
);

export const Empty = ({ text }) => <div className="center-note muted">{text}</div>;

export const Field = ({ label, required, error, children, hint }) => (
  <label className="field">
    <span className="field-label">{label}{required && <em> *</em>}</span>
    {children}
    {hint && !error && <span className="field-hint">{hint}</span>}
    {error && <span className="field-error">{error}</span>}
  </label>
);

export const Avatar = ({ src, name, size = 36 }) =>
  src ? (
    <img className="avatar" src={src} alt={name || ''} style={{ width: size, height: size }} />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {(name || '?').replace(/^dr\.?\s*/i, '').slice(0, 1).toUpperCase()}
    </span>
  );
