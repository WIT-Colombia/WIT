import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root")!;
const app = <StrictMode><App /></StrictMode>;
// Fragment-specific sections and local development keep the existing initial
// navigation. Production's canonical page hydrates the prerendered React tree.
const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
// The pre-rendered root HTML belongs only to /. Unknown paths must mount
// the 404 immediately rather than hydrating the root landing page markup.
const isRootPath = ["/", "/index.html"].includes(window.location.pathname.replace(/\/+$/, "") || "/");
if (root.hasChildNodes() && !window.location.hash && !local && isRootPath) hydrateRoot(root, app);
else createRoot(root).render(app);
