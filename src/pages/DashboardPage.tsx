import { motion } from "framer-motion";
import { RavenIcon } from "@/components/RavenLogo";
import {
  FileText, Clock, CheckCircle, AlertTriangle, MessageSquare,
  Download, ExternalLink, Shield, TrendingUp, Users, MapPin, LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_FILES } from "@/data/mockData";
import { useState } from "react";
import LenoreChat from "@/components/LenoreChat";
import type { ChatMessage } from "@/data/mockData";

type PeoStatus = "Quote Received" | "Pending Quote" | "Submitted" | "Follow-up Needed";

interface PeoCard {
  name: string;
  status: PeoStatus;
  pepm?: string;
  matchScore?: number;
  detail?: string;
}

const peoStatuses: PeoCard[] = [
  { name: "TriNet", status: "Quote Received", pepm: "$145–$175", matchScore: 92, detail: "Preliminary quote ready for review" },
  { name: "Justworks", status: "Pending Quote", matchScore: 78, detail: "Expected within 24 hours" },
  { name: "Rippling", status: "Submitted", matchScore: 65, detail: "Package delivered successfully" },
  { name: "ADP TotalSource", status: "Submitted", detail: "Package delivered successfully" },
  { name: "Insperity", status: "Follow-up Needed", detail: "Additional W/C detail requested" },
];

const statusConfig: Record<PeoStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  "Quote Received": {
    color: "text-success",
    bg: "bg-success/10 border-success/20",
    icon: <CheckCircle className="w-4 h-4 text-success" />,
  },
  "Pending Quote": {
    color: "text-warning",
    bg: "bg-warning/10 border-warning/20",
    icon: <Clock className="w-4 h-4 text-warning" />,
  },
  "Submitted": {
    color: "text-muted-foreground",
    bg: "bg-muted border-border",
    icon: <FileText className="w-4 h-4 text-muted-foreground" />,
  },
  "Follow-up Needed": {
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    icon: <AlertTriangle className="w-4 h-4 text-primary" />,
  },
};

const timeline = [
  { time: "Today, 3:42 PM", event: "TriNet returned preliminary quote — $145–$175 PEPM", icon: <TrendingUp className="w-4 h-4 text-success" />, highlight: true },
  { time: "Today, 2:14 PM", event: "Manuscript submitted to 5 PEOs", icon: <CheckCircle className="w-4 h-4 text-success" /> },
  { time: "Today, 2:14 PM", event: "The Reckoning completed — attestation signed", icon: <Shield className="w-4 h-4 text-primary" /> },
  { time: "Today, 2:02 PM", event: "Census review completed — 28 employees confirmed", icon: <CheckCircle className="w-4 h-4 text-success" /> },
  { time: "Today, 1:48 PM", event: "Document parsing complete — 4 files processed", icon: <Clock className="w-4 h-4 text-muted-foreground" /> },
  { time: "Today, 1:45 PM", event: "Documents uploaded to The Chamber", icon: <FileText className="w-4 h-4 text-muted-foreground" /> },
];

const companyStats = [
  { label: "Employees", value: "28", icon: <Users className="w-4 h-4" /> },
  { label: "States", value: "CA, TX", icon: <MapPin className="w-4 h-4" /> },
  { label: "Avg Salary", value: "$94K", icon: <TrendingUp className="w-4 h-4" /> },
  { label: "PEOs Submitted", value: "5", icon: <FileText className="w-4 h-4" /> },
];

const DashboardPage = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "lenore",
      text: "Welcome back to The Vault. Your manuscript has been delivered. TriNet has already returned a preliminary quote — shall I walk you through it?",
      timestamp: "2:30 PM",
    },
  ]);

  const { signOut } = useAuth();

  const handleSendMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const responses = [
        "The TriNet quote came in at $145–$175 PEPM. That's competitive for your group size and CA exposure.",
        "I'll flag Insperity — they need additional workers' comp detail. I can draft that for you.",
        "Justworks typically responds within 24 hours. I'll notify you the moment their quote arrives.",
        "Your manuscript is solid. All five PEOs have acknowledged receipt.",
      ];
      const lenoreMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "lenore",
        text: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, lenoreMsg]);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              <RavenIcon className="w-5 h-5 text-primary" />
              <span className="font-display text-sm">Edgar Allan Advisory</span>
            </a>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">The Vault</span>
          </div>
          <button
            onClick={() => signOut()}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Title + Company Stats */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold mb-1">The Vault</h1>
              <p className="text-muted-foreground">Meridian Creative Group</p>
            </div>
          </div>

          {/* Company stat badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {companyStats.map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                <div className="text-primary">{stat.icon}</div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="font-display font-bold text-lg">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* PEO Status Cards */}
          <h2 className="font-display text-xl font-bold mb-4">PEO Submissions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {peoStatuses.map((peo, i) => {
              const config = statusConfig[peo.status];
              return (
                <motion.div
                  key={peo.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-display font-bold">{peo.name}</p>
                    {peo.matchScore && (
                      <span className="text-xs font-mono text-muted-foreground">{peo.matchScore}% match</span>
                    )}
                  </div>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.bg}`}>
                    {config.icon}
                    <span className={config.color}>{peo.status}</span>
                  </div>
                  {peo.pepm && (
                    <p className="text-sm font-mono text-success mt-3">{peo.pepm} <span className="text-muted-foreground">PEPM</span></p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">{peo.detail}</p>
                  {peo.status === "Quote Received" && (
                    <button className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View Quote Details
                    </button>
                  )}
                  {peo.status === "Follow-up Needed" && (
                    <button className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Ask Lenore to Draft Response
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Two-column: Documents + Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Documents */}
            <div>
              <h2 className="font-display text-xl font-bold mb-4">Document Library</h2>
              <div className="space-y-3">
                <div className="bg-card border border-primary/20 rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">The Manuscript</p>
                    <p className="text-xs text-muted-foreground">Generated submission package · PDF</p>
                  </div>
                  <button className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                {MOCK_FILES.map((file) => (
                  <div key={file.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{file.size} · {file.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h2 className="font-display text-xl font-bold mb-4">Activity Timeline</h2>
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-5">
                  {timeline.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-3 relative"
                    >
                      <div className="relative z-10 bg-background p-0.5">{item.icon}</div>
                      <div className={item.highlight ? "bg-success/5 border border-success/20 rounded-lg p-3 flex-1 -mt-1" : ""}>
                        <p className={`text-sm ${item.highlight ? "font-medium" : ""}`}>{item.event}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.time}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Floating Lenore button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 bg-primary text-primary-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors lenore-glow"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="fixed bottom-6 right-6 w-80 h-[480px] rounded-xl border border-border shadow-2xl overflow-hidden z-50"
        >
          <div className="flex items-center justify-between bg-card px-4 py-2 border-b border-border">
            <span className="text-sm font-display font-bold">Ask Lenore</span>
            <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
          </div>
          <div className="h-[calc(100%-40px)]">
            <LenoreChat messages={messages} onSendMessage={handleSendMessage} compact />
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardPage;
