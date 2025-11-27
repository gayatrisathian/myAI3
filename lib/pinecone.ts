// lib/pinecone.ts  (OpenAI embedder variant)
import { PineconeClient } from "@pinecone-database/pinecone";
import OpenAI from "openai";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "";
const PINECONE_ENV = process.env.PINECONE_ENV || "";
const PINECONE_INDEX = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || "my-ai";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

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

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function searchPinecone(query: string, opts?: { topK?: number; namespace?: string }) {
  if (!OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY missing; cannot create query embeddings");
    return [];
  }

  const topK = opts?.topK ?? 5;
  const namespace = opts?.namespace;

  try {
    // Create an embedding for the query using OpenAI
    const embResp = await openai.embeddings.create({
      model: "text-embedding-3-small", // pick embed model that matches your index dims
      input: query,
    });
    const vector = embResp.data[0].embedding as number[];

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
      text: (m.metadata?.text ?? m.metadata?.chunk ?? "") as string,
    }));

    return matches;
  } catch (err) {
    console.error("searchPinecone (openai) error:", err);
    return [];
  }
}
