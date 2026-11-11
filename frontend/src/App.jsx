import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Appointments from './pages/Appointments';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import PatientProfile from './pages/PatientProfile';
import Patients from './pages/Patients';
import PrescriptionForm from './pages/PrescriptionForm';
import Prescriptions from './pages/Prescriptions';
import Profile from './pages/Profile';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';

function Protected({ children }) {
  const { doctor, loading } = useAuth();
  if (loading) return <Spinner text="Checking your session…" />;
  return doctor ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const { doctor, loading } = useAuth();
  if (loading) return <Spinner />;
  return doctor ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientProfile />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/prescriptions" element={<Prescriptions />} />
        <Route path="/prescriptions/new" element={<PrescriptionForm />} />
        <Route path="/prescriptions/:id/edit" element={<PrescriptionForm />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
