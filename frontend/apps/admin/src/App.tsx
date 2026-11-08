import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ReviewReportsPage } from './pages/ReviewReportsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { PioneersPage } from './pages/PioneersPage';
import { VerificationsPage } from './pages/VerificationsPage';
import { getSession, restoreSession } from './services/adminService';
import { navigation } from './data/navigation';
import { PendingModulePage } from './pages/PendingModulePage';
import { FinancialExpensesPage } from './pages/FinancialExpensesPage';

function ProtectedRoute() {
  const [state, setState] = useState<'loading' | 'ready'>(getSession() ? 'ready' : 'loading');
  useEffect(() => { if (state === 'ready') return; void restoreSession().then(() => setState('ready')); }, [state]);
  if (state === 'loading') return <main className="state-panel loading"><h2>Validando sesión…</h2></main>;
  return getSession() ? <Outlet /> : <Navigate to="/login" replace />;
}

const implementedPaths = ['/dashboard', '/summary', '/statistics', '/verifications', '/reports', '/reviews', '/pioneers', '/financial-reports'];

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/recover-password" element={<PasswordRecoveryPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/summary" element={<DashboardPage />} />
        <Route path="/statistics" element={<DashboardPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/verifications" element={<VerificationsPage />} />
        <Route path="/reports" element={<ReviewReportsPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/pioneers" element={<PioneersPage />} />
        <Route path="/financial-reports" element={<FinancialExpensesPage />} />
        {navigation.filter(item => !implementedPaths.includes(item.path)).map(item => <Route key={item.path} path={item.path} element={<PendingModulePage />} />)}
        {['users', 'reports', 'content', 'reviews', 'needs', 'zones', 'categories', 'notifications', 'audit', 'settings', 'businesses'].map(path => <Route key={path} path={`/${path}/:id`} element={<PendingModulePage />} />)}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Route>
  </Routes>;
}
