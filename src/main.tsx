import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorReporting } from "./lib/monitoring";
import { captureIntakeSource } from "./data/intakeSource";

// Uncaught errors and rejected promises are counted and alerted on (docs/RUNBOOK.md).
installGlobalErrorReporting();
// The referral code and campaign tags of the link the visitor arrived by, for the intake they may start.
captureIntakeSource(window.location.search);

createRoot(document.getElementById("root")!).render(<App />);
