import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import LedPage from "./components/LedPage.jsx";
import PanelPage from "./components/PanelPage.jsx";
import ClienteNaCasaPage from "./pages/ClienteNaCasaPage.jsx";
import { CONFIG } from "./config.js";
import "./styles.css";

const normalizedPath = window.location.pathname.replace(/\/+$/, "").toLowerCase();
const isLedRoute = normalizedPath === "/led";
const isClienteNaCasaRoute = normalizedPath === "/clientenacasa";
const isMetasRoute = normalizedPath === "/metas";
const isPanelRoute = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).has("panel");

function pickRoot() {
  if (isLedRoute) return <LedPage />;
  if (isClienteNaCasaRoute) return <ClienteNaCasaPage />;
  if (isMetasRoute) return <PanelPage activeMode={CONFIG.MODES.NORMAL} forceMetas />;
  if (isPanelRoute) return <PanelPage />;
  return <App />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {pickRoot()}
  </React.StrictMode>
);
