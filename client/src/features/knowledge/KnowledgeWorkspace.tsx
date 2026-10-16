import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, RotateCcw, Search, Upload } from "lucide-react";
import { apiClient } from "../../shared/api/apiClient";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";
import { Field, FormError, Select, Textarea } from "../../shared/components/ui/Field";
import { PageHeader } from "../../shared/components/layout/PageHeader";
import { StatusBadge } from "../../shared/components/data-display/StatusBadge";

type Document = {
  _id: string;
  title: string;
  sourceType: string;
  status: string;
  version: number;
  indexStatus: string;
  chunkCount: number;
  indexError?: string;
  embeddingModel?: string;
};
type Hit = { title: string; content: string; source: string; score: number };
export function KnowledgeWorkspace() {
  const { session } = useAuth();
  const admin = session?.user.role === "ADMIN";
  const cache = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState("POLICY");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const documents = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => apiClient<Document[]>("/knowledge"),
    refetchInterval: 4000,
  });
  const hits = useQuery({
    queryKey: ["knowledge-search", search],
    queryFn: () => apiClient<Hit[]>(`/knowledge/search?q=${encodeURIComponent(search)}`),
    enabled: search.length >= 2,
  });
  const mutation = useMutation({
    mutationFn: async (action: {
      type: "create" | "retry" | "archive";
      id?: string;
      files?: FileList;
    }) => {
      if (action.files) {
        const files = Array.from(action.files);
        if (
          files.length > 10 ||
          files.some((file) => file.size > 200000 || !/\.(md|txt)$/i.test(file.name))
        )
          throw new Error("Choose up to 10 Markdown or text files, at most 200 KB each.");
        for (const file of files)
          await apiClient("/knowledge/documents", {
            method: "POST",
            body: JSON.stringify({ title: file.name, content: await file.text(), sourceType }),
          });
        return;
      }
      if (action.type === "create")
        return apiClient("/knowledge/documents", {
          method: "POST",
          body: JSON.stringify({ title, content, sourceType }),
        });
      return apiClient(`/knowledge/documents/${action.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: action.type }),
      });
    },
    onSettled: () => cache.invalidateQueries({ queryKey: ["knowledge"] }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      void cache.invalidateQueries({ queryKey: ["knowledge-search"] });
    },
  });
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Knowledge"
        title="Knowledge base"
        description="Documents and retrieval"
      />
      <FormError error={documents.error ?? mutation.error} />
      {admin && (
        <details className="border-y border-border py-4">
          <summary className="font-medium">Add documents</summary>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate({ type: "create" });
              }}
            >
              <Field label="Title">
                <Input
                  value={title}
                  required
                  maxLength={200}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              <Field label="Type">
                <Select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                  {["POLICY", "FAQ", "PRODUCT", "MANUAL"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Document content">
                <Textarea
                  required
                  minLength={20}
                  maxLength={200000}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
              </Field>
              <Button type="submit" busy={mutation.isPending}>
                <Upload className="size-4" />
                Queue document
              </Button>
            </form>
            <Field label="Markdown / text files">
              <input
                type="file"
                accept=".md,.txt"
                multiple
                disabled={mutation.isPending}
                onChange={(event) => {
                  if (event.target.files?.length)
                    mutation.mutate({ type: "create", files: event.target.files });
                  event.target.value = "";
                }}
                className="max-w-full text-sm"
              />
            </Field>
          </div>
        </details>
      )}
      <div className="divide-y divide-border">
        {documents.isLoading && <p>Loading documents...</p>}
        {documents.data?.length === 0 && (
          <p className="py-8 text-sm text-muted">No documents yet.</p>
        )}
        {documents.data?.map((document) => (
          <article
            key={document._id}
            className="flex flex-wrap items-start justify-between gap-4 py-4"
          >
            <div className="min-w-0">
              <h2 className="font-medium">{document.title}</h2>
              <p className="mt-1 text-xs text-muted">
                {document.sourceType} | Version {document.version} | {document.chunkCount ?? 0}{" "}
                chunks | {document.embeddingModel ?? "Not indexed"}
              </p>
              {document.indexError && (
                <p className="mt-2 text-sm text-red-700">{document.indexError}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={
                  document.status === "ARCHIVED" ? "ARCHIVED" : (document.indexStatus ?? "QUEUED")
                }
              />
              {admin && (
                <>
                  <Button
                    variant="ghost"
                    disabled={mutation.isPending || document.indexStatus === "INDEXING"}
                    aria-label={`Reindex ${document.title}`}
                    title="Reindex document"
                    onClick={() => mutation.mutate({ type: "retry", id: document._id })}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={
                      mutation.isPending ||
                      document.indexStatus === "INDEXING" ||
                      document.status === "ARCHIVED"
                    }
                    aria-label={`Archive ${document.title}`}
                    title="Archive document"
                    onClick={() => mutation.mutate({ type: "archive", id: document._id })}
                  >
                    <Archive className="size-4" />
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      <section className="space-y-3 border-t border-border pt-5">
        <h2 className="mb-4 font-semibold">Search preview</h2>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(query.trim());
          }}
        >
          <Input
            aria-label="Search knowledge"
            minLength={2}
            required
            maxLength={1000}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" aria-label="Search" title="Search" busy={hits.isFetching}>
            <Search className="size-4" />
          </Button>
        </form>
        <FormError error={hits.error} />
        {hits.data?.length === 0 && (
          <p className="py-4 text-sm text-muted">No published passages found.</p>
        )}
        {hits.data?.map((hit, index) => (
          <article
            key={`${hit.source}-${index}`}
            className="rounded-xl border border-border bg-surface p-4 shadow-card"
          >
            <h3 className="text-sm font-semibold">
              {index + 1}. {hit.title}
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{hit.content}</p>
            <p className="mt-2 text-xs text-muted">Fusion score: {hit.score.toFixed(5)}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
