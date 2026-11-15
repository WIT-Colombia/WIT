import { isSupportedUploadImage, normalizeImageForUpload, PHOTO_INPUT_ACCEPT } from "@wit/utils";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { FormField } from "../components/common/FormField";
import { useBusinessStore } from "../services/businessStore";
import { businessApi } from "../services/businessApiClient";
import { toCatalogItem, toOfferInput } from "../services/catalogAdapter";
import type { CatalogItem, CatalogKind } from "../types/business";
import "./CatalogProducts.css";

const PRODUCTS_PER_PAGE = 10;

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
  const { setItems, business, businesses, setBusiness, setBusinesses } = useBusinessStore();
  const [realItems, setRealItems] = useState<CatalogItem[]>([]);
  const [privateImageUrls, setPrivateImageUrls] = useState<Record<string, string>>({});
  const [realCatalogLoading, setRealCatalogLoading] = useState(false);
  const [likeCountsError, setLikeCountsError] = useState(false);
  const [catalogLimits, setCatalogLimits] = useState<import("../services/businessApiClient").CatalogLimits | null>(null);
  const isRealBusiness = business.source === "real" && Boolean(business.id);
  const items = isRealBusiness ? realItems : businesses.length > 0 ? (business.catalog ?? []) : [];
  const [searchParams, setSearchParams] = useSearchParams();
  const isProduct = kind === "product";
  const demoPro = searchParams.get("demoPro") === "1";
  const title = isProduct ? "Productos" : "Servicios";
  const singular = isProduct ? "producto" : "servicio";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [productPage, setProductPage] = useState(1);
  const productListRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setProductPage(1); }, [kind, business.id, query, filter]);
  const [draft, setDraft] = useState<CatalogItem | null>(() => searchParams.has("nuevo") ? blank(kind) : null);
  const catalogEditorOverlayRef = useRef<HTMLDivElement>(null);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageError, setImageError] = useState("");
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
  // Both catalog editors share the approved Product design. Use a portal and the
  // visual viewport so fixed Business headers never cover the modal on iOS/iPadOS.
  useLayoutEffect(() => {
    if (!draft) return;
    const overlay = catalogEditorOverlayRef.current;
    if (!overlay) return;
    const body = document.body;
    const priorOverflow = body.style.overflow;
    const viewport = window.visualViewport;
    const syncViewport = () => {
      overlay.style.setProperty("--catalog-editor-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      overlay.style.setProperty("--catalog-editor-viewport-left", `${viewport?.offsetLeft ?? 0}px`);
      overlay.style.setProperty("--catalog-editor-viewport-width", `${viewport?.width ?? window.innerWidth}px`);
      overlay.style.setProperty("--catalog-editor-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    };
    body.classList.add("catalog-product-editor-active");
    body.style.overflow = "hidden";
    syncViewport();
    window.addEventListener("resize", syncViewport);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    const closeButton = overlay.querySelector<HTMLButtonElement>(".modal-heading .close-button");
    closeButton?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      body.style.overflow = priorOverflow;
      body.classList.remove("catalog-product-editor-active");
    };
  }, [kind, Boolean(draft)]);
  const [removing, setRemoving] = useState<CatalogItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const categoryOptions = ["Todas las categorías", ...new Set(items.filter(item => item.kind === kind).map(item => item.category.trim()).filter(Boolean))];
  const visible = useMemo(() => items.filter(item => item.kind === kind && (filter === "Todos" || filter === "Activos" && item.active || filter === "Inactivos" && !item.active || filter === item.category) && `${item.internalCode ?? ""} ${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (a.internalCode ?? "").localeCompare(b.internalCode ?? "", undefined, { numeric: true })), [items, kind, filter, query]);
  const productPageCount = Math.max(1, Math.ceil(visible.length / PRODUCTS_PER_PAGE));
  const currentProductPage = Math.min(productPage, productPageCount);
  const productPageStart = (currentProductPage - 1) * PRODUCTS_PER_PAGE;
  const displayedItems = isProduct ? visible.slice(productPageStart, productPageStart + PRODUCTS_PER_PAGE) : visible;
  const productPageButtonStart = Math.max(1, Math.min(currentProductPage - 2, productPageCount - 4));
  const productPageNumbers = Array.from({ length: Math.min(5, productPageCount) }, (_, index) => productPageButtonStart + index);
  const goToProductPage = (page: number) => {
    setProductPage(Math.max(1, Math.min(page, productPageCount)));
    productListRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
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
  const changeImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = Array.from(event.currentTarget.files ?? [])[0];
    event.currentTarget.value = "";
    if (!file || imageProcessing) return;
    if (!isSupportedUploadImage(file)) { setImageError("Selecciona una fotografía JPG, PNG, WebP o HEIC."); return; }
    const fileKey = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    if (pendingImageKeys.current.has(fileKey)) return;
    pendingImageKeys.current.add(fileKey);
    setImageError("");
    setImageProcessing(true);
    try {
      const normalized = await normalizeImageForUpload(file);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("No se pudo mostrar la fotografía seleccionada."));
        reader.readAsDataURL(normalized);
      });
      if (!dataUrl) throw new Error("No se pudo mostrar la fotografía seleccionada.");
      clearEditorImage();
      setDraft(current => current ? { ...current, images: [dataUrl], image: dataUrl } : current);
    } catch (cause) {
      setImageError(cause instanceof Error ? cause.message : "No se pudo procesar la fotografía.");
    } finally {
      pendingImageKeys.current.delete(fileKey);
      setImageProcessing(false);
    }
  };
  const removeImage = (index: number) => { clearEditorImage(); setDraft(current => {
    if (!current) return current;
    const images = (current.images ?? []).filter((_, imageIndex) => imageIndex !== index);
    return { ...current, images, image: images[0] ?? (current.kind === "product" ? "📦" : "✨") };
  }); };
  const closeEditor = () => { clearEditorImage(); setImageError(""); setDraft(null); if (searchParams.has("nuevo")) setSearchParams({}, { replace: true }); };
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
  const canCreate = businesses.length > 0 && (!isRealBusiness || !quota || quota.unlimited || (quota.available !== null && quota.available > 0));
  const editorModal = draft && <div ref={catalogEditorOverlayRef} className="modal-backdrop catalog-product-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor(); }}><section className="modal-card product-editor-modal catalog-product-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-dialog-title"><div className="modal-heading"><span className="catalog-editor-heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{draft.id ? <><path d="m14 5 5 5M4 20l4-.9L19.5 7.6a2.5 2.5 0 0 0-3.5-3.5L4.5 15.6 4 20Z"/></> : <><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/><path d="M12 12v6m-3-3h6"/></>}</svg></span>}<div><span className="page-eyebrow">TU OFERTA</span><h2 id="catalog-dialog-title">{draft.id ? "Editar" : "Agregar"} {singular}</h2><p className="product-editor-intro">Completa la información que verán las personas en XAMUKO.</p></div><button type="button" className="close-button" onClick={closeEditor} aria-label="Cerrar">×</button></div><form onSubmit={save} className="modal-form"><FormField label={`Nombre del ${singular}`} name="name" value={draft.name} onChange={change} placeholder={isProduct ? "Ej. Arepa con queso" : "Ej. Servicio a domicilio"} required /><FormField label="Descripción (opcional)" name="description" value={draft.description} onChange={change} as="textarea" placeholder={isProduct ? "Describe brevemente el producto, sus ingredientes o características." : "Describe brevemente en qué consiste el servicio y qué incluye."} /><FormField label="Precio (COP)" name="price" value={draft.price} onChange={change} placeholder="Ej. 12000" disabled={Boolean(draft.priceNegotiable)} hint="Ingresa el valor en pesos colombianos. También puedes marcar ‘Precio a convenir’." /><label className="price-negotiable-field"><input type="checkbox" checked={Boolean(draft.priceNegotiable)} onChange={event => setDraft(current => current ? { ...current, priceNegotiable: event.target.checked, price: event.target.checked ? "No aplica" : "" } : current)} /> <span>Precio a convenir</span></label><fieldset className="adult-classification-field"><legend>Restricción de edad</legend><label><input type="radio" name="adultOnly" checked={!draft.adultOnly} onChange={() => setDraft(current => current ? { ...current, adultOnly: false } : current)} /> Apto para todo público</label><label><input type="radio" name="adultOnly" checked={Boolean(draft.adultOnly)} onChange={() => setDraft(current => current ? { ...current, adultOnly: true } : current)} /> Exclusivo para mayores de 18 años</label><p>Debes clasificar correctamente los productos y servicios sujetos a restricciones de edad. XAMUKO podrá revisar o modificar esta clasificación conforme a sus políticas.</p>{business.adultOnly && <small>Tu establecimiento está clasificado como +18; todo su catálogo se restringe públicamente, sin cambiar esta clasificación individual.</small>}</fieldset><label className="product-image-field"><span>Foto del {singular} <small>(máximo 1)</small></span><input type="file" accept={PHOTO_INPUT_ACCEPT} onChange={event => { void changeImages(event); }} disabled={imageProcessing} /><small>Se admiten fotografías JPG, PNG, WebP y HEIC; las capturas de cámara se convierten automáticamente.</small>{imageError && <small role="alert" className="form-error">{imageError}</small>}{(draft.images ?? []).length > 0 && <div className="product-image-previews">{draft.images?.map((image, index) => <div className="product-image-preview" key={`${image.slice(0, 24)}-${index}`}><img src={index === 0 && editorImageUrl ? editorImageUrl : image} alt={`Vista previa del ${singular} ${index + 1}`} /><button type="button" onClick={() => removeImage(index)} aria-label={`Eliminar imagen ${index + 1}`}>×</button></div>)}</div>}</label><div className="modal-actions"><button type="button" className="outline-button" onClick={closeEditor}>Cancelar</button><button type="submit" className="action-button" disabled={imageProcessing}>{imageProcessing ? "Procesando foto…" : `Guardar ${singular}`}</button></div></form></section></div>;
  return <><div className="catalog-products-design">
    <header className="page-heading catalog-products-heading">
      <div className="catalog-products-heading-copy">
        <span className="page-eyebrow">TU OFERTA</span>
        <div className="catalog-products-heading-main">
          <span className="catalog-products-heading-icon" aria-hidden="true">{isProduct ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 7a5 5 0 0 0-6.5 6.5L3 17.5 6.5 21l4.5-4.5A5 5 0 0 0 17.5 10L14 13l-3-3 3-3Z"/></svg>}</span>
          <div><h1>{title}</h1><p>{`${title} de ${businesses.length === 0 ? "tu primera tienda" : business.name}. Administra lo que las personas pueden descubrir en XAMUKO.`}</p></div>
        </div>
      </div>
      <button className="action-button catalog-products-add" type="button" disabled={!canCreate} onClick={() => setDraft(blank(kind))}><span className="catalog-products-add-plus" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></span>Agregar {singular}</button>
    </header>
    <section className="surface-card catalog-surface">{realCatalogLoading && <p className="auth-status">Cargando {title.toLowerCase()}…</p>}<div className="catalog-controls"><div className="catalog-toolbar"><label className="search-box"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></span><span className="sr-only">Buscar {title.toLowerCase()}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Buscar ${title.toLowerCase()}...`} /></label><label className="filter-box"><svg className="catalog-filter-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/></svg>}<span className="sr-only">Filtrar {title.toLowerCase()}</span><select value={filter} onChange={event => setFilter(event.target.value)}><option>Todos</option><option>Activos</option><option>Inactivos</option>{categoryOptions.slice(1).map(category => <option key={category}>{category}</option>)}</select></label></div><div className="catalog-summary"><strong><svg className="catalog-summary-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/></svg>}{title}: {quota ? `${quota.used}/${counterLimit}` : `${visible.length}/${demoPro ? "Ilimitado" : "—"}`}</strong>{quota?.available === 0 && <span>Has alcanzado el límite para este nivel.</span>}</div></div>{visible.length ? <><div className="catalog-list" ref={isProduct ? productListRef : undefined}>{displayedItems.map(item => <article className="catalog-row" key={item.id}><div className="catalog-art" aria-hidden="true">{privateImageUrls[item.id] ? <img src={privateImageUrls[item.id]} alt="" loading={isProduct ? "lazy" : undefined} decoding={isProduct ? "async" : undefined} /> : (item.images?.[0] ?? item.image).startsWith("/api/v1/businesses/") ? <span aria-label="Cargando fotografía" /> : (item.images?.[0] ?? item.image).startsWith("data:") || (item.images?.[0] ?? item.image).startsWith("http") ? <img src={item.images?.[0] ?? item.image} alt="" loading={isProduct ? "lazy" : undefined} decoding={isProduct ? "async" : undefined} /> : (item.images?.[0] ?? item.image)}</div><div className="catalog-info"><h2>{item.name}</h2><p>{item.kind === "product" ? item.description : `${item.category} · ${item.description}`}</p><span>{formatCatalogPrice(item)}</span>{item.adultOnly && <small className="catalog-adult-badge">+18</small>}</div><div className="catalog-interest"><strong>{item.interest >= 0 ? <><span className="catalog-like-icon" aria-hidden="true">♥</span> {item.interest}</> : "—"}</strong><small>{likeCountsError ? "No disponible" : "me gusta"}</small></div><span className={`state-tag ${item.active ? "on" : "off"}`}>{item.active ? "Activo" : "Inactivo"}</span><div className="row-actions"><button type="button" onClick={() => { void openEditor(item); }}><svg className="catalog-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-.8L20 7a2.8 2.8 0 0 0-4-4L4 15.3V20Z"/></svg>}Editar</button><button type="button" onClick={() => isRealBusiness && business.id ? businessApi.updateOffer(business.id, item.id, { active: !item.active, ...(!item.active && item.publicationStatus === "UNPUBLISHED" ? { publicationStatus: "PUBLISHED" as const } : {}) }).then(() => setRealItems(current => current.map(entry => entry.id === item.id ? { ...entry, active: !entry.active, ...(!entry.active && entry.publicationStatus === "UNPUBLISHED" ? { publicationStatus: "PUBLISHED" as const } : {}) } : entry))) : persistItems(items.map(current => current.id === item.id ? { ...current, active: !current.active } : current))}><svg className="catalog-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/>{item.active && <path d="m4 4 16 16"/>}</svg>}{item.active ? "Desactivar" : "Activar"}</button><button type="button" className="danger-link" onClick={() => setRemoving(item)}><svg className="catalog-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 4h4m-7 3 .7 13h8.6L17 7M10 11v6m4-6v6"/></svg>}Eliminar</button></div></article>)}</div>{isProduct && productPageCount > 1 && <nav className="catalog-product-pagination" aria-label="Páginas de productos">
<p className="catalog-product-pagination-summary" aria-live="polite">Mostrando <strong>{productPageStart + 1}–{Math.min(productPageStart + PRODUCTS_PER_PAGE, visible.length)}</strong> de <strong>{visible.length}</strong> productos</p>
<div className="catalog-product-pagination-controls">
<button type="button" className="catalog-product-pagination-edge" disabled={currentProductPage === 1} onClick={() => goToProductPage(currentProductPage - 1)} aria-label="Página anterior">‹ <span>Anterior</span></button>
{productPageNumbers.map(page => <button type="button" key={page} className={page === currentProductPage ? "catalog-product-pagination-number is-current" : "catalog-product-pagination-number"} aria-label={`Página ${page}`} aria-current={page === currentProductPage ? "page" : undefined} onClick={() => goToProductPage(page)}>{page}</button>)}
<button type="button" className="catalog-product-pagination-edge" disabled={currentProductPage === productPageCount} onClick={() => goToProductPage(currentProductPage + 1)} aria-label="Página siguiente"><span>Siguiente</span> ›</button>
</div></nav>}</> : <div className="empty-state"><span>◇</span><h2>No encontramos {title.toLowerCase()}</h2><p>{query || filter !== "Todos" ? "Prueba otra búsqueda o cambia el filtro." : `Agrega tu primer ${singular} para empezar.`}</p><button className="outline-button" type="button" onClick={() => { setQuery(""); setFilter("Todos"); }}>Limpiar filtros</button></div>}</section></div>{draft && createPortal(editorModal, document.body)}{removing && <div className="modal-backdrop"><section className="modal-card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy"><h2 id="delete-title">¿Eliminar {singular}?</h2><p id="delete-copy">“{removing.name}” se quitará de tu catálogo.</p>{deleteError && <p className="form-error" role="alert">{deleteError}</p>}<div className="modal-actions"><button type="button" className="outline-button" onClick={() => setRemoving(null)}>Cancelar</button><button type="button" className="danger-button" disabled={Boolean(deletingId)} onClick={() => void removeOffer()}>{deletingId ? "Eliminando…" : "Eliminar"}</button></div></section></div>}</>;
}
