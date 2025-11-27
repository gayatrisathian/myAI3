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

import { webSearch } from "./tools/web-search";
import { vectorDatabaseSearch } from "./tools/search-vector-database";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const latestUserMessage = messages.filter((msg) => msg.role === "user").pop();

  if (latestUserMessage) {
    const textParts = latestUserMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join("");

    if (textParts) {
      // Moderation check
      const moderationResult = await isContentFlagged(textParts);

      if (moderationResult.flagged) {
        const stream = createUIMessageStream({
          execute({ writer }) {
            const textId = "moderation-denial-text";

            writer.write({
              type: "start",
            });

            writer.write({
              type: "text-start",
              id: textId,
            });

            writer.write({
              type: "text-delta",
              id: textId,
              delta:
                moderationResult.denialMessage ||
                "Your message violates our guidelines. I can't answer that.",
            });

            writer.write({
              type: "text-end",
              id: textId,
            });

            writer.write({
              type: "finish",
            });
          },
        });

        return createUIMessageStreamResponse({ stream });
      }

      // --- Decide whether to include webSearch as a fallback ---
      // Try vector DB first (lightweight check). If no matches returned then
      // allow webSearch as a tool so the model can query the web.
      let includeWebSearch = false;
      try {
        // Ask vector DB for a few matches to test whether it has relevant content.
        // Use k small; you can adjust if you want a stricter condition.
        const probeResults = await vectorDatabaseSearch(textParts, { k: 3, namespace: undefined });
        if (!probeResults || probeResults.length === 0) {
          includeWebSearch = true;
        }
      } catch (probeErr) {
        // If the probe itself errors, allow web search as a fallback (conservative).
        console.error("vectorDatabaseSearch probe error — enabling web search fallback:", probeErr);
        includeWebSearch = true;
      }

      // Prepare tools object depending on probe result
      const tools: Record<string, any> = {
        vectorDatabaseSearch,
      };
      if (includeWebSearch) {
        tools.webSearch = webSearch;
      }

      // Now stream to the model using the selected tools
      const result = streamText({
        model: MODEL,
        system: SYSTEM_PROMPT,
        messages: convertToModelMessages(messages),
        tools,
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
    }
  }

  // If there is no user text (should be rare), fall back to original streaming call without the probe.
  const fallbackResult = streamText({
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    tools: {
      vectorDatabaseSearch,
      webSearch, // make webSearch available by default in this fallback case
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

  return fallbackResult.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
