import neo4j, { Driver } from 'neo4j-driver';
import { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } from './env.js';

let driverInstance: Driver | null = null;

if (NEO4J_URI && NEO4J_URI.trim().length > 0) {
    try {
        driverInstance = neo4j.driver(
            NEO4J_URI.trim(),
            neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
        );
    } catch (err) {
        console.error("Failed to initialize Neo4j driver with provided URI:", err);
    }
} else {
    console.warn("NEO4J_URI is not set in backend/.env. Neo4j features will be disabled.");
}

export const driver = driverInstance as Driver;

export async function connectNeo4j() {
    if (!driverInstance) {
        console.warn("Neo4j driver is not initialized. Please configure NEO4J_URI in backend/.env");
        return;
    }
    try {
        const info = await driverInstance.getServerInfo();
        console.log("Connected to Neo4j:", info.address);
    } catch (err) {
        console.warn("Could not connect to Neo4j. Check credentials in backend/.env.", err);
    }
}
