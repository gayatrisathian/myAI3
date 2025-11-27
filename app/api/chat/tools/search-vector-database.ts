// app/api/chat/tools/search-vector-database.ts
import { tool } from "ai";
import { z } from "zod";
import { searchPinecone } from "@/lib/pinecone";

/**
 * Tool shape expected by route.ts: vectorDatabaseSearch.execute({ query, k, namespace })
 * Also export the function so route.ts can call it directly if needed.
 */

export const vectorDatabaseSearch = tool({
  description: "Search the Pinecone vector DB for similar text chunks",
  inputSchema: z.object({
    query: z.string().min(1),
    k: z.number().optional(),
    namespace: z.string().optional(),
  }),
  execute: async ({ query, k = 5, namespace }: { query: string; k?: number; namespace?: string }) => {
    try {
      // searchPinecone returns an array of matches (see lib/pinecone.ts below)
      const matches = await searchPinecone(query, { topK: k, namespace });
      // Normalize to the shape route.ts expects: array of objects with .score, .id, .metadata, .text
      return matches.map((m) => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata || {},
        text: m.text || m.metadata?.text || "",
      }));
    } catch (err) {
      console.error("vectorDatabaseSearch.execute error:", err);
      return [];
    }
  },
});

// Also export as plain function for direct calls (optional)
export async function vectorDatabaseSearchFn(query: string, opts?: { k?: number; namespace?: string }) {
  const res = await (vectorDatabaseSearch as any).execute({ query, k: opts?.k ?? 5, namespace: opts?.namespace });
  return res;
}

export default vectorDatabaseSearch;
