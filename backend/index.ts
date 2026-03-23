import app from './src/app.js';
import { PORT } from './src/config/env.js';
import { connectNeo4j } from './src/config/neo4j.js';

// Initialize Neo4j connection
connectNeo4j();

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
