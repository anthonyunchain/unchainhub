import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Loader2, FileDown, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  // Détecte si le message contient du HTML pour le calendrier
  const htmlMatch = message.content?.match(/```html([\s\S]*?)```/);

  const handleDownloadPDF = () => {
    const html = htmlMatch[1].trim();
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center mt-0.5 shrink-0">
          <Bot className="h-4 w-4 text-emerald-600" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? "items-end flex flex-col" : ""}`}>
        {message.content && (
          <div className={`rounded-2xl px-4 py-2.5 ${isUser ? "bg-slate-800 text-white" : "bg-white border border-slate-200"}`}>
            {isUser ? (
              <p className="text-sm">{message.content}</p>
            ) : (
              <div className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown>{message.content.replace(/```html[\s\S]*?```/, "*(Calendrier HTML généré)*")}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
        {htmlMatch && (
          <Button
            size="sm"
            onClick={handleDownloadPDF}
            className="mt-2 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" /> Ouvrir / Imprimer le calendrier PDF
          </Button>
        )}
      </div>
    </div>
  );
}

export default function EditorialAgentChat({ open, onOpenChange }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && !conversation) initConversation();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!conversation) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      setLoading(false);
    });
    return unsub;
  }, [conversation?.id]);

  const initConversation = async () => {
    setInitializing(true);
    const conv = await base44.agents.createConversation({
      agent_name: "editorial_calendar",
      metadata: { name: "Editorial Calendar" },
    });
    setConversation(conv);
    setMessages(conv.messages || []);
    setInitializing(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !conversation) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: text });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-600" />
            Editorial Calendar Agent
          </DialogTitle>
          <p className="text-xs text-slate-400">Ask the agent to generate a PDF calendar for a specific month or client.</p>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50/50">
          {initializing && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Initializing...
            </div>
          )}
          {!initializing && messages.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-8">
              <Bot className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p>Hello! Ask me to create an editorial calendar.</p>
              <p className="text-xs mt-1">E.g. "Generate the March 2026 calendar" or "Calendar for client X"</p>
            </div>
          )}
          {messages.filter(m => m.role !== "system").map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="E.g. Generate the March 2026 calendar..."
            className="flex-1"
            disabled={loading || initializing}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || loading || initializing}
            className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}