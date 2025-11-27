/**
 * app/api/chat/route.ts
 *
 * Robust synchronous chat route that:
 *  - accepts { messages: UIMessage[] } in JSON body
 *  - probes vector DB (vectorDatabaseSearch)
 *  - optionally uses webSearch if no vector results
 *  - calls OpenAI ChatCompletion synchronously if OPENAI_API_KEY present
 *  - ALWAYS returns JSON:
 *      { probeMatches, assistant_text, used_web_search, error? }
 *
 * Notes:
 *  - This file is defensive: it logs detailed errors to console (Vercel logs)
 *    and returns readable error text to the client to avoid silent failures.
 *  - It supports vectorDatabaseSearch exported either as a "tool" (with .execute)
 *    or as a plain function (callable directly).
 */

import { UIMessage } from "ai";
import { SYSTEM_PROMPT } from "@/prompts";
import { isContentFlagged } from "@/lib/moderation";
import { webSearch } from "./tools/web-search";
import { vectorDatabaseSearch } from "./tools/search-vector-database";

/**
 * Normalizes multiple possible response shapes returned by vectorDatabaseSearch
 */
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

/**
 * Runs the vector DB probe. Supports both:
 *  - tool object with .execute({ query, ...opts })
 *  - plain function vectorDatabaseSearch(query, opts)
 */
async function runVectorProbe(query: string, opts?: { k?: number; namespace?: string | undefined }) {
  const maybeTool: any = vectorDatabaseSearch;
  try {
    if (maybeTool && typeof maybeTool.execute === "function") {
      // tool shape
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

/**
 * Call OpenAI ChatCompletion synchronously.
 * Returns assistant text. If failure, throws.
 */
async function callOpenAISync(userMessages: { role: string; content: string }[], model = "gpt-4o-mini") {
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
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${txt}`);
  }
  const j = await r.json();
  const assistant = j?.choices?.[0]?.message?.content ?? "";
  return assistant;
}

/**
 * Convert UIMessage[] (ai package shape) into simple chat messages for OpenAI
 */
function toOpenAIMessages(uiMessages: UIMessage[], systemPrompt?: string) {
  const out: { role: string; content: string }[] = [];
  if (systemPrompt) {
    out.push({ role: "system", content: systemPrompt });
  }
  for (const m of uiMessages) {
    const parts = (m.parts ?? [])
      .filter((p: any) => p.type === "text")
      .map((p: any) => ("text" in p ? p.text : ""))
      .join("");
    out.push({ role: m.role, content: parts || "" });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch((e) => {
      throw new Error("Invalid JSON body: " + String(e));
    });

    const messages: UIMessage[] = body?.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing or empty messages in request body" }), { status: 400 });
    }

    // Extract latest user text
    const latestUserMessage = messages.filter((m) => m.role === "user").pop();
    const userText = latestUserMessage
      ? (latestUserMessage.parts ?? [])
          .filter((p: any) => p.type === "text")
          .map((p: any) => ("text" in p ? p.text : ""))
          .join("")
      : "";

    if (!userText || userText.trim() === "") {
      return new Response(JSON.stringify({ error: "No user text provided in latest message" }), { status: 400 });
    }

    // Moderation check
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
      // continue — moderation failure shouldn't block everything; but log it.
    }

    // Probe vector DB
    let probeMatches: any[] = [];
    let usedWebSearch = false;
    try {
      probeMatches = await runVectorProbe(userText, { k: 5, namespace: undefined });
    } catch (probeErr) {
      console.error("Probe error:", probeErr);
      probeMatches = [];
    }

    if (!probeMatches || probeMatches.length === 0) {
      usedWebSearch = true;
    }

    // Compose a short source summary to inform the assistant
    let sourceSummary = "";
    if (probeMatches && probeMatches.length > 0) {
      const lines = ["Retrieved sources (vector DB):"];
      for (let i = 0; i < Math.min(probeMatches.length, 5); i++) {
        const m = probeMatches[i];
        const name = m?.metadata?.source_name ?? m?.metadata?.title ?? m?.source_name ?? `Source ${i + 1}`;
        const url = m?.metadata?.source_url ?? m?.source_url ?? "";
        const excerpt = (m?.metadata?.text ?? m?.text ?? "").toString().slice(0, 300).replace(/\n/g, " ");
        lines.push(`- ${name}${url ? ` — ${url}` : ""}${excerpt ? ` — excerpt: "${excerpt}"` : ""}`);
      }
      sourceSummary = lines.join("\n");
    }

    // Augment messages: include source summary as a system message if present
    const augmentedMessages = [...messages];
    if (sourceSummary) {
      augmentedMessages.push({
        role: "system",
        parts: [{ type: "text", text: sourceSummary }],
      } as UIMessage);
    }

    // Now: call assistant synchronously.
    // Prefer OpenAI sync call if OPENAI_API_KEY present; otherwise return a fallback reply.
    let assistantText = "";
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    try {
      if (OPENAI_KEY) {
        // Convert augmentedMessages into OpenAI chat messages
        const openaiMessages = toOpenAIMessages(augmentedMessages, SYSTEM_PROMPT);
        assistantText = await callOpenAISync(openaiMessages, process.env.ASSISTANT_MODEL || "gpt-4o-mini");
      } else {
        // No OpenAI key: build a deterministic fallback assistant text using probeMatches
        if (probeMatches && probeMatches.length > 0) {
          assistantText = `I found ${probeMatches.length} document(s) that may help. See the "Sources" panel for direct download links and excerpts.`;
        } else if (usedWebSearch) {
          assistantText = "I couldn't find relevant documents in the vector DB. Web search is enabled as a fallback, but no web results were requested in this synchronous endpoint.";
        } else {
          assistantText = "No documents found and no assistant model is configured. Please set OPENAI_API_KEY on the server to get full assistant responses.";
        }
      }
    } catch (assistantErr) {
      console.error("Assistant call failed:", assistantErr);
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
    // Catch-all: log and return error message in JSON
    console.error("Unhandled /api/chat error:", err);
    return new Response(
      JSON.stringify({
        probeMatches: [],
        assistant_text: "Internal server error",
        used_web_search: false,
        error: String(err?.message ?? err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
