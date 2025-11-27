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
import { vectorDatabaseSearch } from "./tools/search-vector-database";

export const maxDuration = 30;

/* -------------------------
   Helpers
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

/**
 * Call a tool that may be exported as ai.tool (with .execute) or plain function.
 */
async function runVectorProbe(query: string, opts?: { k?: number; namespace?: string | undefined }) {
  const maybeTool: any = vectorDatabaseSearch;
  if (!maybeTool) return [];
  try {
    if (typeof maybeTool.execute === "function") {
      const res = await maybeTool.execute({ query, ...(opts ?? {}) });
      return normalizeMatches(res);
    } else if (typeof maybeTool === "function") {
      const res = await maybeTool(query, opts ?? {});
      return normalizeMatches(res);
    } else {
      console.warn("vectorDatabaseSearch is not callable nor a tool object.");
      return [];
    }
  } catch (err) {
    console.error("runVectorProbe error:", err);
    return [];
  }
}

function buildSourceSummary(matches: any[], maxEntries = 5) {
  if (!Array.isArray(matches) || matches.length === 0) return "";
  const lines: string[] = ["Sources retrieved from vector DB:"];
  for (let i = 0; i < Math.min(matches.length, maxEntries); i++) {
    const m = matches[i];
    const name = (m?.metadata?.source_name ?? m?.source_name ?? m?.metadata?.title) || `Source ${i + 1}`;
    const url = m?.metadata?.source_url ?? m?.source_url ?? "";
    const excerpt = (m?.metadata?.text ?? m?.text ?? "").toString().replace(/\n/g, " ").slice(0, 300);
    lines.push(`- ${name}${url ? ` — ${url}` : ""}${excerpt ? ` — excerpt: "${excerpt}"` : ""}`);
  }
  return lines.join("\n");
}

/* -------------------------
   Route
   ------------------------- */

export async function POST(req: Request) {
  try {
    // Support debug mode via query param: ?debug=json
    const url = new URL(req.url);
    const debugJson = url.searchParams.get("debug") === "json";

    const body = await req.json().catch((e) => {
      console.error("Invalid JSON request body:", e);
      if (debugJson) {
        return { messages: [] };
      }
      throw new Error("Invalid JSON body");
    });

    const { messages }: { messages: UIMessage[] } = body ?? { messages: [] };

    if (!Array.isArray(messages) || messages.length === 0) {
      if (debugJson) {
        return new Response(JSON.stringify({ probeMatches: [], sourceSummary: "", debug: "no messages" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Missing messages" }), { status: 400 });
    }

    // latest user text
    const latestUserMessage = messages.filter((m) => m.role === "user").pop();
    const userText = latestUserMessage
      ? (latestUserMessage.parts ?? [])
          .filter((p: any) => p.type === "text")
          .map((p: any) => ("text" in p ? String(p.text) : ""))
          .join("")
      : "";

    if (!userText || userText.trim() === "") {
      if (debugJson) {
        return new Response(JSON.stringify({ probeMatches: [], sourceSummary: "", debug: "no user text found" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
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

    // moderation
    try {
      const mod = await isContentFlagged(userText);
      if (mod?.flagged) {
        if (debugJson) {
          return new Response(
            JSON.stringify({
              probeMatches: [],
              sourceSummary: "",
              debug: "message flagged by moderation",
              denialMessage: mod.denialMessage,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        const denial = mod.denialMessage ?? "Your message violates our guidelines. I can't answer that.";
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
      console.error("Moderation error:", merr);
      // continue
    }

    // Probe Pinecone (vector DB)
    const probeMatches = await runVectorProbe(userText, { k: 5, namespace: undefined });
    console.info(`runVectorProbe returned ${Array.isArray(probeMatches) ? probeMatches.length : 0} matches`);

    // Debug return of raw matches + summary (no LLM) if requested
    const sourceSummary = buildSourceSummary(probeMatches, 5);
    if (debugJson) {
      // Return raw probeMatches so you can inspect them directly
      return new Response(
        JSON.stringify({
          probeMatches,
          sourceSummary,
          debug: "raw vector probe output",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // If no matches found, stream a short "no documents" message (do not call web search)
    if (!probeMatches || probeMatches.length === 0) {
      console.info("No pinecone matches found for query — streaming 'no documents found' to client.");
      const stream = createUIMessageStream({
        execute({ writer }) {
          const id = "no-docs";
          writer.write({ type: "start" });
          writer.write({ type: "text-start", id });
          writer.write({ type: "text-delta", id, delta: "I couldn't find relevant documents in the knowledge base. Please upload the document or try a different query." });
          writer.write({ type: "text-end", id });
          writer.write({ type: "finish" });
        },
      });
      return createUIMessageStreamResponse({ stream });
    }

    // Build system prompt augmented with source summary from Pinecone
    const systemPromptWithSources = sourceSummary ? `${SYSTEM_PROMPT}\n\n${sourceSummary}` : SYSTEM_PROMPT;

    // Stream using streamText — expose vectorDatabaseSearch as a tool so model can re-query if it wants
    const result = streamText({
      model: MODEL,
      system: systemPromptWithSources,
      messages: convertToModelMessages(messages),
      tools: {
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

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
    });
  } catch (err: any) {
    console.error("Unhandled /api/chat error:", err);
    const stream = createUIMessageStream({
      execute({ writer }) {
        const id = "internal-error";
        writer.write({ type: "start" });
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: `Server error: ${(err as any)?.message ?? String(err)}.` });
        writer.write({ type: "text-end", id });
        writer.write({ type: "finish" });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }
}
