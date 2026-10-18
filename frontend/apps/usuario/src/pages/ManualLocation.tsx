import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@wit/ui";
import type { Department, Locality } from "../data/locations";
import { getColombianAdministrativeDivisions } from "../services/administrativeDivisionService";
import { useLocationContext } from "../context/LocationContext";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import "./ManualLocation.css";
import "../components/PageLayout.css";

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>;
}

function PinIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
}

export default function ManualLocation() {
  const navigate = useNavigate();
  const { selection, setManualLocation, requestAutomaticLocation, isRequesting } = useLocationContext();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") || "/home";
  const current = selection?.locality ?? null;
  const catalog = getColombianAdministrativeDivisions();
  const [departments] = useState<Department[]>(catalog.departments);
  const [municipalities] = useState<Locality[]>(catalog.municipalities);
  const [departmentCode, setDepartmentCode] = useState(current?.departmentCode ?? "");
  const [municipalityId, setMunicipalityId] = useState(current?.id ?? "");
  const [query, setQuery] = useState(current?.name ?? "");
  const [showMunicipalityOptions, setShowMunicipalityOptions] = useState(false);
  const [automaticError, setAutomaticError] = useState(false);

  useEffect(() => {
    if (!current) return;
    const saved = municipalities.find((item) => item.id === current.id || (item.name === current.name && item.context === current.context))
      ?? (current.context.includes("Palmira") ? municipalities.find((item) => item.name === "Palmira" && item.context === "Valle del Cauca") : undefined);
    if (saved) {
      setDepartmentCode(saved.departmentCode);
      setMunicipalityId(saved.id);
      setQuery(saved.name);
    }
  }, [current, municipalities]);

  const selectedDepartment = departments.find((department) => department.code === departmentCode);
  const departmentMunicipalities = useMemo(() => municipalities.filter((municipality) => municipality.departmentCode === departmentCode), [municipalities, departmentCode]);
  const visibleMunicipalities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-CO");
    if (!normalized) return departmentMunicipalities;
    return departmentMunicipalities.filter((municipality) => municipality.name.toLocaleLowerCase("es-CO").includes(normalized));
  }, [departmentMunicipalities, query]);
  const selectedMunicipality = municipalities.find((municipality) => municipality.id === municipalityId);

  function changeDepartment(code: string) {
    setDepartmentCode(code);
    setMunicipalityId("");
    setQuery("");
    setShowMunicipalityOptions(false);
  }

  function changeMunicipalityQuery(value: string) {
    setQuery(value);
    setShowMunicipalityOptions(value.trim().length > 0);
    if (selectedMunicipality && value.trim().toLocaleLowerCase("es-CO") !== selectedMunicipality.name.toLocaleLowerCase("es-CO")) {
      setMunicipalityId("");
    }
  }

  function selectMunicipality(municipality: Locality) {
    setMunicipalityId(municipality.id);
    setQuery(municipality.name);
    setShowMunicipalityOptions(false);
    setManualLocation(municipality);
  }

  function continueWithLocation() {
    if (!selectedMunicipality) return;
    setManualLocation(selectedMunicipality);
    navigate(returnTo);
  }

  function useCurrentLocation() {
    setAutomaticError(false);
    void requestAutomaticLocation().then(() => navigate(returnTo)).catch(() => setAutomaticError(true));
  }

  return <main className="manual-location-page">
    <SiteHeader />

    <section className="manual-location-content" aria-labelledby="manual-location-title">
      <button className="manual-location-back" type="button" onClick={() => navigate(-1)}><span aria-hidden="true">←</span> Volver</button>
      <div className="manual-location-heading">
        <span className="manual-location-eyebrow"><i /> TODA COLOMBIA</span>
        <h1 id="manual-location-title">¿En qué ciudad<br/><em>estás buscando?</em></h1>
        <p>Selecciona un departamento y luego tu ciudad o municipio. También puedes usar tu ubicación o explorar el mapa.</p>
      </div>

      <div className="national-location-refine"><div><b>¿Quieres una búsqueda más precisa?</b><span>Usa tu ubicación actual o elige un punto en el mapa.</span>{automaticError && <small role="status">Permite el acceso a tu ubicación en el aviso del navegador y vuelve a intentarlo.</small>}</div><div><button className="national-location-auto-link" type="button" disabled={isRequesting} onClick={useCurrentLocation}><PinIcon/> {isRequesting ? "Solicitando permiso…" : "Usar mi ubicación"}</button><Link to={`/location/map?returnTo=${encodeURIComponent(returnTo)}`}>Explorar en el mapa <span aria-hidden="true">↗</span></Link></div></div>

      <div className="national-location-form">
        <label className="national-location-field" htmlFor="department-select"><span>1</span><span className="national-location-field__label">Departamento</span>
          <select id="department-select" value={departmentCode} onChange={(event) => changeDepartment(event.target.value)}>
            <option value="">Selecciona un departamento</option>
            {departments.map((department) => <option key={department.code} value={department.code}>{department.name}</option>)}
          </select>
        </label>

        <div className={`national-location-field${!departmentCode ? " is-disabled" : ""}`}>
          <label htmlFor="municipality-search"><span>2</span><span className="national-location-field__label">Ciudad o municipio</span></label>
          <div className="manual-location-search national-location-search"><SearchIcon/><input id="municipality-search" type="search" value={query} onChange={(event) => changeMunicipalityQuery(event.target.value)} placeholder={departmentCode ? "Escribe para encontrar tu ciudad" : "Primero selecciona el departamento"} autoComplete="off" disabled={!departmentCode}/></div>
          {departmentCode && showMunicipalityOptions && <div className="national-location-options" role="listbox" aria-label="Ciudades y municipios disponibles">
            {visibleMunicipalities.length ? visibleMunicipalities.map((municipality) => <button key={municipality.id} type="button" role="option" aria-selected={municipality.id === municipalityId} className={`national-location-option${municipality.id === municipalityId ? " is-selected" : ""}`} onClick={() => selectMunicipality(municipality)}><span className="manual-location-option__icon"><PinIcon/></span><span className="manual-location-option__copy"><b>{municipality.name}</b><small>{municipality.kind}</small></span>{municipality.id === municipalityId ? <span className="manual-location-option__current">Elegida</span> : <span className="manual-location-option__arrow" aria-hidden="true">→</span>}</button>) : <p className="national-location-no-results">No encontramos coincidencias en {selectedDepartment?.name}. Prueba con otro nombre.</p>}
          </div>}
        </div>

        {selectedMunicipality && <p className="national-location-selection" role="status"><PinIcon/> Buscaremos en <b>{selectedMunicipality.name}, {selectedMunicipality.context}</b></p>}
        <Button className="national-location-continue" type="button" disabled={!selectedMunicipality} onClick={continueWithLocation}><span>Continuar con esta ciudad</span><span className="national-location-continue__arrow" aria-hidden="true">→</span></Button>
      </div>

    </section>

    <SiteFooter />
  </main>;
}
