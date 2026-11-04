import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorReporting } from "./lib/monitoring";

// Uncaught errors and rejected promises are counted and alerted on (docs/RUNBOOK.md).
installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);
