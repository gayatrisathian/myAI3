// app/api/chat/route.ts
/**
 * Emergency echo route — safe fallback to restore UI responses immediately.
 *
 * Behavior:
 *  - Accepts JSON body { messages: UIMessage[] } (same shape your client already sends).
 *  - Extracts latest user text (first text part found).
 *  - Returns JSON:
 *      { probeMatches: [], assistant_text: "Echo: <user text>", used_web_search: false, debug: { preview } }
 *
 * Use this temporarily while we diagnose the original route issues.
 */

import { UIMessage } from "ai";

function extractLatestUserText(messages: any[]): string {
  if (!Array.isArray(messages)) return "";
  // find last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== "user") continue;
    const parts = Array.isArray(m.parts) ? m.parts : [];
    // prefer text parts
    for (const p of parts) {
      if (p && p.type === "text" && typeof p.text === "string" && p.text.trim() !== "") {
        return p.text.trim();
      }
    }
    // fallback: join other text-like fields
    if (typeof m.text === "string" && m.text.trim() !== "") {
      return m.text.trim();
    }
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch((e) => {
      console.error("Echo route - invalid JSON body:", String(e));
      return {};
    });

    const messages: UIMessage[] = body?.messages ?? [];
    const userText = extractLatestUserText(messages) || "";

    // short preview for debug (max 500 chars)
    const preview = (userText.length > 500) ? userText.slice(0, 500) + "...[truncated]" : userText;

    // Helpful log for Vercel
    console.info("[ECHO ROUTE] Received messages count:", Array.isArray(messages) ? messages.length : "not-array");
    console.info("[ECHO ROUTE] userText preview:", preview);

    // Return an immediate, deterministic response
    const responsePayload = {
      probeMatches: [], // empty for fallback
      assistant_text: userText ? `Echo: ${userText}` : "Echo: (no user text found)",
      used_web_search: false,
      debug: {
        receivedMessagePreview: preview,
        receivedLength: preview.length,
      },
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Echo route - unexpected error:", err);
    return new Response(
      JSON.stringify({
        probeMatches: [],
        assistant_text: "Echo: (internal error)",
        used_web_search: false,
        error: String((err as any)?.message ?? err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
