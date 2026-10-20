import { useRef, useEffect, useState } from "react";
import { Send } from "lucide-react";
import type { ChatMessage } from "@/data/chat";

interface TranscriptPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

const TranscriptPanel = ({ messages, onSendMessage, inputRef }: TranscriptPanelProps) => {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Conversation</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.sender === "user"
                  ? "bg-primary/15 text-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              {msg.text}
              <p className="text-[9px] text-muted-foreground mt-1 font-mono">{msg.timestamp}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            maxLength={2000}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button onClick={handleSend} className="text-primary hover:text-primary/80 transition-colors">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptPanel;
