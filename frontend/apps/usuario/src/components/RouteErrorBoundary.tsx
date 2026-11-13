import { Component, type ErrorInfo, type ReactNode } from "react";

const RETRY_KEY = "xamuko:route-load-retry";
const RETRY_COOLDOWN_MS = 10 * 60 * 1000;

export function isRouteLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /ChunkLoadError|Loading chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message);
}

/** Do not reload automatically when it could discard input or a sensitive link. */
export function hasUnsavedInput(document: Document): boolean {
  return Array.from(document.querySelectorAll("input, textarea, select")).some((element) => {
    if (element instanceof HTMLInputElement) {
      if (["hidden", "submit", "button", "reset"].includes(element.type)) return false;
      return element.type === "checkbox" || element.type === "radio"
        ? element.checked !== element.defaultChecked
        : element.value !== element.defaultValue;
    }
    if (element instanceof HTMLTextAreaElement) return element.value !== element.defaultValue;
    if (element instanceof HTMLSelectElement) return Array.from(element.options).some(option => option.selected !== option.defaultSelected);
    return false;
  }) || Boolean(document.querySelector('[contenteditable="true"]'));
}

export function mayReloadRoute(error: unknown, storage: Storage, document: Document, now: number, search: string, pathname: string, hadUnsavedInput = false): boolean {
  const publicBrowseRoute = /^(?:\/|\/home|\/results|\/map|\/(?:business|product|service)\/[^/]+)\/?$/.test(pathname);
  if (!publicBrowseRoute || !isRouteLoadError(error) || hadUnsavedInput || hasUnsavedInput(document) || /(?:^|[?&])(token|code|email|next)=/i.test(search)) return false;
  try {
    const last = Number(storage.getItem(RETRY_KEY));
    if (last > 0 && now - last < RETRY_COOLDOWN_MS) return false;
    storage.setItem(RETRY_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

type Props = { children: ReactNode };
type State = { failed: boolean };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  private hadUnsavedInput = false;
  static getDerivedStateFromError(): State { return { failed: true }; }

  getSnapshotBeforeUpdate(_previousProps: Props, previousState: State) {
    if (!previousState.failed && this.state.failed) this.hadUnsavedInput = hasUnsavedInput(document);
    return null;
  }

  componentDidUpdate() {}

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    // Avoid sending URLs, queries, form contents, or account data to logs.
    console.warn(isRouteLoadError(error) ? "XAMUKO: no se pudo cargar una página." : "XAMUKO: error al mostrar una página.");
    try {
      if (mayReloadRoute(error, window.sessionStorage, document, Date.now(), window.location.search, window.location.pathname, this.hadUnsavedInput)) window.location.reload();
    } catch {
      // Some browsers deny access to sessionStorage; the manual action remains available.
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main role="alert" style={{ minHeight: "100svh", display: "grid", placeContent: "center", textAlign: "center", padding: 24 }}>
      <p>No pudimos cargar esta página. Comprueba tu conexión e inténtalo nuevamente.</p>
      <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
    </main>;
  }
}
