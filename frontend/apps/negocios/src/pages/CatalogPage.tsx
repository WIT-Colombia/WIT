import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { FormField } from "../components/common/FormField";
import { useBusinessStore } from "../services/businessStore";
import { businessApi } from "../services/businessApiClient";
import { toCatalogItem, toOfferInput } from "../services/catalogAdapter";
import { businessCatalog } from "../data/business.mock";
import type { CatalogItem, CatalogKind } from "../types/business";

const blank = (kind: CatalogKind): CatalogItem => ({ id: "", kind, name: "", category: "", description: "", price: "", image: kind === "product" ? "📦" : "✨", images: [], priceNegotiable: false, active: true, interest: 0 });

const formatCatalogPrice = (item: CatalogItem) => {
  if (item.priceNegotiable) return "Precio a convenir";
  const normalized = item.price.trim().replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!normalized || !Number.isFinite(amount)) return "Consultar precio";
  const currency = item.currency ?? "COP";
  return `${new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount).replace(/\u00a0/g, " ")} ${currency}`;
};

export function CatalogPage({ kind }: { kind: CatalogKind }) {
  const { items: storedItems, setItems, business, businesses, setBusiness, setBusinesses } = useBusinessStore();
  const personalCatalog = businesses.length === 0 || business.isNew || !businessCatalog[business.name];
  const [realItems, setRealItems] = useState<CatalogItem[]>([]);
  const [privateImageUrls, setPrivateImageUrls] = useState<Record<string, string>>({});
  const [realCatalogLoading, setRealCatalogLoading] = useState(false);
  const [likeCountsError, setLikeCountsError] = useState(false);
  const [catalogLimits, setCatalogLimits] = useState<import("../services/businessApiClient").CatalogLimits | null>(null);
  const isRealBusiness = business.source === "real" && Boolean(business.id);
  const items = isRealBusiness ? realItems : (business.catalog ?? (businessCatalog[business.name] ?? (personalCatalog ? storedItems : [])));
  const [searchParams, setSearchParams] = useSearchParams();
  const isProduct = kind === "product";
  const demoPro = searchParams.get("demoPro") === "1";
  const title = isProduct ? "Productos" : "Servicios";
  const singular = isProduct ? "producto" : "servicio";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [draft, setDraft] = useState<CatalogItem | null>(() => searchParams.has("nuevo") ? blank(kind) : null);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
  const pendingImageKeys = useRef(new Set<string>());
  useEffect(() => {
    if (!isRealBusiness || !business.id) return;
    let active = true;
    setRealCatalogLoading(true);
    setLikeCountsError(false);
    const selectedBusinessId = business.id;
    businessApi.listOffers(selectedBusinessId, kind === "product" ? "PRODUCT" : "SERVICE").then(async ({ offers }) => {
      try {
        const { offers: counts } = await businessApi.getOfferLikeCounts(selectedBusinessId);
        const countMap = new Map(counts.map((entry) => [entry.offerId, entry.likeCount]));
        if (active) setRealItems(offers.map((offer) => ({ ...toCatalogItem(offer), interest: countMap.get(offer.id) ?? 0 })));
      } catch {
        if (active) { setLikeCountsError(true); setRealItems(offers.map((offer) => ({ ...toCatalogItem(offer), interest: -1 }))); }
      }
    }).catch(() => { if (active) setRealItems([]); }).finally(() => { if (active) setRealCatalogLoading(false); });
    return () => { active = false; };
  }, [business.id, isRealBusiness, kind]);
  useEffect(() => {
    if (!isRealBusiness || !business.id) { setCatalogLimits(null); return; }
    let active = true;
    businessApi.getCatalogLimits(business.id).then(value => { if (active) setCatalogLimits(value); }).catch(() => { if (active) setCatalogLimits(null); });
    return () => { active = false; };
  }, [business.id, isRealBusiness, realItems.length]);
  useEffect(() => { if (!draft && searchParams.has("nuevo")) setSearchParams({}, { replace: true }); }, [draft, searchParams, setSearchParams]);
  useEffect(() => {
    let cancelled = false;
    const sources = realItems.flatMap(item => { const source = item.images?.[0] ?? item.image; return source.startsWith("/api/v1/businesses/") ? [{ id: item.id, source }] : []; });
    if (!sources.length) { setPrivateImageUrls({}); return; }
    Promise.all(sources.map(async ({ id, source }) => { try { return [id, URL.createObjectURL(await businessApi.photoBlob(source))] as const; } catch { return null; } })).then(results => {
      if (cancelled) { results.forEach(result => { if (result) URL.revokeObjectURL(result[1]); }); return; }
      setPrivateImageUrls(Object.fromEntries(results.filter((result): result is readonly [string, string] => Boolean(result))));
    });
    return () => { cancelled = true; setPrivateImageUrls(current => { Object.values(current).forEach(url => URL.revokeObjectURL(url)); return {}; }); };
  }, [realItems]);

  useEffect(() => {
    if (!draft) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDraft(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [draft]);
  const [removing, setRemoving] = useState<CatalogItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const categoryOptions = ["Todas las categorías", ...new Set(items.filter(item => item.kind === kind).map(item => item.category.trim()).filter(Boolean))];
  const visible = useMemo(() => items.filter(item => item.kind === kind && (filter === "Todos" || filter === "Activos" && item.active || filter === "Inactivos" && !item.active || filter === item.category) && `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [items, kind, filter, query]);
  const change = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft(current => current ? { ...current, [event.target.name]: event.target.value } : current);
  const clearEditorImage = () => { if (editorImageUrl) URL.revokeObjectURL(editorImageUrl); setEditorImageUrl(null); };
  const openEditor = async (item: CatalogItem) => {
    clearEditorImage();
    const images = item.images ?? ((item.image.startsWith("data:") || item.image.startsWith("http") || item.image.startsWith("/api/")) ? [item.image] : []);
    setDraft({ ...item, images });
    const source = images[0];
    if (!source?.startsWith("/api/v1/businesses/")) return;
    try {
      const objectUrl = URL.createObjectURL(await businessApi.photoBlob(source));
      setEditorImageUrl(objectUrl);
    } catch {
      setEditorImageUrl(null);
    }
  };
  const changeImages = (event: ChangeEvent<HTMLInputElement>) => {
    const file = Array.from(event.target.files ?? []).find(candidate => candidate.type.startsWith("image/"));
    if (!file) return;
    clearEditorImage();
    const fileKey = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    if (pendingImageKeys.current.has(fileKey)) { event.target.value = ""; return; }
    pendingImageKeys.current.add(fileKey);
    setDraft(current => {
      if (!current) return current;
      const reader = new FileReader();
      reader.onload = () => setDraft(latest => {
        pendingImageKeys.current.delete(fileKey);
        if (!latest) return latest;
        const image = String(reader.result);
        return image ? { ...latest, images: [image], image } : latest;
      });
      reader.onerror = () => pendingImageKeys.current.delete(fileKey);
      reader.readAsDataURL(file);
      return current;
    });
    event.target.value = "";
  };
  const removeImage = (index: number) => { clearEditorImage(); setDraft(current => {
    if (!current) return current;
    const images = (current.images ?? []).filter((_, imageIndex) => imageIndex !== index);
    return { ...current, images, image: images[0] ?? (current.kind === "product" ? "📦" : "✨") };
  }); };
  const closeEditor = () => { clearEditorImage(); setDraft(null); if (searchParams.has("nuevo")) setSearchParams({}, { replace: true }); };
  const removeOffer = async () => {
    if (!removing || deletingId) return;
    setDeletingId(removing.id); setDeleteError(null);
    try {
      if (isRealBusiness && business.id) {
        await businessApi.deleteOffer(business.id, removing.id);
        setRealItems(current => current.filter(item => item.id !== removing.id));
      } else {
        persistItems(items.filter(item => item.id !== removing.id));
      }
      setRemoving(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar el elemento.");
    } finally { setDeletingId(null); }
  };
  const persistItems = (next: CatalogItem[]) => {
    setItems(next);
    const updated = { ...business, catalog: next };
    setBusiness(updated);
    setBusinesses(businesses.map(item => item.name === business.name ? updated : item));
  };
  const save = async (event: FormEvent) => { event.preventDefault(); if (!draft) return; const images = Array.from(new Set(draft.images ?? [])).slice(0, 1); const entry = { ...draft, id: draft.id || `${kind}-${Date.now()}`, category: isProduct ? "" : draft.category, images, image: (images[0] ?? draft.image) }; if (isRealBusiness && business.id) { const input = toOfferInput(entry, kind, !draft.id); let savedOfferId = draft.id; if (draft.id) await businessApi.updateOffer(business.id, draft.id, input); else { const created = await businessApi.createOffer(business.id, input); savedOfferId = created.offer.id; } if (savedOfferId && images[0]?.startsWith("data:")) { const response = await fetch(images[0]); const blob = await response.blob(); await businessApi.uploadOfferPhoto(business.id, savedOfferId, new File([blob], "producto", { type: blob.type })); } const [{ offers }, { offers: counts }] = await Promise.all([businessApi.listOffers(business.id, kind === "product" ? "PRODUCT" : "SERVICE"), businessApi.getOfferLikeCounts(business.id)]); const countMap = new Map(counts.map(count => [count.offerId, count.likeCount])); setLikeCountsError(false); setRealItems(offers.map(offer => ({ ...toCatalogItem(offer), interest: countMap.get(offer.id) ?? 0 })).map(item => item.id === entry.id ? { ...item, image: entry.image, images: entry.images } : item)); } else persistItems(draft.id ? items.map(item => item.id === draft.id ? entry : item) : [entry, ...items]); closeEditor(); };
  const quota = catalogLimits ? (isProduct ? catalogLimits.products : catalogLimits.services) : null;
  const counterLimit = demoPro || quota?.unlimited ? "Ilimitado" : quota?.limit ?? "—";
  const canCreate = !isRealBusiness || !quota || quota.unlimited || (quota.available !== null && quota.available > 0);
  return <><PageHeader eyebrow="TU OFERTA" title={title} description={`${title} de ${businesses.length === 0 ? "tu primera tienda" : business.name}. Administra lo que las personas pueden descubrir en XAMUKO.`} action={<button className="action-button" type="button" disabled={!canCreate} onClick={() => setDraft(blank(kind))}>＋ Agregar {singular}</button>} /><section className="surface-card catalog-surface">{realCatalogLoading && <p className="auth-status">Cargando {title.toLowerCase()}…</p>}<div className="catalog-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Buscar {title.toLowerCase()}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Buscar ${title.toLowerCase()}...`} /></label><label className="filter-box"><span className="sr-only">Filtrar {title.toLowerCase()}</span><select value={filter} onChange={event => setFilter(event.target.value)}><option>Todos</option><option>Activos</option><option>Inactivos</option>{categoryOptions.slice(1).map(category => <option key={category}>{category}</option>)}</select></label></div><div className="catalog-summary"><strong>{title}: {quota ? `${quota.used}/${counterLimit}` : `${visible.length}/${demoPro ? "Ilimitado" : "—"}`}</strong>{quota?.available === 0 && <span>Has alcanzado el límite para este nivel.</span>}</div>{visible.length ? <div className="catalog-list">{visible.map(item => <article className="catalog-row" key={item.id}><div className="catalog-art" aria-hidden="true">{privateImageUrls[item.id] ? <img src={privateImageUrls[item.id]} alt="" /> : (item.images?.[0] ?? item.image).startsWith("/api/v1/businesses/") ? <span aria-label="Cargando fotografía" /> : (item.images?.[0] ?? item.image).startsWith("data:") || (item.images?.[0] ?? item.image).startsWith("http") ? <img src={item.images?.[0] ?? item.image} alt="" /> : (item.images?.[0] ?? item.image)}</div><div className="catalog-info"><h2>{item.name}</h2><p>{item.kind === "product" ? item.description : `${item.category} · ${item.description}`}</p><span>{formatCatalogPrice(item)}</span>{item.adultOnly && <small className="catalog-adult-badge">+18</small>}</div><div className="catalog-interest"><strong>{item.interest >= 0 ? <><span className="catalog-like-icon" aria-hidden="true">♥</span> {item.interest}</> : "—"}</strong><small>{likeCountsError ? "No disponible" : "me gusta"}</small></div><span className={`state-tag ${item.active ? "on" : "off"}`}>{item.active ? "Activo" : "Inactivo"}</span><div className="row-actions"><button type="button" onClick={() => { void openEditor(item); }}>Editar</button><button type="button" onClick={() => isRealBusiness && business.id ? businessApi.updateOffer(business.id, item.id, { active: !item.active, ...(!item.active && item.publicationStatus === "UNPUBLISHED" ? { publicationStatus: "PUBLISHED" as const } : {}) }).then(() => setRealItems(current => current.map(entry => entry.id === item.id ? { ...entry, active: !entry.active, ...(!entry.active && entry.publicationStatus === "UNPUBLISHED" ? { publicationStatus: "PUBLISHED" as const } : {}) } : entry))) : persistItems(items.map(current => current.id === item.id ? { ...current, active: !current.active } : current))}>{item.active ? "Desactivar" : "Activar"}</button><button type="button" className="danger-link" onClick={() => setRemoving(item)}>Eliminar</button></div></article>)}</div> : <div className="empty-state"><span>◇</span><h2>No encontramos {title.toLowerCase()}</h2><p>{query || filter !== "Todos" ? "Prueba otra búsqueda o cambia el filtro." : `Agrega tu primer ${singular} para empezar.`}</p><button className="outline-button" type="button" onClick={() => { setQuery(""); setFilter("Todos"); }}>Limpiar filtros</button></div>}</section>{draft && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor(); }}><section className="modal-card product-editor-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-dialog-title"><div className="modal-heading"><div><span className="page-eyebrow">TU OFERTA</span><h2 id="catalog-dialog-title">{draft.id ? "Editar" : "Agregar"} {singular}</h2><p className="product-editor-intro">Completa la información que verán las personas en XAMUKO.</p></div><button type="button" className="close-button" onClick={closeEditor} aria-label="Cerrar">×</button></div><form onSubmit={save} className="modal-form"><FormField label={`Nombre del ${singular}`} name="name" value={draft.name} onChange={change} placeholder={isProduct ? "Ej. Arepa con queso" : "Ej. Servicio a domicilio"} required /><FormField label="Descripción (opcional)" name="description" value={draft.description} onChange={change} as="textarea" placeholder={isProduct ? "Describe brevemente el producto, sus ingredientes o características." : "Describe brevemente en qué consiste el servicio y qué incluye."} /><FormField label="Precio (COP)" name="price" value={draft.price} onChange={change} placeholder="Ej. 12000" disabled={Boolean(draft.priceNegotiable)} hint="Ingresa el valor en pesos colombianos. También puedes marcar ‘Precio a convenir’." /><label className="price-negotiable-field"><input type="checkbox" checked={Boolean(draft.priceNegotiable)} onChange={event => setDraft(current => current ? { ...current, priceNegotiable: event.target.checked, price: event.target.checked ? "No aplica" : "" } : current)} /> <span>Precio a convenir</span></label><fieldset className="adult-classification-field"><legend>Restricción de edad</legend><label><input type="radio" name="adultOnly" checked={!draft.adultOnly} onChange={() => setDraft(current => current ? { ...current, adultOnly: false } : current)} /> Apto para todo público</label><label><input type="radio" name="adultOnly" checked={Boolean(draft.adultOnly)} onChange={() => setDraft(current => current ? { ...current, adultOnly: true } : current)} /> Exclusivo para mayores de 18 años</label><p>Debes clasificar correctamente los productos y servicios sujetos a restricciones de edad. XAMUKO podrá revisar o modificar esta clasificación conforme a sus políticas.</p>{business.adultOnly && <small>Tu establecimiento está clasificado como +18; todo su catálogo se restringe públicamente, sin cambiar esta clasificación individual.</small>}</fieldset><label className="product-image-field"><span>Foto del {singular} <small>(máximo 1)</small></span><input type="file" accept="image/*" onChange={changeImages} /><small>Sube una imagen JPG, PNG o WEBP. Si eliges otra, reemplazará la actual.</small>{(draft.images ?? []).length > 0 && <div className="product-image-previews">{draft.images?.map((image, index) => <div className="product-image-preview" key={`${image.slice(0, 24)}-${index}`}><img src={index === 0 && editorImageUrl ? editorImageUrl : image} alt={`Vista previa del ${singular} ${index + 1}`} /><button type="button" onClick={() => removeImage(index)} aria-label={`Eliminar imagen ${index + 1}`}>×</button></div>)}</div>}</label><div className="modal-actions"><button type="button" className="outline-button" onClick={closeEditor}>Cancelar</button><button type="submit" className="action-button">Guardar {singular}</button></div></form></section></div>}{removing && <div className="modal-backdrop"><section className="modal-card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy"><h2 id="delete-title">¿Eliminar {singular}?</h2><p id="delete-copy">“{removing.name}” se quitará de tu catálogo.</p>{deleteError && <p className="form-error" role="alert">{deleteError}</p>}<div className="modal-actions"><button type="button" className="outline-button" onClick={() => setRemoving(null)}>Cancelar</button><button type="button" className="danger-button" disabled={Boolean(deletingId)} onClick={() => void removeOffer()}>{deletingId ? "Eliminando…" : "Eliminar"}</button></div></section></div>}</>;
}
