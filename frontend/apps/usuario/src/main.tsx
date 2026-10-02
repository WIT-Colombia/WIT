import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { getSettings } from "./services/userDataService";
import "@wit/ui/styles/global.css";
import "@wit/ui/styles/components.css";
import "./styles/variables.css";
import "./styles/global.css";
import "./styles/responsive.css";

document.documentElement.dataset.reducedMotion = String(getSettings().reducedMotion);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>,
);
