import { useState, type ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ChatMessage } from "@/data/chat";
import TranscriptPanel from "./TranscriptPanel";

interface MobileTranscriptProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  notice?: ReactNode;
  restoredThrough?: string | null;
}

/**
 * The conversation on a phone (US-2.3c), where the side panel doesn't fit: a button in the bottom bar opens the
 * whole transcript in a sheet, so every one of Lenore's replies can be read in full, not only the line under the orb.
 */
const MobileTranscript = ({ messages, onSendMessage, notice, restoredThrough }: MobileTranscriptProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
        >
          <MessageSquare className="w-4 h-4" aria-hidden="true" />
          Conversation
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 p-0" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Conversation with Lenore</SheetTitle>
        <div className="min-h-0 flex-1">
          <TranscriptPanel messages={messages} onSendMessage={onSendMessage} notice={notice} restoredThrough={restoredThrough} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileTranscript;
