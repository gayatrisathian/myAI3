// app/api/chat/tools/web-search.ts
/**
 * Minimal, runtime-exported webSearch function.
 * Uses dynamic import of exa-js so this module is a tiny ES module at compile-time.
 * Returns an array of { title, url, content, publishedDate } as before.
 */

export type WebSearchResult = {
  title: string;
  url?: string;
  content?: string;
  publishedDate?: string | null;
};

export async function webSearch(query: string, opts?: { numResults?: number }): Promise<WebSearchResult[]> {
  try {
    // dynamic import to avoid top-level side-effects / build-time issues
    const ExaModule = await import("exa-js");
    // exa-js may export default or named export; handle both
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Exa: any = ExaModule?.default ?? ExaModule;

    const exa = new Exa(process.env.EXA_API_KEY);

    const numResults = opts?.numResults ?? 3;

    const { results } = await exa.search(query, {
      contents: {
        text: true,
      },
      numResults,
    });

    return (results || []).map((result: any) => ({
      title: result.title,
      url: result.url,
      content: result.text?.slice(0, 1000) || "",
      publishedDate: result.publishedDate ?? null,
    }));
  } catch (error) {
    // keep errors non-fatal for the route
    // eslint-disable-next-line no-console
    console.error("webSearch error:", error);
    return [];
  }
}
