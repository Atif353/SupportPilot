# Architecture

SupportPilot is a pnpm workspace with two packages: a React client (`client/`) and an Express API (`server/`). MongoDB is the only datastore and must run as a replica set because several workflows use transactions.

```
client/src
  app/          providers, layouts, router
  features/     chat, orders, returns, approvals, knowledge, evaluations, tickets
  pages/        route-level pages
  shared/       api client, auth session, UI components, utilities

server/src
  config/       env, logger, database, socket server
  common/       errors, validation, idempotency, middleware
  modules/
    auth/ customer/ orders/ conversations/ tickets/ proactive/
    admin/        staff workflows (approvals, returns, conversations)
    agent/        graph, routing, guardrails, providers, tools, answers
    knowledge/    ingestion, chunking, lexical/vector/hybrid retrieval
    evaluations/  offline fixtures, routing and retrieval datasets
    models/       Mongoose models
  scripts/        seed, knowledge ingestion, local database, live evaluation
```

## Authentication

Access tokens are short-lived HS256 JWTs. Every request re-checks that the user is active and that the role in the token still matches. Refresh tokens are stored server-side, rotated on each use, and the whole token family is revoked if an old one is replayed or the user logs out. Socket.IO connections apply the same checks and are re-validated every 30 seconds.

## Safe actions

The agent can read; it cannot write. Order changes go through `POST /api/v1/tools/:tool` after an explicit confirmation in the UI and require an `Idempotency-Key`.

- Keys are scoped to the actor and operation and stored with a hash of the payload. Reusing a key with different input returns 409.
- The result, the domain change and the audit record commit in one transaction.
- Cancellation is limited to `PENDING` and `PAYMENT_CONFIRMED` orders and never marks a payment refunded.
- Returns validate the purchased item, quantity, the 30-day delivery window and cumulative quantities.
- A refund request creates a linked approval atomically. A second staff member decides it with a written reason. Approval sets the refund to `APPROVED`; no payment provider is connected.

## Staff workflows

- **Conversations:** claim, reply, release, resolve, reopen. Claiming can't reopen a resolved case or interrupt a running AI response (a per-conversation lease prevents overlap).
- **Returns:** `REQUESTED → APPROVED → RECEIVED → COMPLETED`, or `REQUESTED → REJECTED`, with notes and audit history.
- **Approvals:** `PENDING → APPROVED | REJECTED`.
- **Tickets:** status changes only.

## Agent

See [agents.md](agents.md) for the graph, routing, guardrails, streaming and recovery. Each run is saved as an `AgentTrace` (nodes, routing method, tool spans, model, tokens, guardrail results, failures).

## Knowledge and search

Documents are queued, then a worker leases one at a time, splits it into overlapping chunks and publishes them. Chunks live in the versioned `policychunksv2` collection, and only chunks of the current published version are searchable.

- `KNOWLEDGE_SEARCH_MODE=lexical` uses a MongoDB text index and needs no credentials.
- `KNOWLEDGE_SEARCH_MODE=hybrid` combines text search with MongoDB Vector Search (Gemini embeddings, 768 dimensions) using reciprocal-rank fusion. It needs a vector-capable deployment such as Atlas and the index in [`knowledge/policy_chunks_vector.index.json`](knowledge/policy_chunks_vector.index.json).

## Evaluation

- **Agent fixtures:** 15 prompts run through the real graph with fake tools and no model calls. Each case checks routing, tool use, citations and that no write tool runs.
- **Retrieval benchmark:** 11 labeled queries over the bundled policy documents, scored with Recall@3 and MRR in an integration test.
- **Routing (live):** `pnpm eval:live` runs 24 labeled prompts against the real model.

## Operations

`GET /api/v1/health` is liveness. `GET /api/v1/health/ready` checks the database topology (and the vector index in hybrid mode). The API refuses to start on a standalone MongoDB.

Rate limits are held in process memory, so a multi-instance deployment would need a shared store and a Socket.IO adapter.
