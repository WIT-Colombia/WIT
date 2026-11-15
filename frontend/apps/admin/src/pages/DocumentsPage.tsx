import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminDialog } from '../components/AdminDialog';
import { Icon } from '../components/Icon';
import { AdminApiError, getAdminDocumentBlob } from '../services/adminApiClient';
import { getSession } from '../services/adminService';
import { listDocuments, restoreDocument, trashDocument, uploadDocument, type AdminDocument, type DocumentList, type DocumentSection } from '../services/adminDocuments';

const settings = {
  CORPORATE: { title: 'Estatutos', caption: 'La memoria institucional, en un solo lugar.', description: 'Conserva los estatutos, reformas y actas de la organización en un archivo privado y trazable.', icon: 'store', empty: 'Tu archivo corporativo comienza aquí', button: 'Adjuntar estatuto' },
  LEGAL: { title: 'Documentos legales', caption: 'Claridad documental para cada decisión.', description: 'Organiza contratos, acuerdos y documentos legales con acceso administrativo controlado.', icon: 'box', empty: 'Organiza tu documentación legal', button: 'Adjuntar documento' },
  CASES: { title: 'Procesos judiciales', caption: 'Cada expediente, con su respaldo documental.', description: 'Conserva soportes y documentos de los procesos. Esta vista gestiona archivos; no sustituye un sistema de seguimiento judicial.', icon: 'scales', empty: 'El respaldo documental de tus procesos', button: 'Adjuntar soporte' },
};
export const formatDocumentBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`;
const date = (value: string) => new Date(value).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
const PdfPreview = lazy(() => import('../components/PdfPreview'));

export function DocumentsPage({ section }: { section: DocumentSection }) {
  const config = settings[section];
  const session = getSession();
  const allowed = session?.role === 'SUPER_ADMIN' && session.permissions?.includes('settings:write');
  const [data, setData] = useState<DocumentList | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1), [trash, setTrash] = useState(false), [revision, setRevision] = useState(0);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [uploadOpen, setUploadOpen] = useState(false), [title, setTitle] = useState(''), [description, setDescription] = useState(''), [file, setFile] = useState<File | null>(null);
  const [deleting, setDeleting] = useState<AdminDocument | null>(null), [reason, setReason] = useState('');
  const [preview, setPreview] = useState<{ document: AdminDocument; url: string } | null>(null);
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setPage(1); setSearch(''); setQuery(''); setTrash(false); setData(null); setPreview(null); setDeleting(null); setUploadOpen(false); setError(''); setNotice(''); }, [section]);
  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    let active = true; setLoading(true); setError('');
    void listDocuments(section, search, page, trash).then(result => { if (active) { if (result.pagination.total > 0 && page > result.pagination.totalPages) setPage(result.pagination.totalPages); else setData(result); } }).catch(cause => {
      if (!active) return;
      setData(null);
      setError(cause instanceof AdminApiError && (cause.status === 404 || cause.status === 503) ? 'El archivo documental necesita la actualización del backend, su migración y almacenamiento privado configurado. No se mostrarán registros hasta que estén disponibles.' : cause instanceof Error ? cause.message : 'No se pudo consultar el archivo.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, section, search, page, trash, revision]);
  useEffect(() => { const url = preview?.url; return () => { if (url) URL.revokeObjectURL(url); }; }, [preview?.url]);
  const reload = (message: string) => { setNotice(message); setRevision(value => value + 1); };
  async function save(event: FormEvent) {
    event.preventDefault(); if (!file || busy) return;
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf') || file.size === 0 || file.size > 10 * 1024 * 1024) { setActionError('Elige un PDF válido de máximo 10 MB.'); return; }
    setBusy(true); setActionError('');
    try { await uploadDocument(section, title, description, file); if (alive.current) { setUploadOpen(false); setTitle(''); setDescription(''); setFile(null); reload('Documento adjuntado al archivo privado.'); } }
    catch (cause) { if (alive.current) setActionError(cause instanceof Error ? cause.message : 'No se pudo guardar el archivo.'); }
    finally { if (alive.current) setBusy(false); }
  }
  async function openDocument(document: AdminDocument, download = false) {
    if (busy) return; setBusy(true); setError('');
    try {
      const blob = await getAdminDocumentBlob(document.id); if (!alive.current) return;
      const url = URL.createObjectURL(blob);
      if (download) { const link = window.document.createElement('a'); link.href = url; link.download = document.filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      else setPreview({ document, url });
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'No se pudo recuperar el PDF.'); }
    finally { if (alive.current) setBusy(false); }
  }
  async function confirmDelete() {
    if (!deleting || busy || reason.trim().length < 10) return;
    setBusy(true); setActionError('');
    try { await trashDocument(deleting.id, reason.trim()); if (alive.current) { setDeleting(null); reload('Documento movido a la papelera. Puedes restaurarlo desde allí.'); } }
    catch (cause) { if (alive.current) setActionError(cause instanceof Error ? cause.message : 'No se pudo eliminar el documento.'); }
    finally { if (alive.current) setBusy(false); }
  }
  async function restore(document: AdminDocument) {
    if (busy) return; setBusy(true); setError('');
    try { await restoreDocument(document.id); if (alive.current) reload('Documento restaurado en el archivo.'); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'No se pudo restaurar.'); }
    finally { if (alive.current) setBusy(false); }
  }
  if (!allowed) return <section className="ad-empty"><span className="ad-large-icon"><Icon name="lock" size={28}/></span><h1>Archivo de acceso restringido</h1><p>Solo la administración principal con permiso de gestión puede acceder a estos documentos.</p></section>;
  return <section className="ad-documents" aria-labelledby="documents-title">
    <header className="ad-page-heading"><div><span className="ad-kicker">JURÍDICA Y CORPORATIVA</span><h1 id="documents-title">{config.title}</h1><p>{config.caption}</p></div><button className="ad-button ad-button--primary" disabled={busy} onClick={() => { setActionError(''); setTitle(''); setDescription(''); setFile(null); setUploadOpen(true); }}><Icon name="upload" size={18}/>{config.button}</button></header>
    <div className="ad-summary-grid" aria-label="Resumen documental">
      <article><span className="ad-summary-icon"><Icon name="box"/></span><div><small>Documentos activos</small><strong>{data?.summary.active ?? '—'}</strong><span>En el archivo privado</span></div></article>
      <article><span className="ad-summary-icon ad-summary-icon--blue"><Icon name="database"/></span><div><small>Volumen documental</small><strong>{data ? (data.summary.sizeBytes ? formatDocumentBytes(data.summary.sizeBytes) : '0 KB') : '—'}</strong><span>Archivos activos de esta sección</span></div></article>
      <article><span className="ad-summary-icon ad-summary-icon--neutral"><Icon name="archive"/></span><div><small>En papelera</small><strong>{data?.summary.deleted ?? '—'}</strong><span>Disponibles para restaurar</span></div></article>
    </div>
    {notice && <p className="ad-notice" role="status"><Icon name="check" size={18}/>{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}><Icon name="close" size={16}/></button></p>}
    {error && <div className="ad-error" role="alert"><Icon name="shield"/><div><strong>No se pudo completar la consulta</strong><p>{error}</p></div><button className="ad-button" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
    <div className="ad-panel">
      <div className="ad-panel-heading"><div><h2>{trash ? 'Papelera documental' : 'Biblioteca de documentos'}</h2><p>{config.description}</p></div><span className="ad-security"><Icon name="lock" size={14}/>Privado</span></div>
      <div className="ad-document-toolbar">
        <div className="ad-tabs" role="group" aria-label="Estado de documentos"><button aria-pressed={!trash} onClick={() => { setTrash(false); setPage(1); }}>Archivo</button><button aria-pressed={trash} onClick={() => { setTrash(true); setPage(1); }}>Papelera</button></div>
        <form className="ad-search" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(1); }}><Icon name="search" size={18}/><input type="search" aria-label="Buscar documentos" placeholder="Título o nombre del archivo…" value={query} onChange={event => setQuery(event.target.value)}/><button type="submit">Buscar</button></form>
        <div className="ad-layout-toggle" role="group" aria-label="Presentación"><button aria-label="Vista de tarjetas" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><Icon name="grid" size={18}/></button><button aria-label="Vista de lista" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><Icon name="menu" size={18}/></button></div>
      </div>
      {loading ? <div className="ad-empty" role="status"><span className="ad-loading"/><h2>Consultando el archivo privado…</h2><p>Recuperando los documentos de esta sección.</p></div> : !error && data?.documents.length === 0 ? <div className="ad-empty"><span className="ad-large-icon"><Icon name={trash ? 'archive' : config.icon} size={34}/></span><h2>{search ? 'No encontramos documentos con ese criterio' : trash ? 'La papelera está vacía' : config.empty}</h2><p>{search ? 'Prueba con otro título o nombre de archivo.' : trash ? 'Los documentos eliminados aparecerán aquí para que puedas recuperarlos.' : 'Adjunta tu primer PDF. Podrás consultarlo, descargarlo y conservar la trazabilidad de su gestión.'}</p>{!trash && !search && <button className="ad-button ad-button--primary" onClick={() => { setActionError(''); setUploadOpen(true); }}><Icon name="upload" size={18}/>{config.button}</button>}</div> : !error && data && <div className={`ad-document-grid${layout === 'list' ? ' ad-document-grid--list' : ''}`}>
        {data.documents.map(document => <article className="ad-document-card" key={document.id}><div className="ad-document-card-top"><span className="ad-pdf-symbol"><Icon name="file" size={28}/><b>PDF</b></span><span className={`ad-state ${trash ? 'ad-state--neutral' : ''}`}><i/>{trash ? 'En papelera' : 'Archivado'}</span></div><div className="ad-document-copy"><h3>{document.title}</h3><p>{document.description || document.filename}</p><div className="ad-document-meta"><span>{formatDocumentBytes(document.sizeBytes)}</span><span>{date(document.createdAt)}</span></div><small>Adjuntado por {document.uploadedBy?.displayName || 'cuenta no disponible'}</small>{trash && document.deletionReason && <p className="ad-deletion-note">Motivo: {document.deletionReason}</p>}</div><div className="ad-document-actions">{trash ? <button className="ad-button" disabled={busy} onClick={() => { void restore(document); }}><Icon name="refresh" size={16}/>Restaurar</button> : <><button className="ad-button ad-button--soft" disabled={busy} onClick={() => { void openDocument(document); }}><Icon name="eye" size={16}/>Consultar</button><button className="ad-icon-button" disabled={busy} aria-label={`Descargar ${document.title}`} onClick={() => { void openDocument(document, true); }}><Icon name="download" size={18}/></button><button className="ad-icon-button ad-icon-button--danger" disabled={busy} aria-label={`Eliminar ${document.title}`} onClick={() => { setDeleting(document); setReason(''); setActionError(''); }}><Icon name="trash" size={18}/></button></>}</div></article>)}
      </div>}
      {data && data.pagination.totalPages > 1 && <nav className="ad-pagination" aria-label="Páginas de documentos"><button className="ad-button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} de {data.pagination.totalPages}</span><button className="ad-button" disabled={page >= data.pagination.totalPages || loading} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>}
    </div>
    <p className="ad-footnote"><Icon name="shield" size={15}/>Los archivos se consultan a través de tu sesión administrativa. Las altas, eliminaciones y restauraciones quedan auditadas.</p>
    {uploadOpen && <AdminDialog title={config.button} busy={busy} onClose={() => setUploadOpen(false)}><form onSubmit={event => { void save(event); }} className="ad-document-form"><p>Solo archivos PDF, máximo 10 MB. El documento permanecerá en el archivo privado de {config.title.toLowerCase()}.</p><label>Título del documento<input required minLength={3} maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Un nombre claro para encontrarlo después"/></label><label>Descripción <small>Opcional</small><textarea rows={3} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Versión, referencia o contexto del documento"/></label><label className="ad-file-picker"><Icon name="upload" size={26}/><strong>{file?.name || 'Selecciona el archivo PDF'}</strong><span>{file ? formatDocumentBytes(file.size) : 'PDF · Hasta 10 MB'}</span><input type="file" accept="application/pdf,.pdf" aria-label="Archivo PDF" required onChange={event => setFile(event.target.files?.[0] || null)}/></label>{actionError && <p className="ad-form-error" role="alert">{actionError}</p>}<div className="ad-dialog-actions"><button type="button" className="ad-button" disabled={busy} onClick={() => setUploadOpen(false)}>Cancelar</button><button className="ad-button ad-button--primary" type="submit" disabled={busy || title.trim().length < 3 || !file}>{busy ? 'Guardando…' : 'Guardar documento'}</button></div></form></AdminDialog>}
    {deleting && <AdminDialog title="Eliminar documento" busy={busy} onClose={() => setDeleting(null)}><div className="ad-document-form"><p>Vas a mover <strong>{deleting.title}</strong> a la papelera. Dejará de estar disponible en el archivo y podrás restaurarlo después.</p><label>Motivo de eliminación<textarea required minLength={10} maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explica el motivo (mínimo 10 caracteres)"/></label>{actionError && <p className="ad-form-error" role="alert">{actionError}</p>}<div className="ad-dialog-actions"><button className="ad-button" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button className="ad-button ad-button--danger" disabled={busy || reason.trim().length < 10} onClick={() => { void confirmDelete(); }}>{busy ? 'Eliminando…' : 'Mover a la papelera'}</button></div></div></AdminDialog>}
    {preview && <AdminDialog title={preview.document.title} wide onClose={() => setPreview(null)}><div className="ad-preview-info"><span>{preview.document.filename} · {formatDocumentBytes(preview.document.sizeBytes)}</span><button className="ad-button" disabled={busy} onClick={() => { void openDocument(preview.document, true); }}><Icon name="download" size={16}/>Descargar PDF</button></div><Suspense fallback={<p className="ad-preview-note" role="status">Cargando visor privado…</p>}><PdfPreview url={preview.url} title={preview.document.title}/></Suspense><p className="ad-preview-note">Consulta página a página o utiliza «Descargar PDF» para conservar una copia.</p></AdminDialog>}
  </section>;
}
