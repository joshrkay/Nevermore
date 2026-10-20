import { CheckCircle, AlertTriangle } from "lucide-react";
import { MOCK_FILES } from "@/data/mockData";

const ParsingTab = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">Reading the Runes...</h2>
        <p className="text-muted-foreground text-sm">Lenore is extracting data from your documents.</p>
      </div>

      <div className="space-y-3">
        {MOCK_FILES.map((file) => (
          <div key={file.id} className="bg-muted rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3 mb-2">
              {file.status === "parsed" ? (
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
              ) : file.status === "needs-confirmation" ? (
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-primary parsing-dot flex-shrink-0" />
              )}
              <p className="text-sm font-medium">{file.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                file.status === "parsed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              }`}>
                {file.status === "parsed" ? "✓ Parsed" : "⚠ Needs Confirmation"}
              </span>
            </div>
            {file.metadata && (
              <p className="text-xs text-muted-foreground font-mono ml-7">{file.metadata}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParsingTab;
