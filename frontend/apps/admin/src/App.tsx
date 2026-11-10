import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import { BusinessesPage } from './pages/BusinessesPage';
import { BusinessDetailShell } from './pages/BusinessDetailShell';
import { MockModulePage } from './pages/MockModulePage';
import { DemoDashboardPage } from './pages/DemoDashboardPage';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ReviewReportsPage } from './pages/ReviewReportsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { PioneersPage } from './pages/PioneersPage';
import { VerificationsPage } from './pages/VerificationsPage';
import { getSession, restoreSession, enableDemoSession, isAdminDemoMode } from './services/adminService';
import { navigation } from './data/navigation';
import { PendingModulePage } from './pages/PendingModulePage';
import { FinancialExpensesPage } from './pages/FinancialExpensesPage';
import { AdministratorsPage } from './pages/AdministratorsPage';

function DemoProtectedRoute() { enableDemoSession(); return <Outlet />; }
function ProtectedRoute() {
  const [state, setState] = useState<'loading' | 'ready'>(getSession() ? 'ready' : 'loading');
  useEffect(() => {
    if (state === 'ready') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const restore = () => { void restoreSession().then(() => { if (active) setState('ready'); }).catch(() => { if (active) timer = setTimeout(restore, 5000); }); };
    restore(); window.addEventListener('online', restore);
    return () => { active = false; clearTimeout(timer); window.removeEventListener('online', restore); };
  }, [state]);
  if (state === 'loading') return <main className="state-panel loading"><h2>Validando sesión…</h2></main>;
  return getSession() ? <Outlet /> : <Navigate to="/login" replace />;
}

const implementedPaths = ['/dashboard', '/summary', '/statistics', '/verifications', '/reports', '/reviews', '/pioneers', '/financial-reports', '/businesses', '/administrators'];

export default function App() {
  if (isAdminDemoMode) return <Routes><Route element={<DemoProtectedRoute />}><Route element={<Layout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<DemoDashboardPage />} />
    <Route path="*" element={<MockModulePage />} />
  </Route></Route></Routes>;
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
    <Route path="/recover-password" element={<PasswordRecoveryPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/summary" element={<DashboardPage />} />
        <Route path="/statistics" element={<DashboardPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/businesses" element={<BusinessesPage />} />
        <Route path="/businesses/:id" element={<BusinessDetailShell />} />
        <Route path="/verifications" element={<VerificationsPage />} />
        <Route path="/reports" element={<ReviewReportsPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/pioneers" element={<PioneersPage />} />
        <Route path="/financial-reports" element={<FinancialExpensesPage />} />
        <Route path="/administrators" element={<AdministratorsPage />} />
        {navigation.filter(item => !implementedPaths.includes(item.path)).map(item => <Route key={item.path} path={item.path} element={<PendingModulePage />} />)}
        {['users', 'reports', 'content', 'reviews', 'needs', 'zones', 'categories', 'notifications', 'audit', 'settings'].map(path => <Route key={path} path={`/${path}/:id`} element={<PendingModulePage />} />)}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Route>
  </Routes>;
}
