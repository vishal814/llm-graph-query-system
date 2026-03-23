import { ChatGroq } from "@langchain/groq";
import { GROQ_API_KEY } from './env.js';

let llmInstance: any = null;

try {
    if (GROQ_API_KEY) {
        llmInstance = new ChatGroq({
            apiKey: GROQ_API_KEY,
            model: "llama-3.3-70b-versatile",
            temperature: 0,
        });
    }
} catch (e) {
    console.warn("Groq API key not found or invalid. LLM disabled.");
}

export const llm = llmInstance;
