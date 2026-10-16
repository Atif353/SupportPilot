import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { apiClient } from "../../shared/api/apiClient";
import { PageHeader } from "../../shared/components/layout/PageHeader";
import { Button } from "../../shared/components/ui/Button";
import { FormError } from "../../shared/components/ui/Field";
import { StatusBadge } from "../../shared/components/data-display/StatusBadge";
type Evaluation = {
  _id: string;
  name: string;
  status: string;
  mode?: string;
  dataset: string;
  startedAt?: string;
  error?: string;
  metrics: Record<string, number>;
  results?: {
    id: string;
    prompt: string;
    expectedRoute: string;
    actualRoute: string;
    passed: boolean;
    toolCalls: string[];
    latencyMs: number;
    error?: string;
  }[];
};
export function EvaluationWorkspace() {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["evaluations"],
    queryFn: () => apiClient<Evaluation[]>("/evaluations"),
    refetchInterval: 5000,
  });
  const run = useMutation({
    mutationFn: () => apiClient("/evaluations/run", { method: "POST" }),
    onSettled: () => cache.invalidateQueries({ queryKey: ["evaluations"] }),
  });
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader eyebrow="Quality" title="Evaluations" description="Offline agent regression" />
        <Button busy={run.isPending} onClick={() => run.mutate()}>
          <Play className="size-4" />
          Run fixtures
        </Button>
      </div>
      <FormError error={query.error ?? run.error} />
      {query.isLoading && <p>Loading runs...</p>}
      {query.data?.length === 0 && (
        <p className="py-8 text-sm text-muted">No evaluation runs yet.</p>
      )}
      {query.data?.map((evaluation) => (
        <article key={evaluation._id} className="border-t border-border py-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="font-semibold">{evaluation.name}</h2>
              <p className="mt-1 text-xs text-muted">
                {evaluation.dataset} | {evaluation.mode ?? "Legacy run"} |{" "}
                {evaluation.startedAt ? new Date(evaluation.startedAt).toLocaleString() : ""}
              </p>
            </div>
            <StatusBadge status={evaluation.status} />
          </div>
          {evaluation.error && (
            <p role="alert" className="text-sm text-red-700">
              {evaluation.error}
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {Object.entries(evaluation.metrics).map(([key, value]) => (
              <div key={key}>
                <dt className="break-words text-xs text-muted">{key}</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {key === "cases" ? value : `${(value * 100).toFixed(1)}%`}
                </dd>
              </div>
            ))}
          </dl>
          <details className="mt-4">
            <summary className="text-sm text-accent">
              Case results ({evaluation.results?.length ?? 0})
            </summary>
            <div className="mt-3 divide-y divide-border">
              {evaluation.results?.map((result) => (
                <div key={result.id} className="py-3 text-sm">
                  <div className="flex gap-3">
                    <StatusBadge status={result.passed ? "COMPLETED" : "FAILED"} />
                    <p>{result.prompt}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Expected: {result.expectedRoute} | Actual: {result.actualRoute} | Tools:{" "}
                    {result.toolCalls.join(", ") || "none"} | {result.latencyMs}ms
                  </p>
                  {result.error && <p className="text-red-700">{result.error}</p>}
                </div>
              ))}
            </div>
          </details>
        </article>
      ))}
    </section>
  );
}
