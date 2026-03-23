# Raw AI Interaction Transcripts

*This document catalogs the exact conversational exchanges between the Engineer and the AI Assistant across the development lifecycle of the O2C Graph Intelligence Platform.*

---

## Detailed Prompt Examples

### Prompt A — Project Initialization & Architecture Selection

**User:**
Design an architecture for an Order-to-Cash (O2C) knowledge graph application. I need to query this graph using natural language. I have heavily nested JSONL files containing Sales Orders, Deliveries, Billing, and Plant Master data. 
What stack should we use to accomplish sub-second streaming answers over this data?

**AI:**
Given the complexity and highly relational nature of the O2C pipeline (e.g., an accounting entry traces back through Billing → Delivery → Sales Order → Customer/Plant), we must use a Graph Database. Relational SQL would require extremely slow, multi-table JOINs.

**Proposed Stack:**
1. **Database:** Neo4j AuraDB. Its Cypher language handles deep path traversals in O(hops) time.
2. **LLM Orchestration:** LangChain.js integrated with Groq's Llama-3.3-70b. Groq guarantees the ultra-low latency required for real-time streaming tokens.
3. **Backend API:** Node.js (Express), acting securely between the client and LLM/DB.
4. **Frontend:** React + Next.js with React Flow for dynamic force-directed node visualization.

---

### Prompt B — Data Ingestion Strategy

**User:**
The delivery item JSON has a `plant` field (e.g., "WB05"), but the product master data also assigns plants implicitly. Write a robust Neo4j data ingestion script in Node/Typescript that handles missing nodes arriving out of order. Ensure a DeliveryItem correctly points to a Plant via `SHIPPED_FROM`.

**AI:**
When dealing with massive asynchronous or unordered data loads (like separated JSONL dumps), we must use Cypher's `MERGE` clause instead of `MATCH` for the endpoint nodes. If we `MATCH` and the Plant doesn't exist yet, the relationship is silently dropped. 

Here is the updated ingestion chunk for Outbound Deliveries:
```typescript
await ingestDirectory('outbound_delivery_items', async (data, session) => {
    const itemId = `${data.deliveryDocument}-${parseInt(data.deliveryDocumentItem, 10)}`;
    
    // Upsert the delivery item
    await session.run(`
        MERGE (di:DeliveryItem {id: $itemId})
        SET di.actualDeliveryQuantity = $qty
        MERGE (d:DeliveryDocument {id: $deliveryId})
        MERGE (d)-[:HAS_ITEM]->(di)
    `, { itemId, qty: parseFloat(data.actualDeliveryQuantity) });

    // Link DeliveryItem to the Plant using MERGE to avoid sequence race conditions
    if (data.plant) {
        await session.run(`
            MERGE (di:DeliveryItem {id: $itemId})
            MERGE (pl:Plant {id: $plantId})
            MERGE (di)-[:SHIPPED_FROM]->(pl)
        `, { itemId, plantId: data.plant });
    }
});
```

---

### Prompt C — Few-Shot Cypher Generation 

**User:**
Generate a Langchain ChatPromptTemplate system prompt that converts user questions into raw Neo4j Cypher. The model keeps adding Markdown blocks and tries to use the `shortestPath` function which is too expensive. Ban that function and add a few-shot example for tracking the highest number of billing documents.

**AI:**
Here is the strict LangChain prompt configuration enforcing those rules. I injected a `CRITICAL RULES` block and added the requested Product/Billing traversal example:

```javascript
const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a Cypher expert. Given the Neo4j schema below, generate a valid query.
Return ONLY the raw Cypher query text, without markdown blocks, without explanation.
CRITICAL RULES:
1. NEVER use 'shortestPath' or 'UNION' for broad discovery. Use simple MATCH with LIMIT.
2. ALWAYS return ALL nodes AND relationships in the path so the frontend can draw edges.

Schema:
{schemaDescription}

Examples:
User: "Which products are associated with the highest number of billing documents?"
Cypher: MATCH (bi:BillingItem)-[:BILLS_FOR_ITEM]->(di:DeliveryItem)-[:DELIVERS_ITEM]->(si:SalesOrderItem)-[:IS_MATERIAL]->(m:Material)-[:IS_PRODUCT]->(p:Product) 
RETURN p.id AS product, p.name AS productName, count(DISTINCT bi) AS billingCount ORDER BY billingCount DESC LIMIT 10
`]
]);
```

---

### Prompt D — Streaming Responses and HTTP Headers

**User:**
I am building a Server-Sent Events (SSE) `/api/chat/stream` route to stream tokens back to my React frontend. However, the browser's `fetch()` is immediately failing with cross-origin CORS errors before the stream starts. How do I fix the preflight and HTTP headers?

**AI:**
Browsers mandate an `OPTIONS` preflight request for custom SSE streams, and the Express response must explicitly flush the headers before entering the asynchronous LLM block.

Here is the precise Node.js fix:
```javascript
// 1. Explicit HTTPS Preflight route
app.options('/api/chat/stream', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(204);
});

app.post('/api/chat/stream', async (req, res) => {
    // 2. Set SSE Headers immediately 
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 3. Flush to establish the 200 OK connection before async work
    res.flushHeaders(); 

    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    
    // ... [LLM Streaming Logic] ...
});
```

---

### Prompt E — Guardrails and Overloading Prevention

**User:**
If a user just types "Show me the entire supply chain graph", the frontend attempts to map 90,000 nodes and crashes the browser tab. Implement a runtime interceptor in JavaScript that catches broad queries and forces a strict limit.

**AI:**
We can intercept the LLM's generated Cypher query before it hits the Neo4j driver using JavaScript string evaluation. If they ask for "everything" and the LLM produces an expansive match, we aggressively substitute it with a capped query.

```javascript
let cypherQuery = await generateCypher(message, history);

// Runtime Interceptor for broad queries
const broadTriggers = ["all", "everything", "entire"];
const isBroad = broadTriggers.some(k => message.toLowerCase().includes(k));

if (isBroad && cypherQuery.toLowerCase().includes('match (n)')) {
    console.warn("Intercepted expensive query. Forcing strict limit.");
    cypherQuery = 'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100';
}
```
