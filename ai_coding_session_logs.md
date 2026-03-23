# AI Coding Session Log

*This document summarizes the key developmental milestones and architectural decisions made during the AI-assisted build of the O2C Graph Intelligence Platform.*

---

## 📅 Session 1: Foundation & Data Modeling
**Goal:** Establish the core stack and translate raw relational JSONL data into an interconnected graph.
*   **Action:** Initialized a Node.js/Express backend and a Next.js (React) frontend.
*   **Action:** Provisioned a Neo4j AuraDB instance. 
*   **Action:** Developed `backend/ingest.ts` to parse heavily nested and fragmented Order-to-Cash (O2C) datasets.
*   **Decision:** Mapped 13 distinct business entities to Nodes (e.g., `SalesOrder`, `BillingItem`, `Plant`) and 11 relational actions to Edges (e.g., `SOLD_TO`, `DELIVERS_ITEM`, `ACCOUNTING_FOR`).

## 📅 Session 2: Natural Language Engine & Visualization
**Goal:** Allow users to talk to their data and see the results dynamically.
*   **Action:** Integrated **LangChain.js** and **Groq (Llama-3.3-70b)** for high-speed, accurate prompt translation.
*   **Action:** Engineered a schema-grounded prompt template using few-shot Cypher examples tailored to the O2C domain.
*   **Action:** Built the frontend visualization using **React Flow** and **d3-force** to map queried JSON nodes into interactive visual subgraphs without freezing the browser.

## 📅 Session 3: Security & Guardrails
**Goal:** Prevent prompt injection, off-topic requests, and database overloads.
*   **Action:** Implemented a **Layer 1 LLM Classifier** to silently reject non-supply-chain questions.
*   **Action:** Added hardcoded blocklists to reject expensive Cypher commands like `shortestPath` and `UNION`.
*   **Action:** Configured runtime interceptors to automatically cap return sizes (`LIMIT 100`) for broad queries.

## 📅 Session 4: UX Upgrades (Memory, Streaming, & Polish)
**Goal:** Implement the top user-requested improvements for a natural, chat-like experience.
*   **Action (Streaming Responses):** Migrated the backend to Server-Sent Events (SSE). The frontend now streams tokens live via a blinking cursor instead of waiting 5+ seconds for bulk responses.
*   **Action (Conversation Memory):** Restructured the LLM chains to ingest the trailing 5 conversation turns. Users can now ask follow-up questions (e.g., "Trace order 123", followed by "Now show me its delivery document").
*   **Action (Graph Upgrades):** 
    *   Added a persistent Color Legend for node identification.
    *   Implemented node-type filtering (click to hide specific entities).
    *   Added `d3-force` clustering to group similar node types together spatially.

## 📅 Session 5: Semantic Entity Search & Data Linking Fixes
**Goal:** Fix missing graph paths and allow direct entity discovery.
*   **Action:** Discovered that strict `MATCH` clauses during ingestion caused missing `PRODUCED_AT` relationships if nodes arrived out of order. Rewrote `ingest.ts` to use upserting (`MERGE`), correctly linking 3,000+ Products to Plants.
*   **Action:** Discovered and added missing `SHIPPED_FROM` delivery paths.
*   **Action:** Built a global Semantic Search bar (`/api/search`) using `CONTAINS` matching to auto-suggest node IDs/Names. Clicking a result instantly pings the node with a glowing CSS highlight on the React Flow canvas.
