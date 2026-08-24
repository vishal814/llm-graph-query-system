import { ChatGroq } from "@langchain/groq";
import { GROQ_API_KEY, GROQ_MODEL } from './env.js';

let llmInstance: any = null;

try {
    if (GROQ_API_KEY) {
        llmInstance = new ChatGroq({
            apiKey: GROQ_API_KEY,
            model: GROQ_MODEL,
            temperature: 0,
        });
    }
} catch (e) {
    console.warn("Groq API key not found or invalid. LLM disabled.");
}

export const llm = llmInstance;
