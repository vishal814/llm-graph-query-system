import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller.js';

const router = Router();
const chatController = new ChatController();

router.post('/chat', chatController.handleChat.bind(chatController));

export default router;
