import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 4000;
export const NEO4J_URI = process.env.NEO4J_URI || '';
export const NEO4J_USERNAME = process.env.NEO4J_USERNAME || '';
export const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';
export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
