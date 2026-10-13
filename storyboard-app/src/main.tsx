import "./styles/index.css";
import "./styles/theme.css";

import { createRoot } from "react-dom/client";

import App from "./app/App.tsx";
import { startMediaRenewal } from "./app/lib/signedMedia";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");
// Portaled dialogs must inherit the same fixed dark theme as the workspace.
document.documentElement.classList.add("dark");
createRoot(rootElement).render(<App />);
const stopMediaRenewal = startMediaRenewal();
if (import.meta.hot) import.meta.hot.dispose(stopMediaRenewal);
