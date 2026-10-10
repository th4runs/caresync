import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HOME_FOR_ROLE, useAuth } from './context/AuthContext';
import DashboardLayout from './components/DashboardLayout';
import { PageLoader } from './components/ui';

import Landing from './pages/public/Landing';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import NotFound from './pages/public/NotFound';
import QueueDisplay from './pages/public/QueueDisplay';
import VideoVisit from './pages/VideoVisit';

import PatientDashboard from './pages/patient/Dashboard';
import FindDoctors from './pages/patient/FindDoctors';
import DoctorProfile from './pages/patient/DoctorProfile';
import BookAppointment from './pages/patient/BookAppointment';
import MyAppointments from './pages/patient/MyAppointments';
import AppointmentDetail from './pages/patient/AppointmentDetail';
import MedicalHistory from './pages/patient/MedicalHistory';
import PatientProfile from './pages/patient/Profile';

import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorAppointments from './pages/doctor/Appointments';
import Consultation from './pages/doctor/Consultation';
import DoctorOwnProfile from './pages/doctor/Profile';

import AdminDashboard from './pages/admin/Dashboard';
import ManageDoctors from './pages/admin/Doctors';
import DoctorForm from './pages/admin/DoctorForm';
import ManagePatients from './pages/admin/Patients';
import ManageAppointments from './pages/admin/Appointments';
import ManageSpecializations from './pages/admin/Specializations';
import ManageReviews from './pages/admin/Reviews';
import MessageLog from './pages/admin/Messages';

function RequireRole({ role }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (user.role !== role) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;
  return <DashboardLayout />;
}

function RequireLogin({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  if (user) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/display" element={<QueueDisplay />} />
      <Route path="/visit/:id" element={<RequireLogin><VideoVisit /></RequireLogin>} />

      <Route path="/patient" element={<RequireRole role="PATIENT" />}>
        <Route index element={<PatientDashboard />} />
        <Route path="doctors" element={<FindDoctors />} />
        <Route path="doctors/:id" element={<DoctorProfile />} />
        <Route path="doctors/:id/book" element={<BookAppointment />} />
        <Route path="appointments" element={<MyAppointments />} />
        <Route path="appointments/:id" element={<AppointmentDetail />} />
        <Route path="history" element={<MedicalHistory />} />
        <Route path="profile" element={<PatientProfile />} />
      </Route>

      <Route path="/doctor" element={<RequireRole role="DOCTOR" />}>
        <Route index element={<DoctorDashboard />} />
        <Route path="appointments" element={<DoctorAppointments />} />
        <Route path="appointments/:id" element={<Consultation />} />
        <Route path="profile" element={<DoctorOwnProfile />} />
      </Route>

      <Route path="/admin" element={<RequireRole role="ADMIN" />}>
        <Route index element={<AdminDashboard />} />
        <Route path="doctors" element={<ManageDoctors />} />
        <Route path="doctors/new" element={<DoctorForm />} />
        <Route path="doctors/:id/edit" element={<DoctorForm />} />
        <Route path="patients" element={<ManagePatients />} />
        <Route path="appointments" element={<ManageAppointments />} />
        <Route path="specializations" element={<ManageSpecializations />} />
        <Route path="reviews" element={<ManageReviews />} />
        <Route path="messages" element={<MessageLog />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
