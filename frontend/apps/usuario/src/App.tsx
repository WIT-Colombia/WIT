import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Location from "./pages/Location";
import ManualLocation from "./pages/ManualLocation";
import Welcome from "./pages/Welcome";
import Search from "./pages/Search";
import Results from "./pages/Results";
import MapPage from "./pages/Map";
import Filters from "./pages/Filters";
import BusinessDetail from "./pages/BusinessDetail";
import { BusinessProducts, BusinessServices } from "./pages/BusinessOffers";
import { ProductDetail, ServiceDetail } from "./pages/OfferDetail";
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
import AccountPrivacy from "./pages/AccountPrivacy";
import Legal from "./pages/Legal";
import PasswordRecovery from "./pages/PasswordRecovery";
import { RequireAccount } from "./components/RequireAccount";

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/home" replace />} />
    <Route path="/home" element={<Home />} />
    <Route path="/welcome" element={<Welcome />} />
    <Route path="/location" element={<Location />} />
    <Route path="/location/manual" element={<ManualLocation />} />
    <Route path="/search" element={<Search />} />
    <Route path="/results" element={<Results />} />
    <Route path="/map" element={<MapPage />} />
    <Route path="/filters" element={<Filters />} />
    <Route path="/business/:id" element={<BusinessDetail />} />
    <Route path="/business/:id/products" element={<BusinessProducts />} />
    <Route path="/business/:id/services" element={<BusinessServices />} />
    <Route path="/product/:id" element={<ProductDetail />} />
    <Route path="/service/:id" element={<ServiceDetail />} />
    <Route path="/directions" element={<Directions />} />
    <Route path="/no-results" element={<NoResults />} />
    <Route path="/register-need" element={<RegisterNeed />} />
    <Route path="/report" element={<Report />} />
    <Route path="/register" element={<Register />} />
    <Route path="/recover-password" element={<PasswordRecovery />} />
    <Route path="/account" element={<RequireAccount><AccountPrivacy /></RequireAccount>} />
    <Route path="/legal/:page" element={<Legal />} />
    <Route path="/favorites" element={<RequireAccount><Favorites /></RequireAccount>} />
    <Route path="/likes" element={<RequireAccount><Likes /></RequireAccount>} />
    <Route path="/reviews" element={<Reviews />} />
    <Route path="/profile" element={<RequireAccount><Profile /></RequireAccount>} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/notifications" element={<Notifications />} />
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes>;
}
