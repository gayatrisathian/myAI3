f// app/api/chat/route.ts
import { NextResponse } from "next/server";

/**
 * Lazy-importing route implementation.
 * This file exports a named POST (and optional GET) so Next's App Router sees it as a module,
 * but we delay importing heavy/runtime modules until runtime to avoid compile-time / circular issues.
 */

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Lazy imports — load modules only when route is invoked.
    const [
      aiModule,
      configModule,
      promptsModule,
      moderationModule,
      webSearchModule,
      vectorDBModule
    ] = await Promise.all([
      import("ai"),
      import("@/config"),
      import("@/prompts"),
      import("@/lib/moderation"),
      import("./tools/web-search"),
      import("./tools/search-vector-database"),
    ]);

    // Extract only what we need
    const {
      streamText,
      convertToModelMessages,
      stepCountIs,
      createUIMessageStream,
      createUIMessageStreamResponse,
    } = aiModule;
    const { MODEL } = configModule;
    const { SYSTEM_PROMPT } = promptsModule;
    const { isContentFlagged } = moderationModule;
    const { webSearch } = webSearchModule;
    const { vectorDatabaseSearch } = vectorDBModule;

    const body = await req.json();
    const messages = body?.messages ?? [];

    const latestUserMessage = messages.filter((m: any) => m.role === "user").pop();

    if (latestUserMessage) {
      const textParts = (latestUserMessage.parts || [])
        .filter((part: any) => part?.type === "text")
        .map((part: any) => ("text" in part ? part.text : ""))
        .join("");

      if (textParts) {
        const moderationResult = await isContentFlagged(textParts);

        if (moderationResult.flagged) {
          const stream = createUIMessageStream({
            execute({ writer }: any) {
              const textId = "moderation-denial-text";

              writer.write({ type: "start" });
              writer.write({ type: "text-start", id: textId });
              writer.write({
                type: "text-delta",
                id: textId,
                delta: moderationResult.denialMessage || "Your message violates our guidelines. I can't answer that.",
              });
              writer.write({ type: "text-end", id: textId });
              writer.write({ type: "finish" });
            },
          });

          return createUIMessageStreamResponse({ stream });
        }
      }
    }

    // --- wrap plain functions into Tool-like objects (replace the old streamText(...) call) ---

// helper to normalise either a function or a Tool-like object into a Tool-like object
function makeToolLike(maybeTool: any) {
  if (!maybeTool) return undefined;
  // if it's already an object with execute, assume it's a Tool-like object
  if (typeof maybeTool === "object" && typeof maybeTool.execute === "function") {
    return maybeTool;
  }
  // if it's a function, wrap it into { execute: async (input) => ... }
  if (typeof maybeTool === "function") {
    return {
      execute: async (input: any) => {
        // support two common calling shapes:
        // - execute({ query: "..." , ... })
        // - execute("...") or underlying function(query, opts?)
        const query = input && (input.query ?? input) ?? "";
        // pass whole input as opts too so underlying function may use numResults / k etc.
        try {
          return await maybeTool(query, input);
        } catch (err) {
          // keep failures non-fatal for streamText — log and return empty
          // eslint-disable-next-line no-console
          console.error("Tool wrapper execute() error:", err);
          return [];
        }
      }
    };
  }
  // otherwise just return as-is
  return maybeTool;
}

// normalize whatever you imported as webSearch / vectorDatabaseSearch
// (cover both cases: you have `webSearch` variables or `webSearchModule` objects)
const rawWebSearch = typeof webSearch !== "undefined" ? webSearch
  : (typeof webSearchModule !== "undefined" ? (webSearchModule?.webSearch ?? webSearchModule?.default ?? webSearchModule) : undefined);

const rawVectorSearch = typeof vectorDatabaseSearch !== "undefined" ? vectorDatabaseSearch
  : (typeof vectorDBModule !== "undefined" ? (vectorDBModule?.vectorDatabaseSearch ?? vectorDBModule?.default ?? vectorDBModule) : undefined);

const webSearchToolLike = makeToolLike(rawWebSearch);
const vectorDatabaseSearchToolLike = makeToolLike(rawVectorSearch);

// now call streamText with tool-like objects
const result = streamText({
  model: MODEL,
  system: SYSTEM_PROMPT,
  messages: convertToModelMessages(messages),
  tools: {
    webSearch: webSearchToolLike,
    vectorDatabaseSearch: vectorDatabaseSearchToolLike,
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
  } catch (err) {
    // Fail-safe: return JSON error so the route remains a valid module at compile-time.
    console.error("Error in /api/chat/route POST:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Optional health-check GET — keeps file clearly a module and is helpful for debugging.
// Remove if you don't want GET exposed.
export async function GET() {
  return NextResponse.json({ ok: true, message: "chat route alive" });
}
