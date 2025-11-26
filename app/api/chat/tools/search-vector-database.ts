// app/api/chat/tools/search-vector-database.ts
/**
 * Adapter that exposes a named runtime function `vectorDatabaseSearch`.
 * It dynamically imports the app's pinecone helper to avoid top-level dependency issues.
 */

export type VectorSearchResult = {
  id?: string;
  score?: number;
  text?: string;
  metadata?: Record<string, any>;
  source?: string;
};

export async function vectorDatabaseSearch(query: string, opts?: { k?: number }): Promise<VectorSearchResult[]> {
  try {
    // dynamic import of internal pinecone helper to avoid build-time circular / runtime problems
    const pineconeModule = await import("@/lib/pinecone");
    // expected exported function in your lib: searchPinecone
    const searchPinecone = pineconeModule.searchPinecone ?? pineconeModule.default ?? pineconeModule.search;

    if (typeof searchPinecone !== "function") {
      // eslint-disable-next-line no-console
      console.error("vectorDatabaseSearch: searchPinecone is not a function in @/lib/pinecone");
      return [];
    }

    // call your existing helper
    const results = await searchPinecone(query, opts);
    return results ?? [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("vectorDatabaseSearch error:", err);
    return [];
  }
}
