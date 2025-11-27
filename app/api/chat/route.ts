import {
  UIMessage,
} from "ai";

import { MODEL } from "@/config";
import { SYSTEM_PROMPT } from "@/prompts";
import { isContentFlagged } from "@/lib/moderation";

import { webSearch } from "./tools/web-search";
import { vectorDatabaseSearch } from "./tools/search-vector-database";

/**
 * API: /api/chat
 *
 * Behavior:
 * - Expects JSON body: { messages: UIMessage[] }
 * - Extracts latest user text, runs moderation.
 * - Probes vector DB for top matches (k=5).
 * - Builds a short source summary (for internal use).
 * - Calls the LLM (non-streaming) with the probe summary injected.
 * - Returns JSON:
 *   {
 *     probeMatches: [ ...normalized matches... ],
 *     assistant_text: "final assistant reply text",
 *     used_web_search: boolean
 *   }
 *
 * NOTE: This response is synchronous (non-streaming) to ensure the client
 * always receives the structured probeMatches along with assistant text.
 */

type ProbeOpts = { k?: number; namespace?: string | undefined };

function normalizeMatches(resp: any): any[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.matches)) return resp.matches;
  if (Array.isArray(resp.results)) return resp.results;
  if (Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp.body?.matches)) return resp.body.matches;
  if (Array.isArray(resp.body?.results)) return resp.body.results;
  if (Array.isArray(resp?.items)) return resp.items;
  return [];
}

async function runVectorProbe(query: string, opts?: ProbeOpts) {
  const maybeTool: any = vectorDatabaseSearch;
  let resp: any;
  if (maybeTool && typeof maybeTool.execute === "function") {
    // tool shape
    resp = await maybeTool.execute({ query, ...(opts ?? {}) });
  } else if (typeof maybeTool === "function") {
    resp = await maybeTool(query, opts ?? {});
  } else {
    resp = [];
  }
  return normalizeMatches(resp);
}

/**
 * Minimal helper: call the ai LLM in a synchronous, non-streaming way.
 * We use `fetch` to call your internal model provider endpoint if you have one,
 * or use a simple small wrapper using streamText if available as non-streaming.
 *
 * For safety and portability we manually call the OpenAI REST embeddings/chat if needed.
 * However, here we attempt to use the server-side library available via `ai` package.
 *
 * NOTE: This function tries to call `streamText`-style library methods in a synchronous way.
 * If your runtime does not expose a non-streaming API for the LLM, we fall back to using
 * a simple fetch-based call to OpenAI's chat completions if you have an OpenAI key configured.
 *
 * For now, to keep this file self-contained and robust across environments, we'll call
 * the provider via `fetch` to OpenAI if OPENAI_API_KEY is present; otherwise we fallback
 * to returning a short placeholder string instructing you to enable a streaming flow.
 */
async function callAssistantSync(messages: UIMessage[], systemPrompt: string): Promise<string> {
  // Try to use an available SDK: If the ai package exposes a function to get non-stream text,
  // it's environment specific. To keep things robust, we check for an OpenAI key and call their ChatCompletion API.
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const payload = {
    model: (process.env.ASSISTANT_MODEL || MODEL) ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      // Convert UIMessage[] into chat messages with role/content
      ...messages.map((m: any) => {
        const partsText = (m.parts ?? [])
          .filter((p: any) => p.type === "text")
          .map((p: any) => ("text" in p ? p.text : ""))
          .join("");
        return { role: m.role, content: partsText || "" };
      }),
    ],
    max_tokens: 800,
    temperature: 0.2,
  };

  if (!OPENAI_KEY) {
    // Best-effort fallback. If you don't have OPENAI_KEY, return a placeholder.
    // NOTE: This keeps the endpoint functional; add OPENAI_API_KEY to get better results.
    return "Assistant is temporarily unavailable for synchronous responses. Please enable OPENAI_API_KEY on the server to get immediate assistant text, or call the streaming endpoint.";
  }

  // Call OpenAI Chat Completions as a synchronous fallback
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("OpenAI chat completion failed:", resp.status, txt);
    return `Assistant error: ${resp.status}`;
  }

  const j = await resp.json();
  // j.choices[0].message.content typical
  const assistantText = j?.choices?.[0]?.message?.content ?? "";
  return assistantText;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: UIMessage[] = body.messages ?? [];

    const latestUserMessage = messages.filter((m) => m.role === "user").pop();
    const userText = latestUserMessage
      ? (latestUserMessage.parts ?? [])
          .filter((p: any) => p.type === "text")
          .map((p: any) => ("text" in p ? p.text : ""))
          .join("")
      : "";

    if (!userText || userText.trim() === "") {
      return new Response(JSON.stringify({ error: "No user text provided." }), { status: 400 });
    }

    // Moderation
    const moderationResult = await isContentFlagged(userText);
    if (moderationResult.flagged) {
      return new Response(JSON.stringify({
        error: "Message flagged by moderation",
        denialMessage: moderationResult.denialMessage ?? "Your message violates our guidelines."
      }), { status: 403 });
    }

    // Probe vector DB (k=5)
    let probeMatches = [];
    let usedWebSearch = false;
    try {
      probeMatches = await runVectorProbe(userText, { k: 5, namespace: undefined });
    } catch (e) {
      console.error("Probe vector error:", e);
      probeMatches = [];
    }

    // If probeMatches empty -> allow web search
    if (!probeMatches || probeMatches.length === 0) {
      usedWebSearch = true;
    }

    // Build a short system summary (keeps LLM context aware)
    let sourceSummary = "";
    if (probeMatches && probeMatches.length > 0) {
      const lines: string[] = ["Retrieved sources (vector DB):"];
      for (let i = 0; i < Math.min(probeMatches.length, 5); i++) {
        const m = probeMatches[i];
        const name = m.metadata?.source_name ?? `Source ${i + 1}`;
        const url = m.metadata?.source_url ?? "";
        const excerpt = (m.metadata?.text ?? m.text ?? "").toString().slice(0, 300).replace(/\n/g, " ");
        lines.push(`- ${name}${url ? ` — ${url}` : ""}${excerpt ? ` — excerpt: "${excerpt}"` : ""}`);
      }
      sourceSummary = lines.join("\n");
    }

    // Augment messages with the sourceSummary as a system message if present
    const augmentedMessages: UIMessage[] = [...messages];
    if (sourceSummary) {
      augmentedMessages.push({
        role: "system",
        parts: [{ type: "text", text: sourceSummary }],
      } as UIMessage);
    }

    // Call assistant synchronously (non-streaming) and return final text + probeMatches
    const assistantText = await callAssistantSync(augmentedMessages, SYSTEM_PROMPT);

    // Return structured probeMatches and assistant text
    const responsePayload = {
      probeMatches: probeMatches,
      assistant_text: assistantText,
      used_web_search: usedWebSearch,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("chat route error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
