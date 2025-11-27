// app/components/ChatClientExample.tsx
import { useState } from "react";
import CitationLink from "@/components/messages/CitationLink";

type ProbeMatch = {
  id?: string;
  score?: number;
  text?: string;
  metadata?: {
    source_name?: string;
    source_url?: string;
    source_description?: string;
    text?: string;
  };
  [key: string]: any;
};

export default function ChatClientExample() {
  const [userInput, setUserInput] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [probeMatches, setProbeMatches] = useState<ProbeMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!userInput.trim()) return;
    setLoading(true);

    // Build messages in the UIMessage-ish structure expected by /api/chat
    const messages = [
      { role: "system", parts: [{ type: "text", text: "You are an assistant." }] },
      { role: "user", parts: [{ type: "text", text: userInput }] },
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      const j = await res.json();

      if (!res.ok) {
        console.error("Chat API error:", j);
        alert("Chat error: " + (j.error || "unknown error"));
        setLoading(false);
        return;
      }

      setProbeMatches(Array.isArray(j.probeMatches) ? j.probeMatches : []);
      setAssistantText(typeof j.assistant_text === "string" ? j.assistant_text : "");
    } catch (err) {
      console.error("Network / unexpected error:", err);
      alert("Network error communicating with chat endpoint");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-2">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          rows={4}
          className="w-full p-2 border rounded"
          placeholder="Ask a question about your insurance documents..."
        />
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={send}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
        >
          {loading ? "Thinking..." : "Send"}
        </button>
        <button
          onClick={() => {
            setUserInput("");
            setAssistantText("");
            setProbeMatches([]);
          }}
          className="px-3 py-2 bg-gray-200 rounded"
        >
          Clear
        </button>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-medium">Sources (from vector DB)</h3>
        {probeMatches.length === 0 && <div className="text-xs text-gray-500">No sources found</div>}
        <div className="space-y-2 mt-2">
          {probeMatches.map((p: ProbeMatch, i: number) => {
            const url = p.metadata?.source_url ?? (p as any).source_url ?? "";
            const name = p.metadata?.source_name ?? (p as any).source_name ?? `Source ${i + 1}`;
            const excerpt = (p.metadata?.text ?? p.text ?? "").toString().slice(0, 300);

            return (
              <div key={p.id ?? i} className="p-2 border rounded bg-white">
                <div className="text-sm font-semibold">{name}</div>
                {excerpt && <div className="text-xs text-gray-700 mt-1">{excerpt}{excerpt.length >= 300 ? "…" : ""}</div>}
                <div className="mt-2">
                  <CitationLink url={url} label="Download document" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Assistant</h3>
        <div className="mt-2 p-3 border rounded whitespace-pre-wrap">{assistantText}</div>
      </div>
    </div>
  );
}
