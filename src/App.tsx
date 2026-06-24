import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LoginCard } from '@/components/auth/LoginCard';
import { Layout } from '@/components/layout/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { ComplaintsPage } from '@/pages/ComplaintsPage';
import { ComplaintDetailPage } from '@/pages/ComplaintDetailPage';
import { InspectionsPage } from '@/pages/InspectionsPage';
import { InspectionDetailPage } from '@/pages/InspectionDetailPage';
import { UsersPage } from '@/pages/UsersPage';
import { InboxPage } from '@/pages/InboxPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { AuditLogsPage } from '@/pages/AuditLogsPage';
import { TrackSubmissionPage } from '@/pages/TrackSubmissionPage';
import { PermissionsPage } from '@/pages/PermissionsPage';
import { PublicComplaintPage } from '@/pages/PublicComplaintPage';
import { PublicInspectionPage } from '@/pages/PublicInspectionPage';
import { SubmitThankYouPage } from '@/pages/SubmitThankYouPage';

function ProtectedRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
        <Route path="/inspections" element={<InspectionsPage />} />
        <Route path="/inspections/:id" element={<InspectionDetailPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/audit" element={<AuditLogsPage />} />
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes — always accessible */}
      <Route path="/submit/complaint" element={<PublicComplaintPage />} />
      <Route path="/submit/inspection" element={<PublicInspectionPage />} />
      <Route path="/submit/thank-you" element={<SubmitThankYouPage />} />
      <Route path="/track" element={<TrackSubmissionPage />} />

      {/* Protected routes (or login) */}
      <Route path="/*" element={user ? <ProtectedRoutes /> : <LoginCard />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
