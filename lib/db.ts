// lib/db.ts - Day 7: With message storage

import type { Conversation } from '@/types/conversation';
import type { Message } from '@/types/message';

class CortexDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'cortex-db';
  private readonly DB_VERSION = 2; // Bumped for messages store
  private readonly CONVERSATIONS_STORE = 'conversations';
  private readonly MESSAGES_STORE = 'messages';

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Conversations store
        if (!db.objectStoreNames.contains(this.CONVERSATIONS_STORE)) {
          const convStore = db.createObjectStore(this.CONVERSATIONS_STORE, { keyPath: 'id' });
          convStore.createIndex('platform', 'platform', { unique: false });
          convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          convStore.createIndex('isStarred', 'isStarred', { unique: false });
          convStore.createIndex('isArchived', 'isArchived', { unique: false });
        }

        // Messages store (NEW)
        if (!db.objectStoreNames.contains(this.MESSAGES_STORE)) {
          const msgStore = db.createObjectStore(this.MESSAGES_STORE, { keyPath: 'id' });
          msgStore.createIndex('conversationId', 'conversationId', { unique: false });
          msgStore.createIndex('role', 'role', { unique: false });
          msgStore.createIndex('index', 'index', { unique: false });
        }
      };
    });
  }

  // ==================== CONVERSATIONS ====================

  async saveConversations(conversations: Conversation[]): Promise<void> {
    if (!this.db) await this.init();

    const existing = await this.getAllConversations();
    const existingMap = new Map(existing.map(c => [c.id, c]));

    const transaction = this.db!.transaction([this.CONVERSATIONS_STORE], 'readwrite');
    const store = transaction.objectStore(this.CONVERSATIONS_STORE);

    for (const conversation of conversations) {
      const existingConv = existingMap.get(conversation.id);
      
      if (existingConv) {
        conversation.isStarred = existingConv.isStarred;
        conversation.isArchived = existingConv.isArchived;
      }
      
      store.put(conversation);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllConversations(): Promise<Conversation[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.CONVERSATIONS_STORE], 'readonly');
      const store = transaction.objectStore(this.CONVERSATIONS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.CONVERSATIONS_STORE], 'readonly');
      const store = transaction.objectStore(this.CONVERSATIONS_STORE);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteConversation(id: string): Promise<void> {
    if (!this.db) await this.init();

    // Delete conversation and its messages
    const transaction = this.db!.transaction([this.CONVERSATIONS_STORE, this.MESSAGES_STORE], 'readwrite');
    
    // Delete conversation
    transaction.objectStore(this.CONVERSATIONS_STORE).delete(id);
    
    // Delete all messages for this conversation
    const msgStore = transaction.objectStore(this.MESSAGES_STORE);
    const msgIndex = msgStore.index('conversationId');
    const msgRequest = msgIndex.openCursor(IDBKeyRange.only(id));
    
    msgRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction([this.CONVERSATIONS_STORE, this.MESSAGES_STORE], 'readwrite');
    transaction.objectStore(this.CONVERSATIONS_STORE).clear();
    transaction.objectStore(this.MESSAGES_STORE).clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ==================== MESSAGES ====================

  async saveMessages(messages: Message[]): Promise<void> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction([this.MESSAGES_STORE], 'readwrite');
    const store = transaction.objectStore(this.MESSAGES_STORE);

    for (const message of messages) {
      store.put(message);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getMessagesForConversation(conversationId: string): Promise<Message[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(this.MESSAGES_STORE);
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        // Sort by index
        const messages = request.result.sort((a, b) => a.index - b.index);
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async hasMessagesForConversation(conversationId: string): Promise<boolean> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(this.MESSAGES_STORE);
      const index = store.index('conversationId');
      const request = index.count(conversationId);

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMessagesForConversation(conversationId: string): Promise<void> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction([this.MESSAGES_STORE], 'readwrite');
    const store = transaction.objectStore(this.MESSAGES_STORE);
    const index = store.index('conversationId');
    const request = index.openCursor(IDBKeyRange.only(conversationId));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getMessageCount(conversationId: string): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(this.MESSAGES_STORE);
      const index = store.index('conversationId');
      const request = index.count(conversationId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new CortexDB();
