import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import Home from "./pages/Home";
import ManualLocation from "./pages/ManualLocation";
import Location from "./pages/Location";
import LocationMap from "./pages/LocationMap";
import Results from "./pages/Results";
import MapPage from "./pages/Map";
import Filters from "./pages/Filters";
import BusinessDetail from "./pages/BusinessDetail";
import { BusinessProducts, BusinessServices } from "./pages/BusinessOffers";
import { ProductDetail, ServiceDetail } from "./pages/OfferDetail";
import SpecialPromotionDetail from "./pages/SpecialPromotionDetail";
import Directions from "./pages/Directions";
import NoResults from "./pages/NoResults";
import RegisterNeed from "./pages/RegisterNeed";
import Report from "./pages/Report";
import Favorites from "./pages/Favorites";
import Likes from "./pages/Likes";
import Reviews from "./pages/Reviews";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Register from "./pages/Register";
import Legal from "./pages/Legal";
import PasswordRecovery from "./pages/PasswordRecovery";
import RecoverPassword from "./pages/RecoverPassword";
import VerifyEmail from "./pages/VerifyEmail";
import GoogleCallback from "./pages/GoogleCallback";
import { RequireAccount } from "./components/RequireAccount";
import { SiteFooter } from "./components/SiteFooter";

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

function StandaloneFooter() {
  const { pathname } = useLocation();
  const authPages = ["/recover-password", "/reset-password", "/verify-email", "/auth/google/callback"];
  return authPages.includes(pathname) ? <SiteFooter /> : null;
}

export default function App() {
  return <><ScrollToTop /><Routes>
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
    <Route path="/recover-password" element={<RecoverPassword />} />
    <Route path="/reset-password" element={<PasswordRecovery />} />
    <Route path="/verify-email" element={<VerifyEmail />} />
    <Route path="/auth/google/callback" element={<GoogleCallback />} />
    <Route path="/change-password" element={<RequireAccount><PasswordRecovery /></RequireAccount>} />
    <Route path="/account" element={<RequireAccount><Navigate to="/settings" replace /></RequireAccount>} />
    <Route path="/legal/:page" element={<Legal />} />
    <Route path="/favorites" element={<RequireAccount><Favorites /></RequireAccount>} />
    <Route path="/likes" element={<RequireAccount><Likes /></RequireAccount>} />
    <Route path="/reviews" element={<Reviews />} />
    <Route path="/profile" element={<RequireAccount><Profile /></RequireAccount>} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/notifications" element={<Notifications />} />
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes><StandaloneFooter /></>;
}
