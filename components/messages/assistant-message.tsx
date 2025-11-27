// components/messages/assistant-message.tsx
import { UIMessage, ToolCallPart, ToolResultPart } from "ai";
import { Response } from "@/components/ai-elements/response";
import { ReasoningPart } from "./reasoning-part";
import { ToolCall, ToolResult } from "./tool-call";
import CitationLink from "./CitationLink";

/**
 * AssistantMessage
 * - Renders each message.part (text / reasoning / tool)
 * - If the message contains a structured `sources` array (probeMatches attached by client),
 *   renders a Sources block below the message text with excerpt + download link.
 *
 * Expected shape for sources: Array of objects like:
 * {
 *   id: "...",
 *   score: 0.987,
 *   text: "chunk text...",
 *   metadata: {
 *     source_name: "Policy A",
 *     source_url: "https://drive.google.com/uc?export=download&id=...",
 *     source_description: "...",
 *   }
 * }
 *
 * The client should attach `probeMatches` to assistant message as `message.sources = probeMatches`.
 */
export function AssistantMessage({
    message,
    status,
    isLastMessage,
    durations,
    onDurationChange,
}: {
    message: UIMessage;
    status?: string;
    isLastMessage?: boolean;
    durations?: Record<string, number>;
    onDurationChange?: (key: string, duration: number) => void;
}) {
    return (
        <div className="w-full">
            <div className="text-sm flex flex-col gap-4">
                {message.parts.map((part, i) => {
                    const isStreaming = status === "streaming" && isLastMessage && i === message.parts.length - 1;
                    const durationKey = `${message.id}-${i}`;
                    const duration = durations?.[durationKey];

                    if (part.type === "text") {
                        return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
                    } else if (part.type === "reasoning") {
                        return (
                            <ReasoningPart
                                key={`${message.id}-${i}`}
                                part={part}
                                isStreaming={isStreaming}
                                duration={duration}
                                onDurationChange={onDurationChange ? (d) => onDurationChange(durationKey, d) : undefined}
                            />
                        );
                    } else if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                        if ("state" in part && (part as any).state === "output-available") {
                            return <ToolResult key={`${message.id}-${i}`} part={part as unknown as ToolResultPart} />;
                        } else {
                            return <ToolCall key={`${message.id}-${i}`} part={part as unknown as ToolCallPart} />;
                        }
                    }
                    return null;
                })}

                {/* --- Structured sources block (probeMatches) --- */}
                {/* Client should attach structured probeMatches as message.sources */}
                {renderSourcesBlock(message)}
            </div>
        </div>
    );
}

/**
 * Helper to render sources. Accepts either:
 * - message.sources (preferred), or
 * - message.metadata?.sources (fallback)
 */
function renderSourcesBlock(message: UIMessage) {
    // TS: UIMessage doesn't define .sources, so cast to any
    const maybeAny: any = message as any;
    const sources = Array.isArray(maybeAny.sources)
        ? maybeAny.sources
        : Array.isArray(maybeAny.metadata?.sources)
        ? maybeAny.metadata.sources
        : [];

    if (!Array.isArray(sources) || sources.length === 0) {
        return null;
    }

    return (
        <div className="mt-2">
            <div className="text-xs text-gray-500 mb-2">Sources / documents used:</div>
            <div className="flex flex-col gap-3">
                {sources.map((s: any, idx: number) => {
                    const metadata = s.metadata ?? {};
                    const url = metadata.source_url ?? s.source_url ?? "";
                    const name = metadata.source_name ?? s.source_name ?? `Source ${idx + 1}`;
                    const excerpt = (metadata.text ?? s.text ?? "").toString().slice(0, 350);

                    return (
                        <div key={s.id ?? idx} className="p-3 bg-white border rounded-md shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
                                    {excerpt ? (
                                        <div className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">{excerpt}{excerpt.length >= 350 ? "…" : ""}</div>
                                    ) : (
                                        metadata.source_description && <div className="mt-1 text-xs text-gray-700">{metadata.source_description}</div>
                                    )}
                                </div>

                                <div className="shrink-0 ml-4">
                                    <CitationLink url={url} label="Download document" />
                                </div>
                            </div>

                            {/* Optionally show metadata like order / score if available */}
                            <div className="mt-2 text-xs text-gray-400 flex gap-3">
                                {typeof s.score === "number" && <div>score: {s.score.toFixed(3)}</div>}
                                {typeof s.order === "number" && <div>chunk: {s.order}</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AssistantMessage;
