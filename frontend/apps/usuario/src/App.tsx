import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Component, lazy, Suspense, useEffect, useRef, type ReactNode, type ErrorInfo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useLocationContext } from "./context/LocationContext";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Results from "./pages/Results";
import MapPage from "./pages/Map";
import BusinessDetail from "./pages/BusinessDetail";
import { ProductDetail, ServiceDetail } from "./pages/OfferDetail";
import { RequireAccount } from "./components/RequireAccount";
import { SiteFooter } from "./components/SiteFooter";
import { PageMetadata } from "@wit/ui";
import { getAuthPageMetadata, getPrivateAuthPageMetadata, metadataTags } from "@wit/utils";
const ManualLocation = lazy(() => import("./pages/ManualLocation"));
const Location = lazy(() => import("./pages/Location"));
const LocationMap = lazy(() => import("./pages/LocationMap"));
const Filters = lazy(() => import("./pages/Filters"));
const BusinessProducts = lazy(() => import("./pages/BusinessOffers").then(module => ({ default: module.BusinessProducts })));
const BusinessServices = lazy(() => import("./pages/BusinessOffers").then(module => ({ default: module.BusinessServices })));
const SpecialPromotionDetail = lazy(() => import("./pages/SpecialPromotionDetail"));
const Directions = lazy(() => import("./pages/Directions"));
const NoResults = lazy(() => import("./pages/NoResults"));
const RegisterNeed = lazy(() => import("./pages/RegisterNeed"));
const Report = lazy(() => import("./pages/Report"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Likes = lazy(() => import("./pages/Likes"));
const Reviews = lazy(() => import("./pages/Reviews"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Legal = lazy(() => import("./pages/Legal"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const PasswordRecovery = lazy(() => import("./pages/PasswordRecovery"));
const RecoverPassword = lazy(() => import("./pages/RecoverPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const GoogleCallback = lazy(() => import("./pages/GoogleCallback"));

/**
 * If a user kept the site open during a Cloudflare publish, a lazy route may
 * reference an asset from the previous build. Recover once automatically,
 * instead of leaving guests on a blank screen until they press Refresh.
 */
class RouteNavigationBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    const chunkFailed = /failed to fetch dynamically imported module|importing a module script failed|failed to load module script|chunkloaderror|unable to preload css|loading chunk .* failed/i.test(error.message);
    if (!chunkFailed) return;
    try {
      const key = `xamuko:route-load-recovered:${window.location.pathname}`;
      const previous = Number(window.sessionStorage.getItem(key) || 0);
      if (!previous || Date.now() - previous > 5 * 60_000) {
        window.sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // Browser storage restrictions must never prevent the fallback UI.
    }
  }

  render() {
    if (this.state.error) {
      return <main role="alert" style={{ minHeight: "65svh", display: "grid", placeContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, color: "#19213B", margin: 0 }}>No pudimos abrir esta página</h1>
        <p style={{ color: "#566481", margin: 0 }}>La conexión o una actualización del sitio interrumpió la carga. Puedes intentarlo nuevamente.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 12, padding: "13px 20px", background: "#7B3FFB", color: "white", fontWeight: 700, cursor: "pointer" }}>Reintentar</button>
        <a href="/home" style={{ color: "#7B3FFB" }}>Volver al inicio</a>
      </main>;
    }
    return this.props.children;
  }
}

function ScrollToTop() {
  const location = useLocation();
  const previousLocation = useRef<{ pathname: string; search: string } | null>(null);

  useEffect(() => {
    const previous = previousLocation.current;
    const isSameBusiness = previous?.pathname === location.pathname && location.pathname.startsWith("/business/");
    const previousParams = new URLSearchParams(previous?.search ?? "");
    const currentParams = new URLSearchParams(location.search);
    previousParams.delete("tab");
    currentParams.delete("tab");
    const changedOnlyTab = isSameBusiness && previousParams.toString() === currentParams.toString();

    if (!changedOnlyTab) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    previousLocation.current = { pathname: location.pathname, search: location.search };
  }, [location.pathname, location.search]);

  return null;
}

function SearchRedirect() {
  const location = useLocation();
  return <Navigate to={`/home${location.search}`} replace />;
}

function ManualLocationRedirect() {
  const location = useLocation();
  return <Navigate to={`/location${location.search}${location.hash}`} replace />;
}

/**
 * Resend may point at the legacy /reset-password or /recuperar URL.
 * Keep those links working but show one canonical change-password page.
 */
function PasswordResetLinkRedirect() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get("token")?.trim();
  return token
    ? <Navigate to={`/change-password${location.search}`} replace />
    : <Navigate to="/recover-password" replace />;
}

function RecoverPasswordEntry() {
  const location = useLocation();
  return new URLSearchParams(location.search).get("token")?.trim()
    ? <PasswordResetLinkRedirect />
    : <RecoverPassword />;
}

function ChangePasswordEntry() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get("token")?.trim();
  // A valid reset token authorizes password replacement without a login.
  // The backend validates and consumes the token; no password is disclosed.
  return token ? <PasswordRecovery /> : <RequireAccount><PasswordRecovery /></RequireAccount>;
}

function StandaloneFooter() {
  const { pathname } = useLocation();
  const authPages = ["/recover-password", "/reset-password", "/recuperar", "/change-password", "/verify-email", "/auth/google/callback"];
  return authPages.includes(pathname) ? <SiteFooter /> : null;
}

function InitialLocationGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const route = useLocation();
  const { status } = useAuth();
  const { selection, isReady, requestAutomaticLocation } = useLocationContext();
  const attempted = useRef(false);
  useEffect(() => {
    if (route.pathname !== "/home" || status === "loading" || !isReady || selection || attempted.current) return;
    attempted.current = true;
    void requestAutomaticLocation().catch(() => navigate("/location?returnTo=" + encodeURIComponent("/home"), { replace: true }));
  }, [isReady, navigate, requestAutomaticLocation, route.pathname, selection, status]);
  return <>{children}</>;
}

function PrivateAuthMetadata() {
  const { pathname } = useLocation();
  if (pathname === "/register" || /^\/(business|product|service)\/[^/]+\/?$/.test(pathname)) return null;
  const fallback = getAuthPageMetadata("usuario", "login");
  const metadata = getPrivateAuthPageMetadata("usuario", pathname) ?? { ...fallback, title: fallback.fallbackTitle, description: fallback.fallbackDescription, structuredData: {} };
  return metadata ? <PageMetadata {...metadata} tags={metadataTags(metadata)} /> : null;
}

export default function App() {
  const route = useLocation();
  return <InitialLocationGate><PrivateAuthMetadata /><ScrollToTop /><RouteNavigationBoundary key={route.pathname}><Suspense fallback={<main role="status" aria-live="polite" style={{ minHeight: "100svh", display: "grid", placeItems: "center" }}>Cargando página…</main>}><Routes>
    <Route path="/" element={<Navigate to="/home" replace />} />
    <Route path="/home" element={<Home />} />
    <Route path="/welcome" element={<Navigate to="/home" replace />} />
    <Route path="/location" element={<ManualLocation />} />
    <Route path="/location/automatic" element={<Location />} />
    <Route path="/location/map" element={<LocationMap />} />
    <Route path="/location/manual" element={<ManualLocationRedirect />} />
    <Route path="/search" element={<SearchRedirect />} />
    <Route path="/results" element={<Results />} />
    <Route path="/map" element={<MapPage />} />
    <Route path="/filters" element={<Filters />} />
    <Route path="/business/:id" element={<BusinessDetail />} />
    <Route path="/business/:id/products" element={<BusinessProducts />} />
    <Route path="/business/:id/services" element={<BusinessServices />} />
    <Route path="/product/:id" element={<ProductDetail />} />
    <Route path="/service/:id" element={<ServiceDetail />} />
    <Route path="/promociones/:id" element={<SpecialPromotionDetail />} />
    <Route path="/directions" element={<Directions />} />
    <Route path="/no-results" element={<NoResults />} />
    <Route path="/register-need" element={<RegisterNeed />} />
    <Route path="/report" element={<Report />} />
    <Route path="/register" element={<Register />} />
    <Route path="/recover-password" element={<RecoverPasswordEntry />} />
    <Route path="/reset-password" element={<PasswordResetLinkRedirect />} />
    <Route path="/recuperar" element={<PasswordResetLinkRedirect />} />
    <Route path="/verify-email" element={<VerifyEmail />} />
    <Route path="/auth/google/callback" element={<GoogleCallback />} />
    <Route path="/change-password" element={<ChangePasswordEntry />} />
    <Route path="/account" element={<RequireAccount><Navigate to="/settings" replace /></RequireAccount>} />
    <Route path="/legal/:page" element={<Legal />} />
    <Route path="/ayuda/preguntas-frecuentes" element={<FaqPage />} />
    <Route path="/favorites" element={<RequireAccount><Favorites /></RequireAccount>} />
    <Route path="/likes" element={<RequireAccount><Likes /></RequireAccount>} />
    <Route path="/reviews" element={<Reviews />} />
    <Route path="/profile" element={<RequireAccount><Profile /></RequireAccount>} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/notifications" element={<Notifications />} />
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes></Suspense></RouteNavigationBoundary><StandaloneFooter /></InitialLocationGate>;
}
