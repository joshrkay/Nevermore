import { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";
import { RavenIcon } from "./RavenLogo";
import type { ChatMessage } from "@/data/mockData";

interface LenoreChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  compact?: boolean;
}

const LenoreChat = ({ messages, onSendMessage, compact = false }: LenoreChatProps) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className={`flex flex-col bg-card border-r border-border ${compact ? "w-full h-full" : "w-80 h-full"}`}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center lenore-glow">
          <RavenIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-display font-bold text-sm">Lenore</p>
          <p className="text-xs text-muted-foreground">AI Underwriting Agent</p>
        </div>
      </div>

      {/* Voice placeholder */}
      <button className="mx-4 mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground border border-border rounded-lg py-2 hover:border-primary/30 transition-colors">
        <Mic className="w-3.5 h-3.5" />
        Speak with Lenore
        {/* TODO: ElevenLabs embed */}
      </button>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.sender === "user"
                  ? "bg-primary/15 text-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              {msg.text}
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">{msg.timestamp}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Message Lenore..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={handleSend}
            className="text-primary hover:text-primary/80 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LenoreChat;
