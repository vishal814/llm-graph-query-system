import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { llm } from "../config/llm.js";
import { schemaDescription } from "../config/prompts.js";
import { driver } from "../config/neo4j.js";
import { GROQ_API_KEY } from "../config/env.js";

function formatDbResultForLLM(neo4jData: any[]): string {
    if (!neo4jData || neo4jData.length === 0) {
        return "No matching records found in the database.";
    }

    // Check if results are simple scalar aggregations (e.g. [{ totalSales: 1000 }])
    const sample = neo4jData[0];
    const isScalarOrTable = Object.values(sample).every(val => 
        val === null || 
        typeof val !== 'object' || 
        (typeof val === 'object' && !('identity' in val || 'elementId' in val || 'labels' in val || 'type' in val || 'properties' in val))
    );

    if (isScalarOrTable) {
        return JSON.stringify(neo4jData.slice(0, 30), null, 2);
    }

    // Extract structured business graph summaries
    const nodeCounts: Record<string, number> = {};
    const edgeCounts: Record<string, number> = {};
    const sampleEntities: string[] = [];
    const relationshipsSummary: string[] = [];

    const seenNodes = new Set<string>();
    const seenEdges = new Set<string>();

    for (const record of neo4jData) {
        for (const [key, val] of Object.entries(record)) {
            if (!val || typeof val !== 'object') continue;

            // Handle Node
            if ('labels' in val && Array.isArray((val as any).labels)) {
                const label = (val as any).labels[0] || 'Node';
                nodeCounts[label] = (nodeCounts[label] || 0) + 1;
                const id = (val as any).properties?.id || (val as any).elementId;
                const nodeKey = `${label}:${id}`;
                if (!seenNodes.has(nodeKey) && sampleEntities.length < 25) {
                    seenNodes.add(nodeKey);
                    const props = Object.entries((val as any).properties || {})
                        .filter(([k]) => k !== 'id')
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ');
                    sampleEntities.push(`- ${label} (ID: ${id}${props ? `, ${props}` : ''})`);
                }
            }

            // Handle Relationship
            if ('type' in val && typeof (val as any).type === 'string') {
                const type = (val as any).type;
                edgeCounts[type] = (edgeCounts[type] || 0) + 1;
            }
        }

        // Handle Pair/Path pattern if n, r, m or direct nodes exist
        if (record.n && record.r && record.m) {
            const srcLabel = record.n.labels?.[0] || 'Node';
            const srcId = record.n.properties?.id || record.n.elementId;
            const relType = record.r.type || 'RELATED_TO';
            const dstLabel = record.m.labels?.[0] || 'Node';
            const dstId = record.m.properties?.id || record.m.elementId;
            const relKey = `${srcLabel}(${srcId})->${relType}->${dstLabel}(${dstId})`;
            if (!seenEdges.has(relKey) && relationshipsSummary.length < 20) {
                seenEdges.add(relKey);
                relationshipsSummary.push(`- ${srcLabel} #${srcId} -> [${relType}] -> ${dstLabel} #${dstId}`);
            }
        }
    }

    const summaryParts: string[] = [];
    summaryParts.push(`Total Graph Records: ${neo4jData.length}`);
    
    const nodeBreakdown = Object.entries(nodeCounts).map(([label, count]) => `${count} ${label}s`).join(', ');
    if (nodeBreakdown) summaryParts.push(`Node Types Found: ${nodeBreakdown}`);

    const edgeBreakdown = Object.entries(edgeCounts).map(([type, count]) => `${count} ${type}`).join(', ');
    if (edgeBreakdown) summaryParts.push(`Relationship Types: ${edgeBreakdown}`);

    if (relationshipsSummary.length > 0) {
        summaryParts.push(`\nKey Supply Chain Flows / Relationships:\n${relationshipsSummary.join('\n')}`);
    }

    if (sampleEntities.length > 0) {
        summaryParts.push(`\nSample Entities & Attributes:\n${sampleEntities.join('\n')}`);
    }

    return summaryParts.join('\n');
}

