// app/api/chat/route.ts
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";

import { MODEL } from "@/config";
import { SYSTEM_PROMPT } from "@/prompts";
import { isContentFlagged } from "@/lib/moderation";
// NOTE: vectorDatabaseSearch should be exported from ./tools/search-vector-database
// either as a `tool({...})` (with .execute) or a normal function.
import { vectorDatabaseSearch } from "./tools/search-vector-database";

export const maxDuration = 30;

/**
 * Normalize many possible shapes returned by vectorDatabaseSearch (tool or function)
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
 * Run the vector DB probe in a way that supports:
 * - a "tool" export with .execute({ query, ...opts })
 * - or a plain function export vectorDatabaseSearch(query, opts)
 */
async function runVectorProbe(query: string, opts?: { k?: number; namespace?: string | undefined }) {
  const maybeTool: any = vectorDatabaseSearch;
  try {
    if (!maybeTool) {
      return [];
    }
    if (typeof maybeTool.execute === "function") {
      // `tool({ ... })` shape from 'ai' package
      const res = await maybeTool.execute({ query, ...(opts ?? {}) });
      return normalizeMatches(res);
    } else if (typeof maybeTool === "function") {
      // plain function export
      const res = await maybeTool(query, opts ?? {});
      return normalizeMatches(res);
    } else {
      console.warn("vectorDatabaseSearch export is not callable nor a tool object.");
      return [];
    }
  } catch (err) {
    console.error("Error running vector probe:", err);
    // bubble up for caller to handle; we return empty to keep flow stable
    return [];
  }
}

/**
 * Build a short human-readable summary of the top probe matches
 * to include in system prompt (helps the model cite sources).
 */
function buildSourceSummary(matches: any[], maxEntries = 5) {
  if (!Array.isArray(matches) || matches.length === 0) return "";
  const lines = ["Sources retrieved from vector DB:"];
  for (let i = 0; i < Math.min(matches.length, maxEntries); i++) {
    const m = matches[i];
    const name = (m?.metadata?.source_name ?? m?.source_name ?? m?.metadata?.title) || `Source ${i + 1}`;
    const url = m?.metadata?.source_url ?? m?.source_url ?? "";
    const excerpt = (m?.metadata?.text ?? m?.text ?? "").toString().replace(/\n/g, " ").slice(0, 300);
    lines.push(`- ${name}${url ? ` — ${url}` : ""}${excerpt ? ` — excerpt: "${excerpt}"` : ""}`);
  }
  return lines.join("\n");
}

/**
 * POST handler — streaming response using streamText
 */
export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages" }), { status: 400 });
    }

    // Find latest user message text (concatenate its text parts)
    const latestUserMessage = messages.filter((m) => m.role === "user").pop();
    const userText = latestUserMessage
      ? (latestUserMessage.parts ?? [])
          .filter((p: any) => p.type === "text")
          .map((p: any) => ("text" in p ? String(p.text) : ""))
          .join("")
      : "";

    if (!userText || userText.trim() === "") {
      // No user text — return a short streaming denial
      const stream = createUIMessageStream({
        execute({ writer }) {
          const id = "no-user-text";
          writer.write({ type: "start" });
          writer.write({ type: "text-start", id });
          writer.write({ type: "text-delta", id, delta: "No user text received in the latest message." });
          writer.write({ type: "text-end", id });
          writer.write({ type: "finish" });
        },
      });
      return createUIMessageStreamResponse({ stream });
    }

    // Moderation check
    try {
      const moderationResult = await isContentFlagged(userText);
      if (moderationResult?.flagged) {
        // stream a moderation denial response
        const denial = moderationResult.denialMessage || "Your message violates our guidelines. I can't answer that.";
        const stream = createUIMessageStream({
          execute({ writer }) {
            const id = "moderation-denial";
            writer.write({ type: "start" });
            writer.write({ type: "text-start", id });
            writer.write({ type: "text-delta", id, delta: denial });
            writer.write({ type: "text-end", id });
            writer.write({ type: "finish" });
          },
        });
        return createUIMessageStreamResponse({ stream });
      }
    } catch (merr) {
      // moderation failed — log but continue (don't block user)
      console.error("Moderation check error:", merr);
    }

    // Probe Pinecone / vector DB for top matches
    let probeMatches: any[] = [];
    try {
      probeMatches = await runVectorProbe(userText, { k: 5, namespace: undefined });
      // log basic info for debugging
      console.info(`Vector probe returned ${Array.isArray(probeMatches) ? probeMatches.length : 0} matches`);
    } catch (probeErr) {
      console.error("Probe error (caught in POST):", probeErr);
      probeMatches = [];
    }

    // Build a source summary to inject into the system prompt (so model can reference sources)
    const sourceSummary = buildSourceSummary(probeMatches, 5);
    const systemPromptWithSources = sourceSummary ? `${SYSTEM_PROMPT}\n\n${sourceSummary}` : SYSTEM_PROMPT;

    // Now start streaming the assistant reply using streamText.
    // Provide only the vectorDatabaseSearch tool — model can call it if needed.
    const result = streamText({
      model: MODEL,
      system: systemPromptWithSources,
      messages: convertToModelMessages(messages),
      tools: {
        // include vector db tool so model can invoke it during generation (if desired)
        vectorDatabaseSearch,
      },
      stopWhen: stepCountIs(10),
      providerOptions: {
        openai: {
          reasoningSummary: "auto",
          reasoningEffort: "low",
          parallelToolCalls: false,
        },
      },
    });

    // Return the streaming UI response (same shape your UI expects)
    return result.toUIMessageStreamResponse({
      sendReasoning: true,
    });
  } catch (err: any) {
    console.error("Unhandled /api/chat error:", err);

    // If something fatal happened, return a small streaming error payload so UI still gets a stream
    const stream = createUIMessageStream({
      execute({ writer }) {
        const id = "internal-error";
        writer.write({ type: "start" });
        writer.write({ type: "text-start", id });
        writer.write({
          type: "text-delta",
          id,
          delta: `Server error: ${(err as any)?.message ?? String(err)}.`,
        });
        writer.write({ type: "text-end", id });
        writer.write({ type: "finish" });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }
}
