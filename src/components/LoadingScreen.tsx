import { Loader2 } from "lucide-react";

/**
 * The whole page while something loads (I-3.1): one spinner, and words a screen reader says, so every page
 * that waits looks and sounds the same.
 */
const LoadingScreen = ({ label = "Loading" }: { label?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label={label}>
    <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </div>
);

export default LoadingScreen;
