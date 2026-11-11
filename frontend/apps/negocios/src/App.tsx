import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { BusinessStoreProvider, useBusinessStore } from "./services/businessStore";
import { BusinessAuthProvider, useBusinessAuth } from "./services/businessAuthContext";
import { PageMetadata } from "@wit/ui";
import { getAuthPageMetadata, getPrivateAuthPageMetadata, metadataTags } from "@wit/utils";
const AppShell = lazy(() => import("./components/layout/AppShell").then(module => ({ default: module.AppShell })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then(module => ({ default: module.DashboardPage })));
const BusinessDetailPage = lazy(() => import("./pages/BusinessDetailPage").then(module => ({ default: module.BusinessDetailPage })));
const BusinessModalitiesPage = lazy(() => import("./pages/BusinessModalitiesPage").then(module => ({ default: module.BusinessModalitiesPage })));
const SelectedBusinessPage = lazy(() => import("./pages/SelectedBusinessPage").then(module => ({ default: module.SelectedBusinessPage })));
const BusinessPage = lazy(() => import("./pages/BusinessPage").then(module => ({ default: module.BusinessPage })));
const BusinessCreatePage = lazy(() => import("./pages/BusinessCreatePage").then(module => ({ default: module.BusinessCreatePage })));
const CatalogPage = lazy(() => import("./pages/CatalogPage").then(module => ({ default: module.CatalogPage })));
const PromotionsPage = lazy(() => import("./pages/PromotionsPage").then(module => ({ default: module.PromotionsPage })));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage").then(module => ({ default: module.ReviewsPage })));
const StatisticsPage = lazy(() => import("./pages/StatisticsPage").then(module => ({ default: module.StatisticsPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then(module => ({ default: module.NotificationsPage })));
const CollaboratorsPage = lazy(() => import("./pages/CollaboratorsPage").then(module => ({ default: module.CollaboratorsPage })));
const MyCollaborationPage = lazy(() => import("./pages/MyCollaborationPage").then(module => ({ default: module.MyCollaborationPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(module => ({ default: module.SettingsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then(module => ({ default: module.ProfilePage })));
const AuthPage = lazy(() => import("./pages/AuthPage").then(module => ({ default: module.AuthPage })));
const MorePage = lazy(() => import("./pages/MorePage").then(module => ({ default: module.MorePage })));
const LegalPage = lazy(() => import("./pages/LegalPage").then(module => ({ default: module.LegalPage })));
const RecoveryPage = lazy(() => import("./pages/RecoveryPage").then(module => ({ default: module.RecoveryPage })));
const WelcomePage = lazy(() => import("./pages/WelcomePage").then(module => ({ default: module.WelcomePage })));
const NoBusinessPage = lazy(() => import("./pages/NoBusinessPage").then(module => ({ default: module.NoBusinessPage })));
const HelpPage = lazy(() => import("./pages/HelpPage").then(module => ({ default: module.HelpPage })));
const SupportPage = lazy(() => import("./pages/SupportPage").then(module => ({ default: module.SupportPage })));
const BusinessPublicPreviewPage = lazy(() => import("./pages/BusinessPublicPreviewPage"));
const GoogleCallback = lazy(() => import("./pages/GoogleCallback"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));

function BusinessPermissionRoute({ children, permission, ownerOnly = false }: { children: ReactNode; permission?: string; ownerOnly?: boolean }) {
  const { business, businessesReady } = useBusinessStore();
  if (!businessesReady) return null;
  const authorized = business.role === "Propietario" || (!ownerOnly && Boolean(permission && business.permissions?.includes(permission)));
  return authorized ? children : <Navigate to="/" replace />;
}
function CollaborationRoute({ children }: { children: ReactNode }) {
  const { business, businessesReady } = useBusinessStore();
  if (!businessesReady) return null;
  return business.source === "real" && business.role === "Colaborador" ? children : <Navigate to="/" replace />;
}

// Keep the standard Business sidebar and desktop header for signed-in users.
 // Password reset links must remain accessible to guests from the login screen.
function BusinessRecoveryLayout() {
  const { state } = useBusinessAuth();
  if (state.status === "unchecked") return <main className="auth-page"><p className="auth-status">Comprobando tu sesión…</p></main>;
  return state.status === "authenticated" ? <AppShell /> : <Outlet />;
}

// Legal documents are standalone during registration, but use the Business
// sidebar and desktop header when opened from an authenticated profile.
function BusinessLegalLayout() {
  const { state } = useBusinessAuth();
  const location = useLocation();
  const fromProfile = new URLSearchParams(location.search).get("from") === "perfil";
  if (!fromProfile) return <Outlet />;
  if (state.status === "unchecked") return <main className="auth-page"><p className="auth-status">Comprobando tu sesión…</p></main>;
  return state.status === "authenticated" ? <AppShell /> : <Outlet />;
}

function PrivateAuthMetadata() {
  const { pathname } = useLocation();
  if (["/login", "/registro"].includes(pathname)) return null;
  const fallback = getAuthPageMetadata("business", "login");
  const metadata = getPrivateAuthPageMetadata("business", pathname) ?? { ...fallback, title: fallback.fallbackTitle, description: fallback.fallbackDescription, structuredData: {} };
  return metadata ? <PageMetadata {...metadata} tags={metadataTags(metadata)} /> : null;
}

export default function App() {
  return <BusinessAuthProvider><BusinessStoreProvider><PrivateAuthMetadata /><Suspense fallback={<main role="status" aria-live="polite" style={{ minHeight: "100svh", display: "grid", placeItems: "center" }}>Cargando página…</main>}><Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/registro" element={<AuthPage mode="register" />} />
    <Route path="/auth/google/callback" element={<GoogleCallback />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route element={<BusinessRecoveryLayout />}><Route path="/recuperar" element={<RecoveryPage />} /></Route>
    <Route path="/bienvenida" element={<WelcomePage />} />
    <Route path="/sin-negocio" element={<NoBusinessPage />} />
    <Route element={<BusinessLegalLayout />}><Route path="/legal/:page" element={<LegalPage />} /></Route>
    <Route path="/preview" element={<AppShell demoMode />}><Route index element={<DashboardPage />} /></Route>
    <Route element={<AppShell />}>
      <Route path="/" element={<Navigate to="/inicio" replace />} />
      <Route path="/inicio" element={<DashboardPage />} />
      <Route path="/mi-negocio" element={<BusinessPermissionRoute permission="EDIT_BUSINESS"><SelectedBusinessPage /></BusinessPermissionRoute>} />
      <Route path="/mis-negocios" element={<BusinessPage />} />
      <Route path="/mis-negocios/nuevo" element={<BusinessCreatePage />} />
      <Route path="/mis-negocios/editar/:index" element={<BusinessPermissionRoute permission="EDIT_BUSINESS"><BusinessCreatePage /></BusinessPermissionRoute>} />
      <Route path="/mi-negocio/detalle/:index" element={<BusinessPermissionRoute permission="EDIT_BUSINESS"><BusinessDetailPage /></BusinessPermissionRoute>} />
      <Route path="/mi-negocio/preview/:id" element={<BusinessPublicPreviewPage />} />
      <Route path="/mi-negocio/modalidades" element={<BusinessPermissionRoute permission="EDIT_BUSINESS"><BusinessModalitiesPage /></BusinessPermissionRoute>} />
      <Route path="/mi-negocio/modalidades/:index" element={<BusinessPermissionRoute permission="EDIT_BUSINESS"><BusinessModalitiesPage /></BusinessPermissionRoute>} />
      <Route path="/productos" element={<BusinessPermissionRoute permission="MANAGE_CATALOG"><CatalogPage kind="product" /></BusinessPermissionRoute>} />
      <Route path="/servicios" element={<BusinessPermissionRoute permission="MANAGE_CATALOG"><CatalogPage kind="service" /></BusinessPermissionRoute>} />
      <Route path="/ofertas" element={<BusinessPermissionRoute permission="MANAGE_PROMOTIONS"><PromotionsPage /></BusinessPermissionRoute>} />
      <Route path="/opiniones" element={<BusinessPermissionRoute ownerOnly><ReviewsPage /></BusinessPermissionRoute>} />
      <Route path="/estadisticas" element={<BusinessPermissionRoute permission="READ_ANALYTICS"><StatisticsPage /></BusinessPermissionRoute>} />
      <Route path="/notificaciones" element={<NotificationsPage />} />
      <Route path="/colaboradores" element={<BusinessPermissionRoute ownerOnly><CollaboratorsPage /></BusinessPermissionRoute>} />
      <Route path="/mi-colaboracion" element={<CollaborationRoute><MyCollaborationPage /></CollaborationRoute>} />
      <Route path="/configuracion" element={<BusinessPermissionRoute ownerOnly><SettingsPage /></BusinessPermissionRoute>} />
      <Route path="/perfil" element={<ProfilePage />} />
      <Route path="/mas" element={<MorePage />} />
      <Route path="/ayuda" element={<HelpPage />} />
      <Route path="/soporte" element={<SupportPage />} />
      <Route path="/sugerencias" element={<SupportPage mode="suggestion" />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></BusinessStoreProvider></BusinessAuthProvider>;
}
