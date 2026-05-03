import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import LedPage from "./components/LedPage.jsx";
import PanelPage from "./components/PanelPage.jsx";
import "./styles.css";

const isLedRoute = window.location.pathname.replace(/\/+$/, "") === "/led";
const isPanelRoute = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).has("panel");

function pickRoot() {
  if (isLedRoute) return <LedPage />;
  if (isPanelRoute) return <PanelPage />;
  return <App />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {pickRoot()}
  </React.StrictMode>
);
