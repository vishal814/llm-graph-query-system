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
}
