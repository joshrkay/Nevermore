import type { ChatMessage } from "@/data/chat";
import { messageAnchor } from "./format";

/** The full conversation, with the message a field came from highlighted. */
const TranscriptEvidence = ({ messages, highlighted }: { messages: ChatMessage[]; highlighted: string | null }) => (
  <section aria-labelledby="transcript-heading" className="border border-border rounded-xl p-5">
    <h2 id="transcript-heading" className="font-display text-lg font-bold mb-3">Transcript</h2>
    {messages.length === 0 ? (
      <p className="text-sm text-muted-foreground">No conversation recorded.</p>
    ) : (
      <ol className="space-y-2 max-h-[32rem] overflow-y-auto pr-2">
        {messages.map((m) => (
          <li
            key={m.id}
            id={messageAnchor(m.id)}
            aria-current={highlighted === m.id ? "true" : undefined}
            className={`text-sm rounded-md p-2 ${
              highlighted === m.id ? "bg-primary/10 ring-1 ring-primary" : m.sender === "user" ? "bg-muted" : ""
            }`}
          >
            <p className="text-xs text-muted-foreground mb-0.5">
              {m.sender === "user" ? "Prospect" : "Lenore"}
              {m.timestamp && ` · ${m.timestamp}`}
            </p>
            <p className="whitespace-pre-wrap">{m.text}</p>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export default TranscriptEvidence;
