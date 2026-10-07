import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { FormField } from "../components/common/FormField";
import { useBusinessStore } from "../services/businessStore";
import { businessCatalog } from "../data/business.mock";
import type { CatalogItem, CatalogKind } from "../types/business";

const blank = (kind: CatalogKind): CatalogItem => ({ id: "", kind, name: "", category: "", description: "", price: "", image: kind === "product" ? "📦" : "✨", images: [], priceNegotiable: false, active: true, interest: 0 });

export function CatalogPage({ kind }: { kind: CatalogKind }) {
  const { items: storedItems, setItems, business, businesses, setBusiness, setBusinesses } = useBusinessStore();
  const personalCatalog = businesses.length === 0 || business.isNew || !businessCatalog[business.name];
  const items = business.catalog ?? (businessCatalog[business.name] ?? (personalCatalog ? storedItems : []));
  const [searchParams, setSearchParams] = useSearchParams();
  const isProduct = kind === "product";
  const title = isProduct ? "Productos" : "Servicios";
  const singular = isProduct ? "producto" : "servicio";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [draft, setDraft] = useState<CatalogItem | null>(() => searchParams.has("nuevo") ? blank(kind) : null);
  useEffect(() => { if (!draft && searchParams.has("nuevo")) setSearchParams({}, { replace: true }); }, [draft, searchParams, setSearchParams]);
  useEffect(() => {
    if (!draft) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDraft(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [draft]);
  const [removing, setRemoving] = useState<CatalogItem | null>(null);
  const categoryOptions = ["Todas las categorías", ...new Set(items.filter(item => item.kind === kind).map(item => item.category))];
  const visible = useMemo(() => items.filter(item => item.kind === kind && (filter === "Todos" || filter === "Activos" && item.active || filter === "Inactivos" && !item.active || filter === item.category) && `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [items, kind, filter, query]);
  const change = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft(current => current ? { ...current, [event.target.name]: event.target.value } : current);
  const changeImages = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []).filter(file => file.type.startsWith("image/"));
    if (!selected.length) return;
    setDraft(current => {
      if (!current) return current;
      const existing = current.images?.filter(image => image.startsWith("data:")) ?? [];
      const files = selected.slice(0, Math.max(0, 3 - existing.length));
      const nextImages = [...existing];
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => setDraft(latest => {
          if (!latest) return latest;
          const images = [...(latest.images ?? []), String(reader.result)].slice(0, 3);
          return { ...latest, images, image: images[0] ?? latest.image };
        });
        reader.readAsDataURL(file);
      });
      return { ...current, images: nextImages, image: nextImages[0] ?? current.image };
    });
    event.target.value = "";
  };
  const removeImage = (index: number) => setDraft(current => {
    if (!current) return current;
    const images = (current.images ?? []).filter((_, imageIndex) => imageIndex !== index);
    return { ...current, images, image: images[0] ?? (current.kind === "product" ? "📦" : "✨") };
  });
  const closeEditor = () => { setDraft(null); if (searchParams.has("nuevo")) setSearchParams({}, { replace: true }); };
  const persistItems = (next: CatalogItem[]) => {
    setItems(next);
    const updated = { ...business, catalog: next };
    setBusiness(updated);
    setBusinesses(businesses.map(item => item.name === business.name ? updated : item));
  };
  const save = (event: FormEvent) => { event.preventDefault(); if (!draft) return; const entry = { ...draft, id: draft.id || `${kind}-${Date.now()}`, category: isProduct ? "" : draft.category }; persistItems(draft.id ? items.map(item => item.id === draft.id ? entry : item) : [entry, ...items]); closeEditor(); };
  return <><PageHeader eyebrow="TU OFERTA" title={title} description={`${title} de ${businesses.length === 0 ? "tu primera tienda" : business.name}. Administra lo que las personas pueden descubrir en WIT.`} action={<button className="action-button" type="button" onClick={() => setDraft(blank(kind))}>＋ Agregar {singular}</button>} /><section className="surface-card catalog-surface"><div className="catalog-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Buscar {title.toLowerCase()}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Buscar ${title.toLowerCase()}...`} /></label><label className="filter-box"><span className="sr-only">Filtrar {title.toLowerCase()}</span><select value={filter} onChange={event => setFilter(event.target.value)}><option>Todos</option><option>Activos</option><option>Inactivos</option>{categoryOptions.slice(1).map(category => <option key={category}>{category}</option>)}</select></label></div><div className="catalog-summary"><strong>{visible.length} {visible.length === 1 ? singular : title.toLowerCase()}</strong></div>{visible.length ? <div className="catalog-list">{visible.map(item => <article className="catalog-row" key={item.id}><div className="catalog-art" aria-hidden="true">{item.image.startsWith("data:") || item.image.startsWith("http") ? <img src={item.image} alt="" /> : item.image}</div><div className="catalog-info"><h2>{item.name}</h2><p>{item.kind === "product" ? item.description : `${item.category} · ${item.description}`}</p><span>{item.priceNegotiable ? "Precio a convenir" : (item.price || "Precio a consultar")}</span></div><div className="catalog-interest"><strong>👍 {item.interest}</strong><small>me gusta</small></div><span className={`state-tag ${item.active ? "on" : "off"}`}>{item.active ? "Activo" : "Inactivo"}</span><div className="row-actions"><button type="button" onClick={() => setDraft({ ...item, images: item.images ?? (item.image.startsWith("data:") ? [item.image] : []) })}>Editar</button><button type="button" onClick={() => persistItems(items.map(current => current.id === item.id ? { ...current, active: !current.active } : current))}>{item.active ? "Desactivar" : "Activar"}</button><button type="button" className="danger-link" onClick={() => setRemoving(item)}>Eliminar</button></div></article>)}</div> : <div className="empty-state"><span>◇</span><h2>No encontramos {title.toLowerCase()}</h2><p>{query || filter !== "Todos" ? "Prueba otra búsqueda o cambia el filtro." : `Agrega tu primer ${singular} para empezar.`}</p><button className="outline-button" type="button" onClick={() => { setQuery(""); setFilter("Todos"); }}>Limpiar filtros</button></div>}</section>{draft && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDraft(null); }}><section className="modal-card product-editor-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-dialog-title"><div className="modal-heading"><div><span className="page-eyebrow">TU OFERTA</span><h2 id="catalog-dialog-title">{draft.id ? "Editar" : "Agregar"} {singular}</h2><p className="product-editor-intro">Completa la información que verán las personas en WIT.</p></div><button type="button" className="close-button" onClick={() => setDraft(null)} aria-label="Cerrar">×</button></div><form onSubmit={save} className="modal-form"><FormField label={`Nombre del ${singular}`} name="name" value={draft.name} onChange={change} placeholder={isProduct ? "Ej. Arepa con queso" : "Ej. Servicio a domicilio"} required /><FormField label="Descripción" name="description" value={draft.description} onChange={change} as="textarea" placeholder={isProduct ? "Describe brevemente el producto, sus ingredientes o características." : "Describe brevemente en qué consiste el servicio y qué incluye."} required /><FormField label="Precio (COP)" name="price" value={draft.price} onChange={change} placeholder="Ej. 12000" disabled={Boolean(draft.priceNegotiable)} hint="Ingresa el valor en pesos colombianos. También puedes marcar ‘Precio a convenir’." /><label className="price-negotiable-field"><input type="checkbox" checked={Boolean(draft.priceNegotiable)} onChange={event => setDraft(current => current ? { ...current, priceNegotiable: event.target.checked, price: event.target.checked ? "No aplica" : "" } : current)} /> <span>Precio a convenir</span></label><label className="product-image-field"><span>Fotos del {singular} <small>(máximo 3)</small></span><input type="file" accept="image/*" multiple onChange={changeImages} disabled={(draft.images?.length ?? 0) >= 3} /><small>Sube imágenes JPG, PNG o WEBP. Puedes agregar hasta 3.</small>{(draft.images ?? []).length > 0 && <div className="product-image-previews">{draft.images?.map((image, index) => <div className="product-image-preview" key={`${image.slice(0, 24)}-${index}`}><img src={image} alt={`Vista previa del ${singular} ${index + 1}`} /><button type="button" onClick={() => removeImage(index)} aria-label={`Eliminar imagen ${index + 1}`}>×</button></div>)}</div>}</label><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setDraft(null)}>Cancelar</button><button type="submit" className="action-button">Guardar {singular}</button></div></form></section></div>}{removing && <div className="modal-backdrop"><section className="modal-card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy"><h2 id="delete-title">¿Eliminar {singular}?</h2><p id="delete-copy">“{removing.name}” se quitará de tu catálogo.</p><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setRemoving(null)}>Cancelar</button><button type="button" className="danger-button" onClick={() => { persistItems(items.filter(item => item.id !== removing.id)); setRemoving(null); }}>Eliminar</button></div></section></div>}</>;
}
