import { useSearchParams } from "react-router-dom";
import { PageLayout } from "../components/PageLayout";
import { NoResultsState } from "../components/NoResultsState";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { getSelectedLocation, hasSampleCatalogForLocation } from "../services/locationService";
import "./NoResults.css";

export default function NoResults() {
  const [params] = useSearchParams();
  const query = params.get("q");
  const location = getSelectedLocation();
  if (!hasSampleCatalogForLocation(location)) {
    return <PageLayout active="explore" className="no-results-page"><LocationAvailabilityNotice location={location} query={query ?? ""}/></PageLayout>;
  }
  return <PageLayout active="explore" className="no-results-page"><NoResultsState term={query ?? undefined} locationName={location?.name ?? "Palmira"}/><small className="no-results-note">La información de WIT crece con las necesidades de cada comunidad.</small></PageLayout>;
}
