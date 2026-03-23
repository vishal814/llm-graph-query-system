# O2C Graph Intelligence — Full Project Guide

## Why We Built This

Modern ERP systems like SAP generate massive amounts of transactional data across Orders → Deliveries → Invoices → Payments. The problem: **the relationships between them are invisible** in traditional table-based views.

This project answers: *"Can we let a business analyst ask plain English questions and instantly see a visual graph of how data flows?"*

The value proposition:
- An analyst can type *"Find sales orders delivered but not billed"* and get an immediate answer + graph — no SQL, no pivot tables.
- Graph structure reveals **broken flows** and **anomalies** that spreadsheets hide.
- Every response is grounded in real data from the database (no hallucinations).

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  User (Browser)                                              │
│   → Types question in Chat Panel                             │
│   ↓                                                          │
│  Frontend (Next.js 14 + React Flow + d3-force)               │
│   → Sends POST /api/chat to Backend                          │
│   ↓                                                          │
│  Backend (Node.js + Express)                                 │
│   → Step 1: Guardrail check (is it on-topic?)                │
│   → Step 2: LLM generates Cypher query (Groq llama-3.3-70b)  │
│   → Step 3: Execute Cypher on Neo4j AuraDB                   │
│   → Step 4: LLM summarizes results in plain English          │
│   → Returns: { answer, cypher, graphData }                   │
│   ↓                                                          │
│  Frontend renders graph with d3-force physics layout         │
└──────────────────────────────────────────────────────────────┘
```

---

## File-by-File Codebase Walkthrough

### Backend

#### [backend/index.js](file:///d:/New%20folder/backend/index.js) — The API Brain
The main Express server. Contains 4 key functions:

| Function | What it does |
|---|---|
| [checkGuardrails()](file:///d:/New%20folder/backend/index.js#70-87) | Asks LLM "Is this supply-chain related? YES/NO" |
| [generateCypher()](file:///d:/New%20folder/backend/index.js#88-125) | Asks LLM to produce a Neo4j Cypher query from the user's question |
| [generateFinalAnswer()](file:///d:/New%20folder/backend/index.js#126-137) | Takes raw DB records + question → produces human-readable answer |
| `/api/expand` endpoint | Fetches all neighbors of a node (for double-click expansion) |

**Key design:** The Cypher generator has a hard-coded **safety interceptor** — if the LLM generates an expensive `shortestPath` for a broad "show everything" query, it's replaced with a safe `MATCH (n)-[r]->(m) LIMIT 100`.

#### [backend/ingest.ts](file:///d:/New%20folder/backend/ingest.ts) — The Data Pipeline
Reads [.jsonl](file:///d:/New%20folder/datasets/plants/part-20251119-133445-279.jsonl) files from `datasets/` and builds the Neo4j graph. Runs once to set up the database. Processes 13 entity types in order, creating nodes and then relationships between them.

#### [backend/.env](file:///d:/New%20folder/backend/.env)
```
NEO4J_URI=neo4j+s://...
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=...
GROQ_API_KEY=gsk_...
```

### Frontend

#### [frontend/src/app/page.tsx](file:///d:/New%20folder/frontend/src/app/page.tsx) — The Entire UI (Single File)
Three main sections:
1. **[parseGraphData()](file:///d:/New%20folder/frontend/src/app/page.tsx#81-140)** — Recursively walks the Neo4j JSON response extracting Node and Relationship objects, builds React Flow nodes/edges
2. **[applyForceLayout()](file:///d:/New%20folder/frontend/src/app/page.tsx#58-80)** — Runs d3-force physics simulation for 300 ticks to position nodes naturally
3. **[expandNode()](file:///d:/New%20folder/frontend/src/app/page.tsx#141-151)** — On double-click, fetches neighbors of a node and merges them into the existing graph

---

## Dataset Relationships (The Graph Model)

```
Customer
  └─[HAS_ADDRESS]──► Address
  └─[SOLD_TO]◄──── SalesOrder
                      └─[HAS_ITEM]──► SalesOrderItem
                                         └─[IS_MATERIAL]──► Material
                                                               └─[IS_PRODUCT]──► Product
                                                                                    └─[PRODUCED_AT]──► Plant

