# SupportPilot AI

SupportPilot AI is a full-stack, AI-powered customer support platform for e-commerce businesses. It combines an intelligent AI support agent, order management, customer conversations, human escalation, returns and refunds, and a knowledge base into a unified system.

The platform uses **LangGraph, LangChain, and Google Gemini** to provide contextual customer support, retrieve relevant information, and automate support workflows while keeping sensitive actions under human control.

## Features

- **AI Customer Support:** Intelligent chatbot powered by LangGraph and Google Gemini.
- **RAG Knowledge Base:** Retrieves relevant business policies and documentation to generate grounded responses.
- **Order Management:** Customers can view orders, check order details, and request changes.
- **Returns and Refunds:** Structured return and refund workflows with confirmation and staff approval.
- **Human Handoff:** Escalates conversations to support representatives when required.
- **Real-Time Chat:** Live conversations and streaming AI responses using Socket.IO.
- **Role-Based Access:** Separate customer, support staff, and admin interfaces.
- **Admin Dashboard:** Manage conversations, knowledge documents, support operations, and approvals.
- **AI Guardrails:** Protects sensitive information and validates AI-generated responses.
- **Audit Logging:** Records important customer and staff actions.
- **Evaluation:** Includes agent testing, routing evaluations, and knowledge retrieval benchmarks.

## Tech Stack

**Frontend**
- React 19, TypeScript, Vite
- Tailwind CSS
- TanStack Query

**Backend**
- Node.js, Express.js, TypeScript
- MongoDB, Mongoose
- Socket.IO
- JWT Authentication

**AI Engineering**
- LangGraph
- LangChain
- Google Gemini
- Retrieval-Augmented Generation (RAG)
- AI Tool Calling and Workflow Routing

**Development Tools**
- pnpm Workspaces
- Docker
- Vitest
- Playwright

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- MongoDB 7+ configured as a replica set
- Google Gemini API key (optional)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Atif353/SupportPilot.git
cd SupportPilot
```

2. Install dependencies:

```bash
pnpm install
```

3. Configure environment variables:

Create a `.env` file using `.env.example` and configure your MongoDB connection, JWT secrets, and optional Gemini API key.

4. Start MongoDB and initialize demo data:

```bash
pnpm db:start
pnpm seed
pnpm ingest:knowledge
```

5. Start the application:

```bash
pnpm dev
```

**Frontend:** http://localhost:5173

**Backend:** http://localhost:4000

## Demo Accounts

All demo accounts use the password `demo-password`.

| Role | Email |
|---|---|
| Customer | customer01@novastore.demo |
| Customer | customer02@novastore.demo |
| Support | support@novastore.demo |
| Admin | admin@novastore.demo |

## Available Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start frontend and backend |
| `pnpm build` | Build the application |
| `pnpm test` | Run automated tests |
| `pnpm lint` | Run code quality checks |
| `pnpm typecheck` | Check TypeScript types |
| `pnpm e2e` | Run browser tests |
| `pnpm eval:live` | Evaluate live AI routing |

## Project Notes

- AI agents have read-only access to customer orders and knowledge data.
- Sensitive operations require explicit confirmation and are recorded in audit logs.
- Refunds are simulated; no real payment transactions are processed.
- The application supports evidence-based responses even without a Gemini API key.
- MongoDB transactions require a replica-set configuration.

## Author

**Atif Mubashar**

Full Stack Developer | MERN Stack | AI & Agentic AI Development

- [GitHub](https://github.com/Atif353)
- [LinkedIn](https://www.linkedin.com/in/atifmubashar-dev/)

## License

No license has been selected for this project.