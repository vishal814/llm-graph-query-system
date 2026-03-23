import neo4j from 'neo4j-driver';
import { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } from './env.js';

export const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD));

export async function connectNeo4j() {
    try {
        const info = await driver.getServerInfo();
        console.log("Connected to Neo4j:", info.address);
    } catch (err) {
        console.warn("Could not connect to Neo4j. Check credentials.", err);
    }
}
