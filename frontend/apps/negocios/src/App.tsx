import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { BusinessStoreProvider, useBusinessStore } from "./services/businessStore";
import { BusinessDetailPage } from "./pages/BusinessDetailPage";
import { BusinessModalitiesPage } from "./pages/BusinessModalitiesPage";
import { SelectedBusinessPage } from "./pages/SelectedBusinessPage";
import { BusinessPage } from "./pages/BusinessPage";
import { BusinessCreatePage } from "./pages/BusinessCreatePage";
import { CatalogPage } from "./pages/CatalogPage";
import { PromotionsPage } from "./pages/PromotionsPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { CollaboratorsPage } from "./pages/CollaboratorsPage";
import { MyCollaborationPage } from "./pages/MyCollaborationPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AuthPage } from "./pages/AuthPage";
import { MorePage } from "./pages/MorePage";
import { LegalPage } from "./pages/LegalPage";
import { RecoveryPage } from "./pages/RecoveryPage";
import { WelcomePage } from "./pages/WelcomePage";
import { NoBusinessPage } from "./pages/NoBusinessPage";
import { HelpPage } from "./pages/HelpPage";
import BusinessPublicPreviewPage from "./pages/BusinessPublicPreviewPage";
import { BusinessAuthProvider } from "./services/businessAuthContext";

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

export default function App() {
  return <BusinessAuthProvider><BusinessStoreProvider><Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/registro" element={<AuthPage mode="register" />} />
    <Route path="/recuperar" element={<RecoveryPage />} />
    <Route path="/bienvenida" element={<WelcomePage />} />
    <Route path="/sin-negocio" element={<NoBusinessPage />} />
    <Route path="/legal/:page" element={<LegalPage />} />
    <Route path="/preview" element={<AppShell demoMode />}><Route index element={<DashboardPage />} /></Route>
    <Route element={<AppShell />}>
      <Route path="/" element={<DashboardPage />} />
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
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BusinessStoreProvider></BusinessAuthProvider>;
}
