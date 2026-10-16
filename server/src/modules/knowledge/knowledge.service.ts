import { hybridSearch } from "./retrieval/hybrid.retriever.js";

export type KnowledgeHit = {
  documentId: string;
  title: string;
  content: string;
  source: string;
  score: number;
};

export const searchKnowledge = async (query: string): Promise<KnowledgeHit[]> => {
  return hybridSearch(query, 5);
};
