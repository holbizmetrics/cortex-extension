// types/message.ts

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  index: number; // Order in conversation
}

export interface ConversationWithMessages {
  id: string;
  title: string;
  platform: 'claude' | 'chatgpt' | 'gemini';
  messages: Message[];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  preview: string;
  tags: string[];
  isStarred: boolean;
  isArchived: boolean;
}
