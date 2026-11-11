import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root")!;
const app = <StrictMode><App /></StrictMode>;
// Fragment-specific sections and local development keep the existing initial
// navigation. Production's canonical page hydrates the prerendered React tree.
const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
if (root.hasChildNodes() && !window.location.hash && !local) hydrateRoot(root, app);
else createRoot(root).render(app);
