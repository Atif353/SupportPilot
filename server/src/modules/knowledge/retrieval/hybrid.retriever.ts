import { lexicalSearch, type RetrievalHit } from "./lexical.retriever.js";
import { vectorSearch } from "./vector.retriever.js";

export const hybridSearch = async (query: string, limit = 5): Promise<RetrievalHit[]> => {
  const [lexical, vector] = await Promise.all([lexicalSearch(query), vectorSearch(query)]);
  const merged = new Map<string, RetrievalHit & { hybridScore: number }>();
  for (const [list, weight] of [
    [lexical, 0.45],
    [vector, 0.55],
  ] as const) {
    list.forEach((hit, index) => {
      const key = `${hit.documentId}:${hit.content}`;
      const current = merged.get(key) ?? { ...hit, hybridScore: 0 };
      current.hybridScore += weight / (60 + index + 1);
      current.score = current.hybridScore;
      merged.set(key, current);
    });
  }
  return [...merged.values()]
    .sort((left, right) => right.hybridScore - left.hybridScore)
    .slice(0, limit);
};
