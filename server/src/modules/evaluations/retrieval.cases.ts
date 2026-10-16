export type RetrievalCase = { query: string; expectedTitle: string };

export const retrievalCases: RetrievalCase[] = [
  {
    query: "how many days do I have to return an item",
    expectedTitle: "NovaStore Returns and Refunds Policy",
  },
  {
    query: "can I cancel an order before it ships",
    expectedTitle: "NovaStore Returns and Refunds Policy",
  },
  {
    query: "how long does standard shipping take",
    expectedTitle: "NovaStore Shipping and Delivery Policy",
  },
  { query: "free shipping threshold", expectedTitle: "NovaStore Shipping and Delivery Policy" },
  {
    query: "parcel has not moved for days carrier investigation",
    expectedTitle: "NovaStore Shipping and Delivery Policy",
  },
  {
    query: "my headphones arrived broken",
    expectedTitle: "NovaStore Damaged and Defective Items Policy",
  },
  {
    query: "electronics warranty length",
    expectedTitle: "NovaStore Damaged and Defective Items Policy",
  },
  {
    query: "who pays return shipping for defective products",
    expectedTitle: "NovaStore Damaged and Defective Items Policy",
  },
  {
    query: "when will my card refund appear",
    expectedTitle: "NovaStore Payments and Refund Timing",
  },
  {
    query: "refund above 200 dollars second approval",
    expectedTitle: "NovaStore Payments and Refund Timing",
  },
  {
    query: "will support ask for my card number",
    expectedTitle: "NovaStore Payments and Refund Timing",
  },
];

export type RetrievalMetrics = { queries: number; recallAt3: number; mrr: number };

export function scoreRetrieval(rankedTitles: string[][], cases = retrievalCases): RetrievalMetrics {
  let hits = 0;
  let reciprocal = 0;
  cases.forEach((testCase, index) => {
    const position = (rankedTitles[index] ?? []).indexOf(testCase.expectedTitle);
    if (position >= 0) reciprocal += 1 / (position + 1);
    if (position >= 0 && position < 3) hits += 1;
  });
  const queries = cases.length;
  return { queries, recallAt3: hits / queries, mrr: reciprocal / queries };
}
