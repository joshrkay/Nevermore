import type { ChatMessage } from "@/data/chat";

/**
 * Reads Lenore's newest reply to a screen reader where the transcript isn't on the page (a phone, I-2.2). On a
 * wide screen the transcript is a log region and announces it itself. A reply already there when the page opens
 * (a restored conversation) is not read out: the region starts with it.
 *
 * While the full conversation is open over the page, the sheet hides the rest of the page from assistive
 * technology, so a reply isn't read twice.
 */
const ReplyAnnouncer = ({ messages }: { messages: ChatMessage[] }) => {
  const latest = [...messages].reverse().find((m) => m.sender === "lenore");
  return (
    <div className="sr-only" aria-live="polite" data-testid="reply-announcer">
      {/* Keyed by message, so the same words said twice are still a new reply. */}
      {latest && <p key={latest.id}>Lenore: {latest.text}</p>}
    </div>
  );
};

export default ReplyAnnouncer;
