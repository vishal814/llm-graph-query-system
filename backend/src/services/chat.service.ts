import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { llm } from "../config/llm.js";
import { schemaDescription } from "../config/prompts.js";
import { driver } from "../config/neo4j.js";
import { GROQ_API_KEY } from "../config/env.js";

export class ChatService {
    public async checkGuardrails(userPrompt: string): Promise<boolean> {
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", "You are an authorization guardrail. The user will ask a question. Determine if the question is related to supply chain, sales, business orders, deliveries, billing, accounting, or customers. Reply ONLY with 'YES' or 'NO'."],
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
            ["system", `You are a Cypher expert. Given the Neo4j schema below, generate a valid Cypher query to answer the user's question. 
Return ONLY the raw Cypher query text, without markdown blocks, without explanation. Use generic matches and correct relationship directions.
CRITICAL: NEVER use 'shortestPath' or 'UNION' for broad 'show' or 'list' questions. These are too slow. Instead, use a simple MATCH (n)-[r]->(m) pattern with a LIMIT.
Schema:\n${schemaDescription}\n
Examples:
User: "Show me the entire supply chain graph"
Cypher: MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100

User: "What is the total sales amount for customer 320000083?"
Cypher: MATCH (c:Customer {{id: '320000083'}})<-[r:SOLD_TO]-(o:SalesOrder) RETURN sum(toInteger(o.totalNetAmount)) AS totalSales

User: "Give me all delivery documents (or delivery items) for sales order 740556"
Cypher: MATCH (o:SalesOrder {{id: '740556'}})-[r1:HAS_ITEM]->(si:SalesOrderItem)<-[r2:DELIVERS_ITEM]-(di:DeliveryItem) RETURN o, r1, si, r2, di

User: "Show billing documents for delivery 80738076"
Cypher: MATCH (d:DeliveryDocument {{id: '80738076'}})-[r1:HAS_ITEM]->(di:DeliveryItem)<-[r2:BILLS_FOR_ITEM]-(bi:BillingItem)<-[r3:HAS_ITEM]-(b:BillingDocument) RETURN d, r1, di, r2, bi, r3, b

User: "Show me the entire supply chain graph"
Cypher: MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100
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
            ["system", "You are a helpful business data assistant. Use the provided database query results to answer the user's question in natural language briefly and accurately. If the results are empty, say so."],
            ["user", "Question: {question}\n\nDatabase Results:\n{dbResult}"]
        ]);
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        
        if (!GROQ_API_KEY) return `Please set GROQ_API_KEY. Simulated DB result: ${dbResult}`;

        return await chain.invoke({ question: userPrompt, dbResult });
    }

    public async executeCypherAndGenerateAnswer(message: string): Promise<{ answer: string, cypher?: string, graphData?: any[] }> {
        // Step 1: Guardrails
        const isAllowed = await this.checkGuardrails(message);
        if (!isAllowed) {
            return {
                answer: "I can only answer questions related to our business supply chain, orders, deliveries, and billing."
            };
        }

        // Step 2: Translate to Cypher
        let cypherQuery = await this.generateCypher(message);

        // Safety interceptor for broad discovery queries
        const broadKeywords = ["all", "everything", "entire", "whole", "show me the graph", "list all"];
        if (broadKeywords.some(k => message.toLowerCase().includes(k)) && cypherQuery.toLowerCase().includes("shortestpath")) {
            console.log("Interceptor: Overriding expensive shortestPath query for broad discovery.");
            cypherQuery = "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100";
        }

        console.log("Generated Cypher:", cypherQuery);

        // Step 3: Execute Cypher
        const session = driver.session();
        let dbResultStr = "";
        let neo4jData: any[] = [];
        try {
            const result = await session.run(cypherQuery);
            neo4jData = result.records.map(r => r.toObject());
            dbResultStr = JSON.stringify(neo4jData, null, 2);
            // truncate DB result if too huge to feed to LLM
            if (dbResultStr.length > 3000) dbResultStr = dbResultStr.substring(0, 3000) + "...[TRUNCATED]";
        } catch (dbErr) {
            console.error("Cypher execution error:", dbErr);
            dbResultStr = "Error executing query against database.";
        } finally {
            await session.close();
        }

        // Step 4: Final NL Generation
        const answer = await this.generateFinalAnswer(message, dbResultStr);

        return { answer, cypher: cypherQuery, graphData: neo4jData };
    }
}
