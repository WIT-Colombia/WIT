import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage';
import { BusinessesPage } from './pages/BusinessesPage';
import { BusinessDetailShell } from './pages/BusinessDetailShell';
import { MockModulePage } from './pages/MockModulePage';
import { getSession } from './services/adminService';
import { navigation } from './data/navigation';
function ProtectedRoute() { return getSession() ? <Outlet /> : <Navigate to="/login" replace />; }
export default function App() { return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/recover-password" element={<PasswordRecoveryPage />} /><Route element={<ProtectedRoute />}><Route element={<Layout />}><Route index element={<Navigate to="/dashboard" replace />} /><Route path="/dashboard" element={<DashboardPage />} /><Route path="/businesses" element={<BusinessesPage />} /><Route path="/businesses/:id" element={<BusinessDetailShell />} />{navigation.filter(item => item.path !== '/dashboard' && item.path !== '/businesses').map(item => <Route key={item.path} path={item.path} element={<MockModulePage />} />)}{['users', 'reports', 'content', 'reviews', 'needs', 'zones', 'categories', 'notifications', 'audit', 'settings'].map(path => <Route key={path} path={`/${path}/:id`} element={<MockModulePage />} />)}<Route path="*" element={<Navigate to="/dashboard" replace />} /></Route></Route></Routes>; }
