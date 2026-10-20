import { useState } from "react";
import { X } from "lucide-react";

interface DemoBannerProps {
  onClearDemo: () => void;
}

const DemoBanner = ({ onClearDemo }: DemoBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-warning/20 border-b border-warning/40 px-4 py-2 flex items-center justify-between text-sm">
      <p className="text-foreground">
        <span className="mr-1">🪶</span>
        You're viewing a live demo · All data below is fictional · By the end, this will be <strong className="text-warning">YOUR</strong> company's information.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onClearDemo}
          className="text-xs bg-warning/20 text-warning-foreground px-3 py-1 rounded-full hover:bg-warning/30 transition-colors whitespace-nowrap"
        >
          👻 Clear Demo · Start with My Company
        </button>
        <button onClick={() => setDismissed(true)} className="text-warning-foreground/60 hover:text-warning-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default DemoBanner;
