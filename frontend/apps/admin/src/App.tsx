import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from '@wit/ui';
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import { AdminBusinessesPage, AdminBusinessDetailPage } from './pages/AdminBusinessesPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminUserDetailPage } from './pages/AdminUserDetailPage';
import { AdminContentPage } from './pages/AdminContentPage';
import { AdminContentDetailPage } from './pages/AdminContentDetailPage';
import { AdminContentErrorBoundary } from './components/AdminContentErrorBoundary';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ReviewReportsPage } from './pages/ReviewReportsPage';
import { OperationalInboxPage } from './pages/OperationalInboxPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { PioneersPage } from './pages/PioneersPage';
import { AdminZonesPage } from './pages/AdminZonesPage';
import { PioneersErrorBoundary } from './components/PioneersErrorBoundary';
import { VerificationsPage } from './pages/VerificationsPage';
import { getSession, restoreSession } from './services/adminService';
import { navigation } from './data/navigation';
import { PendingModulePage } from './pages/PendingModulePage';
import { FinancialExpensesPage } from './pages/FinancialExpensesPage';
import { AdministratorsPage } from './pages/AdministratorsPage';
import { AdminAuditPage } from './pages/AdminAuditPage';
import { DocumentsPage } from './pages/DocumentsPage';

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

const implementedPaths = ['/dashboard', '/summary', '/statistics', '/verifications', '/reports', '/reviews', '/pioneers', '/zones', '/financial-reports', '/businesses', '/administrators', '/categories', '/users', '/content', '/user-needs', '/offer-reports', '/business-reports', '/support', '/suggestions', '/corporate', '/legal-documents', '/legal-cases', '/audit'];

export default function App() {
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
        <Route path="/businesses" element={<AdminBusinessesPage />} />
        <Route path="/businesses/:id" element={<AdminBusinessDetailPage />} />
        <Route path="/verifications" element={<VerificationsPage />} />
        <Route path="/reports" element={<ReviewReportsPage />} />
        <Route path="/offer-reports" element={<OperationalInboxPage kind="offer-reports" />} />
        <Route path="/business-reports" element={<OperationalInboxPage kind="business-reports" />} />
        <Route path="/support" element={<OperationalInboxPage kind="support" />} />
        <Route path="/suggestions" element={<OperationalInboxPage kind="suggestions" />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/pioneers" element={<PioneersErrorBoundary><PioneersPage /></PioneersErrorBoundary>} />
        <Route path="/zones" element={<AdminZonesPage />} />
        <Route path="/financial-reports" element={<FinancialExpensesPage />} />
        <Route path="/administrators" element={<AdministratorsPage />} />
        <Route path="/audit" element={<AdminAuditPage />} />
        <Route path="/categories" element={<AdminCategoriesPage />} />
        <Route path="/users" element={<AdminUsersPage />} />
        <Route path="/users/:id" element={<AdminUserDetailPage />} />
        <Route path="/content" element={<AdminContentErrorBoundary><AdminContentPage /></AdminContentErrorBoundary>} />
        <Route path="/content/:id" element={<AdminContentErrorBoundary><AdminContentDetailPage /></AdminContentErrorBoundary>} />
        <Route path="/corporate" element={<DocumentsPage key="CORPORATE" section="CORPORATE" />} />
        <Route path="/legal-documents" element={<DocumentsPage key="LEGAL" section="LEGAL" />} />
        <Route path="/legal-cases" element={<DocumentsPage key="CASES" section="CASES" />} />
        <Route path="/user-needs" element={<OperationalInboxPage kind="needs" />} />
        {navigation.filter(item => !implementedPaths.includes(item.path)).map(item => <Route key={item.path} path={item.path} element={<PendingModulePage />} />)}
        {['reports', 'reviews', 'needs', 'zones', 'categories', 'notifications', 'audit', 'settings'].map(path => <Route key={path} path={`/${path}/:id`} element={<PendingModulePage />} />)}
        <Route path="*" element={<NotFoundPage variant="admin" homeHref="/dashboard" homeLabel="Volver al Dashboard" />} />
      </Route>
    </Route>
  </Routes>;
}
