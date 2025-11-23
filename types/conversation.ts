// types/conversation.ts

export interface Conversation {
  id: string;
  platform: 'claude' | 'chatgpt' | 'gemini';
  title: string;
  preview?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  tags?: string[];
  isStarred?: boolean;
  isArchived?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  sequenceNumber: number;
}
