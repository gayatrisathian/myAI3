// lib/pinecone.ts  (cohere variant)
import { PineconeClient } from "@pinecone-database/pinecone";
import Cohere from "cohere-ai";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "";
const PINECONE_ENV = process.env.PINECONE_ENV || "";
const PINECONE_INDEX = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || "my-ai";
const COHERE_API_KEY = process.env.COHERE_API_KEY || "";

let pineconeClient: PineconeClient | null = null;
function getClient() {
  if (pineconeClient) return pineconeClient;
  if (!PINECONE_API_KEY) throw new Error("Missing PINECONE_API_KEY");
  pineconeClient = new PineconeClient();
  pineconeClient.init({
    apiKey: PINECONE_API_KEY,
    environment: PINECONE_ENV,
  });
  return pineconeClient;
}

Cohere.init(COHERE_API_KEY);

export async function searchPinecone(query: string, opts?: { topK?: number; namespace?: string }) {
  if (!COHERE_API_KEY) {
    console.warn("COHERE_API_KEY missing; cannot create query embeddings");
    return [];
  }

  const topK = opts?.topK ?? 5;
  const namespace = opts?.namespace;

  try {
    // Create embedding for query
    const embedResp = await Cohere.embed({
      model: "embed-english-v3.0",
      texts: [query],
      input_type: "search_query",
    });
    const vector = embedResp.embeddings[0]; // 1024-d vector

    const client = getClient();
    const index = client.Index(PINECONE_INDEX);

    const queryResponse = await index.query({
      vector,
      topK,
      includeMetadata: true,
      namespace,
    });

    const matches = (queryResponse.matches ?? []).map((m: any) => ({
      id: m.id,
      score: m.score,
      metadata: m.metadata ?? {},
      // Attempt to put a readable 'text' field in the match (common places: metadata.text or metadata.chunk)
      text: (m.metadata?.text ?? m.metadata?.chunk ?? "") as string,
    }));

    return matches;
  } catch (err) {
    console.error("searchPinecone (cohere) error:", err);
    return [];
  }
}
