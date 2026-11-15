import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, version, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Render authenticated PDF bytes locally. No embedded PDF actions, links or scripts. */
export default function PdfPreview({ url, title }: { url: string; title: string }) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1), [width, setWidth] = useState(600);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [text, setText] = useState('');
  useEffect(() => {
    let active = true;
    const assets = `/pdfjs/${version}/`;
    const task = getDocument({ url, enableXfa: false, cMapUrl: `${assets}cmaps/`, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/` });
    setLoading(true); setError('');
    void task.promise.then(pdf => { if (active) { setDocument(pdf); setPage(1); } }).catch(() => { if (active) { setError('No se pudo presentar este PDF. Puedes descargarlo para consultarlo con tu lector de documentos.'); setLoading(false); } });
    return () => { active = false; void task.destroy().catch(() => undefined); };
  }, [url]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(180, Math.floor(entries[0].contentRect.width - 32))));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let active = true, render: RenderTask | undefined;
    setLoading(true); setError(''); setText('');
    void (async () => {
      const pdfPage = await document.getPage(page);
      if (!active || !canvas.current) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(width / natural.width, 2);
      const viewport = pdfPage.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4_000_000 / (viewport.width * viewport.height)));
      const target = canvas.current;
      target.width = Math.floor(viewport.width * ratio); target.height = Math.floor(viewport.height * ratio);
      target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
      render = pdfPage.render({ canvas: target, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0], annotationMode: 0 });
      await render.promise;
      const content = await pdfPage.getTextContent();
      if (active) { setText(content.items.map(item => 'str' in item ? item.str : '').join(' ')); setLoading(false); }
    })().catch(cause => { if (active && cause?.name !== 'RenderingCancelledException') { setError('No se pudo presentar esta página. La descarga del documento sigue disponible.'); setLoading(false); } });
    return () => { active = false; render?.cancel(); };
  }, [document, page, width]);
  return <div className="ad-pdf-reader">
    <nav className="ad-pdf-controls" aria-label="Páginas del PDF"><button className="ad-button" disabled={!document || page === 1 || loading} onClick={() => setPage(value => value - 1)}>Anterior</button><span aria-live="polite">{document ? `Página ${page} de ${document.numPages}` : 'Abriendo PDF…'}</span><button className="ad-button" disabled={!document || page === document.numPages || loading} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>
    <div ref={host} className="ad-pdf-stage" aria-busy={loading}>
      {loading && <p className="ad-pdf-loading" role="status">Preparando página…</p>}
      {error && <p className="ad-form-error" role="alert">{error}</p>}
      <canvas ref={canvas} aria-label={`${title}, página ${page}`} role="img" hidden={Boolean(error)}/>
      {text && <p className="ad-pdf-accessible-text">{text}</p>}
    </div>
  </div>;
}
