# Context Graph System - Implementation Plan

## Goal
Build a context graph system with an LLM-powered query interface. It will parse raw business data (orders, deliveries, invoices, etc.) into a graph, visualize it, and allow users to query it using natural language.

## User Review Required
> [!IMPORTANT]
> Please review the chosen tech stack:
> 1.  **Database**: **Neo4j** (Graph Database). Standard graph databases like Neo4j are highly recommended here as LLMs can seamlessly translate natural language to its native Cypher query language.
> 2.  **Backend**: **Python (FastAPI) + LangChain**. Python provides native LLM tooling, and LangChain has a built-in `GraphCypherQAChain` to auto-translate and run graph queries using LLM APIs like Gemini or Groq.
> 3.  **Frontend**: **React/Next.js** + **React Flow** (for graph visualization) + **TailwindCSS** (for UI styling).
> 
> **Action Required**: Could you please download the dataset using the Google Drive link from the PDF (ID: `1UqaLbFaveV-3MEuiUrzKydhKmkeC1iAL`) and place it in our project folder (`d:\New folder\`)? I need to inspect the data columns before I can write the full DB ingestion script.

## Proposed Changes
### Project Structure
- `backend/`: FastAPI application, Neo4j connection, and LLM orchestration logic.
- `frontend/`: Next.js application with Tailwind CSS and React Flow for visualizing data.
- `data/`: The directory containing the extracted CSV/JSON dataset.

### Phase 1: Data Ingestion
- Analyze the columns and structure of the provided dataset.
- Create an ingestion script (`ingest.py`) to map rows to Nodes (Sales Orders, Invoices, Deliveries, Customers) and Edges (Ordered_By, Delivered_To, Billed_To) in the Neo4j database.

### Phase 2: Backend API
- `GET /api/graph`: Returns sample nodes and relationships to render the visual graph.
- `POST /api/chat`: Takes a user's natural language query, validates it against guardrails, generates a Cypher query using an LLM, executes it against Neo4j, and returns the natural language response.

### Phase 3: Frontend UI
- Build a split-screen interface:
  - **Left pane**: Interactive Graph canvas showing entity relations.
  - **Right pane**: A conversational UI for asking data questions.

## Verification Plan
### Automated Tests
- Test ingestion scripts locally against the raw data.
- Validate LLM queries against a benchmark set of business questions.
### Manual Verification
- Test adversarial / out-of-domain queries to verify guardrails work correctly.
- Ensure the frontend renders the graph smoothly and is interactive.