export class ChatService {
    public async checkGuardrails(userPrompt: string): Promise<boolean> {
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", "You are an authorization guardrail. The user will ask a question. Determine if the question is related to supply chain, sales, business orders, deliveries, billing, accounting, materials, products, or customers. Reply ONLY with 'YES' or 'NO'."],
            ["user", "{question}"]
        ]);
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        
        if (!GROQ_API_KEY) return true; 

        try {
            const result = await chain.invoke({ question: userPrompt });
            return result.trim().toUpperCase() === "YES";
        } catch(e) {
            console.warn("Guardrail LLM check failed (check API key), allowing request.", e);
            return true; 
        }
    }

    public async generateCypher(userPrompt: string): Promise<string> {
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", `You are a Cypher expert for Neo4j. Given the schema below, generate a valid, optimized Cypher query to answer the user's question.
Return ONLY the raw Cypher query text, without markdown code fences, without explanation.

Schema:
${schemaDescription}

Guidelines & Examples:
- "Show me the entire supply chain graph" / "Overview of the supply chain":
  MATCH (o:SalesOrder)-[r1:SOLD_TO]->(c:Customer), (o)-[r2:HAS_ITEM]->(si:SalesOrderItem)<-[r3:DELIVERS_ITEM]-(di:DeliveryItem)<-[r4:BILLS_FOR_ITEM]-(bi:BillingItem)<-[r5:HAS_ITEM]-(b:BillingDocument) RETURN o, r1, c, r2, si, r3, di, r4, bi, r5, b LIMIT 25

- "Trace the full flow of sales order 740556":
  MATCH (o:SalesOrder {{id: '740556'}})-[r1:HAS_ITEM]->(si:SalesOrderItem)<-[r2:DELIVERS_ITEM]-(di:DeliveryItem)<-[r3:BILLS_FOR_ITEM]-(bi:BillingItem)<-[r4:HAS_ITEM]-(b:BillingDocument) RETURN o, r1, si, r2, di, r3, bi, r4, b

- "Give me all delivery documents (or delivery items) for sales order 740556":
  MATCH (o:SalesOrder {{id: '740556'}})-[r1:HAS_ITEM]->(si:SalesOrderItem)<-[r2:DELIVERS_ITEM]-(di:DeliveryItem)<-[r3:HAS_ITEM]-(d:DeliveryDocument) RETURN o, r1, si, r2, di, r3, d

- "Give me all billing documents for sales order 740556":
  MATCH (o:SalesOrder {{id: '740556'}})-[r1:HAS_ITEM]->(si:SalesOrderItem)<-[r2:DELIVERS_ITEM]-(di:DeliveryItem)<-[r3:BILLS_FOR_ITEM]-(bi:BillingItem)<-[r4:HAS_ITEM]-(b:BillingDocument) RETURN o, r1, si, r2, di, r3, bi, r4, b

- "Show billing documents for delivery 80738076":
  MATCH (d:DeliveryDocument {{id: '80738076'}})-[r1:HAS_ITEM]->(di:DeliveryItem)<-[r2:BILLS_FOR_ITEM]-(bi:BillingItem)<-[r3:HAS_ITEM]-(b:BillingDocument) RETURN d, r1, di, r2, bi, r3, b

- "Which products have the most billing documents?":
  MATCH (p:Product)<-[:IS_PRODUCT]-(si:SalesOrderItem)<-[:DELIVERS_ITEM]-(:DeliveryItem)<-[:BILLS_FOR_ITEM]-(:BillingItem)<-[:HAS_ITEM]-(b:BillingDocument) RETURN p.id AS product, count(DISTINCT b) AS billingDocCount ORDER BY billingDocCount DESC LIMIT 10

- "Which customers have the most sales orders?":
  MATCH (c:Customer)<-[r:SOLD_TO]-(o:SalesOrder) RETURN c.id AS customerId, c.name AS customerName, count(o) AS orderCount ORDER BY orderCount DESC LIMIT 10

- "What is the total net amount of all sales orders?":
  MATCH (o:SalesOrder) RETURN sum(toFloat(o.totalNetAmount)) AS totalSalesAmount, count(o) AS totalOrders
`],
            ["user", "{question}"]
        ]);
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        
        if (!GROQ_API_KEY) return "MATCH (n) RETURN COUNT(n) LIMIT 1";

        const result = await chain.invoke({ question: userPrompt });
        return result.replace(/\`\`\`(cypher)?/gi, "").replace(/\`\`\`/gi, "").trim();
    }

    public async generateFinalAnswer(userPrompt: string, dbResult: string): Promise<string> {
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", `You are Dodge AI, an intelligent business analyst and graph data assistant specializing in Order-to-Cash enterprise supply chains.
Your job is to analyze the provided database query results and provide a clean, professional, executive-level natural language summary that directly answers the user's question.

CRITICAL INSTRUCTIONS:
1. Executive Clarity: Present key business insights, metrics, amounts, and operational flow clearly. Use neat Markdown bullet points or concise tables when helpful.
2. NO ASCII Art: DO NOT generate text diagrams or ASCII art (e.g. (A)--[REL]->(B)). The interactive UI already renders the 3D/2D visual graph directly on screen.
3. Natural Business Tone: NEVER mention internal technical mechanics such as "the result set was truncated", "raw JSON", "limit", or "query slicing". Speak naturally and authoritatively about the business data.
4. If results are empty, politely state that no matching supply chain records were found.`],
            ["user", "Question: {question}\n\nDatabase Results:\n{dbResult}"]
        ]);
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        
        if (!GROQ_API_KEY) return `Please set GROQ_API_KEY. Database summary: ${dbResult}`;

        return await chain.invoke({ question: userPrompt, dbResult });
    }

    public async executeCypherAndGenerateAnswer(message: string): Promise<{ answer: string, cypher?: string, graphData?: any[] }> {
        // Step 1: Guardrails
        const isAllowed = await this.checkGuardrails(message);
        if (!isAllowed) {
            return {
                answer: "I can only answer questions related to our business supply chain, orders, deliveries, billing, and accounting."
            };
        }

        // Step 2: Translate to Cypher
        let cypherQuery = await this.generateCypher(message);

        // Safety interceptor for broad discovery queries
        const broadKeywords = ["all", "everything", "entire", "whole", "show me the graph", "list all"];
        if (broadKeywords.some(k => message.toLowerCase().includes(k)) && cypherQuery.toLowerCase().includes("shortestpath")) {
            console.log("Interceptor: Overriding expensive shortestPath query for broad discovery.");
            cypherQuery = "MATCH (o:SalesOrder)-[r1:SOLD_TO]->(c:Customer), (o)-[r2:HAS_ITEM]->(si:SalesOrderItem)<-[r3:DELIVERS_ITEM]-(di:DeliveryItem)<-[r4:BILLS_FOR_ITEM]-(bi:BillingItem)<-[r5:HAS_ITEM]-(b:BillingDocument) RETURN o, r1, c, r2, si, r3, di, r4, bi, r5, b LIMIT 25";
        }

        console.log("Generated Cypher:", cypherQuery);

        // Step 3: Execute Cypher
        let dbResultStr = "";
        let neo4jData: any[] = [];
        if (!driver) {
            dbResultStr = "Neo4j database is not connected. Please verify NEO4J_URI in backend/.env.";
        } else {
            const session = driver.session();
            try {
                const result = await session.run(cypherQuery);
                neo4jData = result.records.map(r => r.toObject());
                dbResultStr = formatDbResultForLLM(neo4jData);
            } catch (dbErr) {
                console.error("Cypher execution error:", dbErr);
                dbResultStr = "Error executing query against database.";
            } finally {
                await session.close();
            }
        }

        // Step 4: Final NL Generation
        const answer = await this.generateFinalAnswer(message, dbResultStr);

        return { answer, cypher: cypherQuery, graphData: neo4jData };
    }

    public async searchNodes(query: string): Promise<any[]> {
        if (!driver) return [];
        const session = driver.session();
        try {
            const result = await session.run(`
                MATCH (n)
                WHERE toLower(toString(n.id)) CONTAINS toLower($q)
                   OR toLower(toString(n.name)) CONTAINS toLower($q)
                   OR toLower(toString(n.status)) CONTAINS toLower($q)
                RETURN n
                LIMIT 15
            `, { q: query.trim() });
            
            return result.records.map(r => {
                const node = r.get('n');
                return {
                    elementId: node.elementId,
                    label: node.labels[0],
                    properties: node.properties,
                    display: node.properties.id || node.properties.name || node.labels[0]
                };
            });
        } finally {
            await session.close();
        }
    }

    public async expandNode(nodeId: string): Promise<any[]> {
        if (!driver) return [];
        const session = driver.session();
        try {
            const result = await session.run(`
                MATCH (n)-[r]-(m) 
                WHERE elementId(n) = $id
                RETURN n, r, m
                LIMIT 50
            `, { id: nodeId });
            return result.records.map(r => r.toObject());
        } finally {
            await session.close();
        }
    }
}
