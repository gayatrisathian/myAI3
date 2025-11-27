/**
 * app/api/chat/route.ts
 *
 * Robust synchronous chat route (replacement).
 *
 * Changes made:
 *  - sanitizes and truncates outgoing OpenAI payload,
 *  - safe-serializes JSON (converts BigInt, functions, symbols),
 *  - logs a truncated payload preview to Vercel logs for debugging,
 *  - returns structured JSON to the client with probeMatches & assistant_text.
 *
 * Drop this file into app/api/chat/route.ts (replace existing) and redeploy.
 */

import { UIMessage } from "ai";
import { SYSTEM_PROMPT } from "@/prompts";
import { isContentFlagged } from "@/lib/moderation";
import { webSearch } from "./tools/web-search";
import { vectorDatabaseSearch } from "./tools/search-vector-database";

/* -------------------------
   Utility: normalizeMatches
   ------------------------- */
function normalizeMatches(resp: any): any[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.matches)) return resp.matches;
  if (Array.isArray(resp.results)) return resp.results;
  if (Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp.items)) return resp.items;
  if (Array.isArray(resp.body?.matches)) return resp.body.matches;
  if (Array.isArray(resp.body?.results)) return resp.body.results;
  return [];
}

/* -------------------------
   Utility: runVectorProbe
   Supports:
     - tool object with .execute({ query, ...opts })
     - plain function vectorDatabaseSearch(query, opts)
   ------------------------- */
async function runVectorProbe(query: string, opts?: { k?: number; namespace?: string | undefined }) {
  const maybeTool: any = vectorDatabaseSearch;
  try {
    if (maybeTool && typeof maybeTool.execute === "function") {
      const attempt = await maybeTool.execute({ query, ...(opts ?? {}) });
      return normalizeMatches(attempt);
    } else if (typeof maybeTool === "function") {
      const attempt = await maybeTool(query, opts ?? {});
      return normalizeMatches(attempt);
    } else {
      console.warn("vectorDatabaseSearch is not callable or a tool object.");
      return [];
    }
  } catch (err) {
    console.error("runVectorProbe error:", err);
    throw err;
  }
}

/* -------------------------
   Safe serializer
   - converts BigInt -> string
   - converts functions/symbols -> string placeholders
   - truncates very long strings per message part to avoid monstrous payloads
   - returns serialized JSON string; throws only on extreme issues
   ------------------------- */

type SafeOptions = {
  maxCharsPerMessagePart?: number; // truncate each message part to this length
  maxPayloadPreviewChars?: number; // how many chars to show in logs
};

function safeSerialize(obj: any, opts?: SafeOptions) {
  const maxCharsPerMessagePart = opts?.maxCharsPerMessagePart ?? 15000; // per-part safe cut
  // Replacer that handles non-serializable values and truncates long strings
  const visited = new WeakSet();

  function replacer(_k: string, v: any) {
    // limit recursion cycles
    if (v && typeof v === "object") {
      if (visited.has(v)) {
        return "[Circular]";
      }
      visited.add(v);
    }

    // Primitive conversions
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "undefined") return null;
    if (typeof v === "symbol") return v.toString();
    if (typeof v === "function") return `[Function: ${v.name || "anonymous"}]`;

    // For expected message parts, do a defensive truncation for strings
    if (typeof v === "string") {
      if (v.length > maxCharsPerMessagePart) {
        return v.slice(0, maxCharsPerMessagePart) + `... [TRUNCATED ${v.length} chars -> ${maxCharsPerMessagePart}]`;
      }
      return v;
    }

    return v;
  }

  // Do a stringify with replacer
  const serialized = JSON.stringify(obj, replacer);
  return serialized;
}

/* -------------------------
   OpenAI synchronous call (with payload safety)
   ------------------------- */

async function callOpenAISyncSafe(userMessages: { role: string; content: string }[], model = "gpt-4o-mini") {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const payload = {
    model,
    messages: userMessages,
    max_tokens: 800,
    temperature: 0.2,
  };

  // Safely serialize & log small preview for debugging
  let payloadStr: string;
  try {
    // Truncate per message part at e.g. 15k chars in replacer
    payloadStr = safeSerialize(payload, { maxCharsPerMessagePart: 15000 });
  } catch (err) {
    console.error("Failed to safe-serialize OpenAI payload:", err);
    throw new Error("Failed to prepare payload for OpenAI (serialization error).");
  }

  // Log payload preview and length to Vercel logs for debugging (no secrets)
  const previewLen = Math.min(4000, payloadStr.length);
  console.info(`OpenAI payload length=${payloadStr.length}; preview=first ${previewLen} chars:\n${payloadStr.slice(0, previewLen)}`);

  // Now call OpenAI
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: payloadStr,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("OpenAI chat completion failed:", resp.status, txt);
    throw new Error(`OpenAI error ${resp.status}: ${txt}`);
  }

  const j = await resp.json();
  const assistant = j?.choices?.[0]?.message?.content ?? "";
  return assistant;
}

/* -------------------------
   Convert UIMessage[] into simple openai messages (strings)
   - We also pre-truncate each message part to keep payload size reasonable
   ------------------------- */
