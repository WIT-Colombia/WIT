import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { BusinessStoreProvider } from "./services/businessStore";
import { BusinessDetailPage } from "./pages/BusinessDetailPage";
import { BusinessModalitiesPage } from "./pages/BusinessModalitiesPage";
import { SelectedBusinessPage } from "./pages/SelectedBusinessPage";
import { BusinessPage } from "./pages/BusinessPage";
import { BusinessCreatePage } from "./pages/BusinessCreatePage";
import { CatalogPage } from "./pages/CatalogPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AuthPage } from "./pages/AuthPage";
import { MorePage } from "./pages/MorePage";
import { LegalPage } from "./pages/LegalPage";
import { RecoveryPage } from "./pages/RecoveryPage";
import { WelcomePage } from "./pages/WelcomePage";
import { NoBusinessPage } from "./pages/NoBusinessPage";
import { HelpPage } from "./pages/HelpPage";
import { BusinessAuthProvider } from "./services/businessAuthContext";

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
      <Route path="/mi-negocio" element={<SelectedBusinessPage />} />
      <Route path="/mis-negocios" element={<BusinessPage />} />
      <Route path="/mis-negocios/nuevo" element={<BusinessCreatePage />} />
      <Route path="/mis-negocios/editar/:index" element={<BusinessCreatePage />} />
      <Route path="/mi-negocio/detalle/:index" element={<BusinessDetailPage />} />
      <Route path="/mi-negocio/modalidades" element={<BusinessModalitiesPage />} />
      <Route path="/mi-negocio/modalidades/:index" element={<BusinessModalitiesPage />} />
      <Route path="/productos" element={<CatalogPage kind="product" />} />
      <Route path="/servicios" element={<CatalogPage kind="service" />} />
      <Route path="/opiniones" element={<ReviewsPage />} />
      <Route path="/estadisticas" element={<StatisticsPage />} />
      <Route path="/notificaciones" element={<NotificationsPage />} />
      <Route path="/configuracion" element={<SettingsPage />} />
      <Route path="/perfil" element={<ProfilePage />} />
      <Route path="/mas" element={<MorePage />} />
      <Route path="/ayuda" element={<HelpPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BusinessStoreProvider></BusinessAuthProvider>;
}
