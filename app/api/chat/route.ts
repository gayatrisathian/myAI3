// app/api/chat/route.ts
import { NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * This route lazily imports heavy helpers and normalizes "tools" into
 * a Tool-like shape (objects exposing an `execute` method).
 *
 * This avoids compile-time issues where Next/TS tries to statically
 * evaluate non-module shapes or mismatched types.
 */

function makeToolLike(maybeTool: any) {
  if (!maybeTool) return undefined;

  // Already a Tool-like object (has execute)
  if (typeof maybeTool === "object" && typeof maybeTool.execute === "function") {
    return maybeTool;
  }

  // Plain function -> wrap into object with execute
  if (typeof maybeTool === "function") {
    return {
      execute: async (input: any) => {
        const query = input && (input.query ?? input) ?? "";
        try {
          // pass entire input as second arg so underlying function can use opts (numResults/k)
          return await maybeTool(query, input);
        } catch (err) {
          // Non-fatal: log and return empty array (tools should fail gracefully)
          // eslint-disable-next-line no-console
          console.error("Tool wrapper execute() error:", err);
          return [];
        }
      },
    };
  }

  // Otherwise return as-is (best-effort)
  return maybeTool;
}

export async function POST(req: Request) {
  try {
    // Lazy-import modules (so they don't execute at compile-time)
    const [
      aiModule,
      configModule,
      promptsModule,
      moderationModule,
      webSearchModule,
      vectorDBModule,
    ] = await Promise.all([
      import("ai").catch((e) => {
        // If module not found, return empty object to avoid failing import
        // We'll fail later if required functions are missing.
        return {};
      }),
      import("@/config").catch(() => ({})),
      import("@/prompts").catch(() => ({})),
      import("@/lib/moderation").catch(() => ({})),
      import("./tools/web-search").catch(() => ({})),
      import("./tools/search-vector-database").catch(() => ({})),
    ]);

    // Extract utilities we expect (use any to avoid compile-time type coupling)
    const streamText: any = aiModule?.streamText;
    const convertToModelMessages: any = aiModule?.convertToModelMessages;
    const stepCountIs: any = aiModule?.stepCountIs;
    const createUIMessageStream: any = aiModule?.createUIMessageStream;
    const createUIMessageStreamResponse: any = aiModule?.createUIMessageStreamResponse;

    const MODEL: any = configModule?.MODEL;
    const SYSTEM_PROMPT: any = promptsModule?.SYSTEM_PROMPT;

    const isContentFlagged: any = moderationModule?.isContentFlagged;

    // read request body
    const body = await req.json().catch(() => ({}));
    const messages: any[] = body?.messages ?? [];

    // moderation check for the latest user text
    const latestUserMessage = messages.filter((m) => m?.role === "user").pop();
    if (latestUserMessage) {
      const textParts = (latestUserMessage.parts || [])
        .filter((p) => p?.type === "text")
        .map((p) => ("text" in p ? p.text : ""))
        .join("");

      if (textParts && typeof isContentFlagged === "function") {
        const moderationResult = await isContentFlagged(textParts).catch(() => ({ flagged: false }));
        if (moderationResult?.flagged) {
          // stream a moderation-denial message back (uses ai helpers if available)
          if (typeof createUIMessageStream === "function" && typeof createUIMessageStreamResponse === "function") {
            const stream = createUIMessageStream({
              execute({ writer }: any) {
                const textId = "moderation-denial-text";
                writer.write({ type: "start" });
                writer.write({ type: "text-start", id: textId });
                writer.write({
                  type: "text-delta",
                  id: textId,
                  delta: moderationResult?.denialMessage || "Your message violates our guidelines. I can't answer that.",
                });
                writer.write({ type: "text-end", id: textId });
                writer.write({ type: "finish" });
              },
            });
            return createUIMessageStreamResponse({ stream });
          } else {
            // fallback JSON response if ai helpers unavailable
            return NextResponse.json({ ok: false, error: moderationResult?.denialMessage ?? "Message flagged" }, { status: 403 });
          }
        }
      }
    }

    // Prepare tools: we may have imported either plain functions or ai.tool objects.
    const rawWebSearch =
      webSearchModule?.webSearch ?? webSearchModule?.default ?? webSearchModule;
    const rawVectorSearch =
      vectorDBModule?.vectorDatabaseSearch ?? vectorDBModule?.default ?? vectorDBModule;

    const webSearchToolLike = makeToolLike(rawWebSearch);
    const vectorDatabaseSearchToolLike = makeToolLike(rawVectorSearch);

    // Validate streamText exists
    if (typeof streamText !== "function") {
      return NextResponse.json({ ok: false, error: "streamText provider not available" }, { status: 500 });
    }

    // Call streamText with normalized tools
    const result = streamText({
      model: MODEL,
      system: SYSTEM_PROMPT,
      messages: typeof convertToModelMessages === "function" ? convertToModelMessages(messages) : messages,
      tools: {
        webSearch: webSearchToolLike,
        vectorDatabaseSearch: vectorDatabaseSearchToolLike,
      },
      stopWhen: typeof stepCountIs === "function" ? stepCountIs(10) : undefined,
      providerOptions: {
        openai: {
          reasoningSummary: "auto",
          reasoningEffort: "low",
          parallelToolCalls: false,
        },
      },
    });

    // Convert to UI stream response if available
    if (result && typeof result.toUIMessageStreamResponse === "function") {
      return result.toUIMessageStreamResponse({ sendReasoning: true });
    }

    // Otherwise, if result is something else, return JSON
    return NextResponse.json({ ok: true, result: typeof result === "object" ? result : String(result) });
  } catch (err) {
    // ensure route always exports a valid module and returns JSON on errors
    // eslint-disable-next-line no-console
    console.error("Error in /api/chat/route POST:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "chat route alive" });
}