function toOpenAIMessagesSafe(uiMessages: UIMessage[], systemPrompt?: string) {
  const out: { role: string; content: string }[] = [];
  if (systemPrompt) {
    out.push({ role: "system", content: systemPrompt });
  }

  for (const m of uiMessages) {
    // collect text parts into content string
    const parts = (m.parts ?? [])
      .filter((p: any) => p.type === "text")
      .map((p: any) => ("text" in p ? String(p.text) : ""))
      // truncate each part individually to prevent huge payload
      .map((s: string) => {
        const limit = 15000;
        if (s.length > limit) return s.slice(0, limit) + `... [TRUNCATED ${s.length} -> ${limit}]`;
        return s;
      })
      .join("\n\n");
    out.push({ role: m.role, content: parts || "" });
  }
  return out;
}

/* -------------------------
   Main route handler (POST)
   ------------------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch((e) => {
      throw new Error("Invalid JSON body in request to /api/chat: " + String(e));
    });

    const messages: UIMessage[] = body?.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing or empty messages in request body" }), { status: 400 });
    }

    // Extract latest user text (for moderation & probe)
    const latestUserMessage = messages.filter((m) => m.role === "user").pop();
    const userText = latestUserMessage
      ? (latestUserMessage.parts ?? [])
          .filter((p: any) => p.type === "text")
          .map((p: any) => ("text" in p ? String(p.text) : ""))
          .join(" ")
      : "";

    if (!userText || userText.trim() === "") {
      return new Response(JSON.stringify({ error: "No user text provided in latest message" }), { status: 400 });
    }

    // Moderation
    try {
      const mod = await isContentFlagged(userText);
      if (mod?.flagged) {
        return new Response(
          JSON.stringify({
            probeMatches: [],
            assistant_text: mod.denialMessage ?? "Your message was flagged by moderation.",
            used_web_search: false,
            error: "message flagged",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (merr) {
      console.error("Moderation check failed:", merr);
      // continue; moderation failure should not entirely block the endpoint
    }

    // Probe vector DB
    let probeMatches: any[] = [];
    let usedWebSearch = false;
    try {
      probeMatches = await runVectorProbe(userText, { k: 5, namespace: undefined });
    } catch (probeErr) {
      console.error("Vector probe error:", probeErr);
      probeMatches = [];
    }

    if (!probeMatches || probeMatches.length === 0) {
      usedWebSearch = true;
    }

    // Build source summary to pass into LLM context
    let sourceSummary = "";
    if (probeMatches && probeMatches.length > 0) {
      const lines: string[] = ["Retrieved sources (vector DB):"];
      for (let i = 0; i < Math.min(probeMatches.length, 5); i++) {
        const m = probeMatches[i];
        const name = m?.metadata?.source_name ?? m?.metadata?.title ?? m?.source_name ?? `Source ${i + 1}`;
        const url = m?.metadata?.source_url ?? m?.source_url ?? "";
        const excerpt = (m?.metadata?.text ?? m?.text ?? "").toString().slice(0, 300).replace(/\n/g, " ");
        lines.push(`- ${name}${url ? ` — ${url}` : ""}${excerpt ? ` — excerpt: "${excerpt}"` : ""}`);
      }
      sourceSummary = lines.join("\n");
    }

    // Augment messages for assistant (system + user+history)
    const augmentedMessages = [...messages];
    if (sourceSummary) {
      augmentedMessages.push({
        role: "system",
        parts: [{ type: "text", text: sourceSummary }],
      } as UIMessage);
    }

    // Call assistant synchronously using OpenAI (safe)
    let assistantText = "";
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    try {
      if (OPENAI_KEY) {
        const openaiMessages = toOpenAIMessagesSafe(augmentedMessages, SYSTEM_PROMPT);

        // safe call with payload preview logging
        assistantText = await callOpenAISyncSafe(openaiMessages, process.env.ASSISTANT_MODEL || "gpt-4o-mini");
      } else {
        // No OpenAI key configured — deterministic fallback so client still gets probeMatches
        if (probeMatches && probeMatches.length > 0) {
          assistantText = `I found ${probeMatches.length} document(s) that may help. See the "Sources" panel for direct download links and excerpts.`;
        } else if (usedWebSearch) {
          assistantText = "I couldn't find relevant documents in the vector DB. Web search is enabled as a fallback, but this synchronous endpoint did not perform a web search.";
        } else {
          assistantText = "No documents found and no assistant model is configured. Please set OPENAI_API_KEY on the server to get full assistant responses.";
        }
      }
    } catch (assistantErr: any) {
      console.error("Assistant call failed (safe):", assistantErr);
      assistantText = "Assistant error: " + ((assistantErr as any)?.message ?? String(assistantErr));
    }

    // Return structured response
    const responsePayload = {
      probeMatches,
      assistant_text: assistantText,
      used_web_search: usedWebSearch,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Unhandled /api/chat error:", err);
    return new Response(
      JSON.stringify({
        probeMatches: [],
        assistant_text: "Internal server error",
        used_web_search: false,
        error: String((err as any)?.message ?? err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
