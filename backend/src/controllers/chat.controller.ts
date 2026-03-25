import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service.js';

const chatService = new ChatService();

export class ChatController {
    public async handleChat(req: Request, res: Response) {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        try {
            const result = await chatService.executeCypherAndGenerateAnswer(message);
            res.json(result);
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message || "Internal server error" });
        }
    }

    public async handleSearch(req: Request, res: Response) {
        const q = req.query.q as string;
        if (!q) {
            return res.status(400).json({ error: "Query is required" });
        }
        try {
            const results = await chatService.searchNodes(q);
            res.json({ results });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message || "Internal server error" });
        }
    }

    public async handleExpand(req: Request, res: Response) {
        const { nodeId } = req.body;
        if (!nodeId) {
            return res.status(400).json({ error: "Node ID is required" });
        }
        try {
            const graphData = await chatService.expandNode(nodeId);
            res.json({ graphData });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message || "Internal server error" });
        }
    }
}