SalesOrderItem ◄──[DELIVERS_ITEM]── DeliveryItem ◄──[HAS_ITEM]── DeliveryDocument

DeliveryItem ◄──[BILLS_FOR_ITEM]── BillingItem ◄──[HAS_ITEM]── BillingDocument
                                                                     └─[BILLED_TO]──► Customer
                                                                     └─[PAYS_FOR]◄── Payment
                                                                     └─[ACCOUNTING_FOR]◄── JournalEntry
```

**The key chain (Order-to-Cash flow):**
```
SalesOrder → SalesOrderItem → DeliveryItem → BillingItem → BillingDocument → JournalEntry
```

---

## Test Prompts

### Basic queries
```
Give me all delivery documents for sales order 740556
Show billing documents for delivery 80738076
What journal entries account for billing document 91150175?
What is the total sales amount for customer 320000083?
```

### Required assessment queries
```
Which products are associated with the highest number of billing documents?
Trace the full flow of billing document 91150175
Find sales orders that were delivered but not billed
Show me the entire supply chain graph
```

### Advanced exploration
```
How many unique customers do we have?
Show me all payments for billing document 91150175
Which delivery documents have the most items?
Show all products manufactured at a specific plant
Which customers have the most sales orders?
Find billing documents created in April 2025
```

### Guardrail tests (should be rejected)
```
Write me a poem about graphs
What is the capital of France?
Who won the 2024 election?
Tell me a joke
```

---

## How to Write Your Own Custom Prompts

The system understands natural language that maps to its schema. Use this formula:

**`[action verb] + [entity] + [filter condition]`**

### Available Entity Names
- `Customer`, `SalesOrder`, `SalesOrderItem`
- `DeliveryDocument`, `DeliveryItem`
- `BillingDocument`, `BillingItem`
- `JournalEntry`, `Payment`
- `Product`, `Material`, `Plant`, `Address`

### Available Property Names per Entity
| Entity | Queryable Properties |
|---|---|
| Customer | id, name, group |
| SalesOrder | id, creationDate, totalNetAmount, currency |
| DeliveryDocument | id, creationDate, shippingPoint, status |
| BillingDocument | id, creationDate, totalNetAmount, currency |
| JournalEntry | id, amount, currency, postingDate |
| Product | id, name, productType, productGroup |

### Custom Prompt Template
```
"[Show / Find / List / Count / Trace] [entity/entities] 
 [where/for/with/that have] [condition]"
```

**Examples you can build:**
```
Show all deliveries for customer 320000083
Find all billing documents with amount greater than 10000
Which customers have both deliveries and payments?
List all products in product group 01
Count how many journal entries exist per billing document
Find sales orders where the delivery status is complete
```

---

## Suggested Improvements

### High Impact
1. **Vector/Semantic Search** — Embed product names and descriptions so users can search by *"show me charcoal grills"* instead of exact IDs
2. **Conversation Memory** — Use LangChain `ConversationBufferMemory` so users can do follow-up queries like *"now filter those to only show 2025"*
3. **Streaming Responses** — Use Server-Sent Events to stream the LLM answer token-by-token instead of waiting for the full response

### Medium Impact
4. **Node Coloring Legend** — Add a color key on the graph panel so users know what each color represents
5. **Graph Filtering** — Add checkboxes to show/hide entity types (e.g. hide JournalEntry to focus on Order→Delivery flow)
6. **Export** — Let users download the current graph as PNG or the data as CSV
7. **Query History** — Save previous queries in the chat so users can re-run them

### Architecture Improvements
8. **Web Workers for d3-force** — Move the physics simulation off the main thread to prevent UI freezes with large graphs
9. **Pagination** — When a query returns 100+ nodes, load them in batches with "Load More" buttons
10. **Graph Clustering** — Group related nodes visually (e.g. all items from one sales order collapse into one cluster)
