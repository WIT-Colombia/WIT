import { AuthProvider } from "../../../usuario/src/context/AuthContext";
import { LocationProvider } from "../../../usuario/src/context/LocationContext";
import BusinessDetail from "../../../usuario/src/pages/BusinessDetail";
import "./BusinessPublicPreviewPage.css";

/** Embeds the existing public profile UI inside the authenticated Business shell. */
export default function BusinessPublicPreviewPage() {
  return <div className="business-public-preview"><AuthProvider><LocationProvider><BusinessDetail /></LocationProvider></AuthProvider></div>;
}
