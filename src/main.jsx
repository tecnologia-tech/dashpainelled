import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import LedPage from "./components/LedPage.jsx";
import "./styles.css";

const isLedRoute = window.location.pathname.replace(/\/+$/, "") === "/led";

if (isLedRoute) {
  document.documentElement.classList.add("led-route");
  document.body.classList.add("led-route");
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isLedRoute ? <LedPage /> : <App />}
  </React.StrictMode>
);
