import type { ReactNode } from "react";
import { MessagesSquare } from "lucide-react";
import TranscriptPanel from "@/components/chamber/TranscriptPanel";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ChatMessage } from "@/data/chat";

interface MobileTranscriptProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  notice?: ReactNode;
  restoredThrough?: string | null;
}

/**
 * The whole conversation on a phone (US-2.3c). There is no room for the transcript beside the workspace, and the
 * orb shows only the start of Lenore's latest line, so a button opens the full transcript over the page: every
 * message in full, the same panel as on a wide screen, with its own input.
 */
const MobileTranscript = ({ messages, onSendMessage, notice, restoredThrough }: MobileTranscriptProps) => (
  <Sheet>
    <SheetTrigger asChild>
      <button
        type="button"
        aria-label="Read the conversation"
        className="tap-target shrink-0 flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessagesSquare className="w-4 h-4" aria-hidden="true" />
        Chat
      </button>
    </SheetTrigger>
    {/* Opening it to read shouldn't raise the keyboard: nothing is focused until the prospect taps the input. */}
    <SheetContent side="bottom" className="h-[85dvh] p-0 pt-8 flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
      <SheetTitle className="sr-only">Conversation with Lenore</SheetTitle>
      <SheetDescription className="sr-only">Everything you and Lenore have said in this intake.</SheetDescription>
      <div className="flex-1 min-h-0">
        <TranscriptPanel messages={messages} onSendMessage={onSendMessage} notice={notice} restoredThrough={restoredThrough} />
      </div>
    </SheetContent>
  </Sheet>
);

export default MobileTranscript;
