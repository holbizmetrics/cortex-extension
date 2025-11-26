// lib/message-scraper.ts

import type { Message } from '@/types/message';

class MessageScraper {
  /**
   * Scrape all messages from the current conversation page
   * Call this when viewing a specific conversation
   */
  async scrapeCurrentConversation(): Promise<Message[]> {
    const messages: Message[] = [];
    
    // Get conversation ID from URL
    const conversationId = this.getConversationIdFromUrl();
    if (!conversationId) {
      console.warn('MessageScraper: No conversation ID found in URL');
      return messages;
    }

    // Find all message containers
    const messageContainers = this.findMessageContainers();
    
    messageContainers.forEach((container, index) => {
      const message = this.parseMessageContainer(container, conversationId, index);
      if (message) {
        messages.push(message);
      }
    });

    console.log(`MessageScraper: Scraped ${messages.length} messages`);
    return messages;
  }

  /**
   * Get conversation ID from current URL
   */
  getConversationIdFromUrl(): string | null {
    const url = window.location.href;
    
    // Claude URL pattern: https://claude.ai/chat/{uuid}
    const claudeMatch = url.match(/claude\.ai\/chat\/([a-f0-9-]+)/i);
    if (claudeMatch) {
      return claudeMatch[1];
    }

    return null;
  }

  /**
   * Find all message container elements in the DOM
   */
  private findMessageContainers(): Element[] {
    // Claude uses different selectors for messages
    // Try multiple strategies
    
    const selectors = [
      // Claude's message containers (2024 layout)
      '[data-testid="conversation-turn"]',
      'div[class*="ConversationTurn"]',
      'div[class*="message-"]',
      // Fallback: look for user/assistant message patterns
      'div[data-is-streaming]',
      // Alternative: prose content containers
      'div.prose',
      // Generic message-like containers
      'article',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`MessageScraper: Found ${elements.length} containers with selector: ${selector}`);
        return Array.from(elements);
      }
    }

    // Last resort: try to find by structure
    // Claude typically has alternating human/assistant messages
    const mainContent = document.querySelector('main') || document.body;
    const potentialMessages = mainContent.querySelectorAll('div[class*="group"]');
    
    if (potentialMessages.length > 0) {
      console.log(`MessageScraper: Found ${potentialMessages.length} potential message groups`);
      return Array.from(potentialMessages);
    }

    console.warn('MessageScraper: Could not find message containers');
    return [];
  }

  /**
   * Parse a single message container into a Message object
   */
  private parseMessageContainer(container: Element, conversationId: string, index: number): Message | null {
    try {
      const role = this.detectRole(container);
      const content = this.extractContent(container);
      
      if (!content || content.trim().length === 0) {
        return null;
      }

      return {
        id: `${conversationId}-${index}`,
        conversationId,
        role,
        content: content.trim(),
        timestamp: new Date().toISOString(), // Claude doesn't show timestamps per message
        index,
      };
    } catch (error) {
      console.error('MessageScraper: Error parsing message container', error);
      return null;
    }
  }

  /**
   * Detect if message is from user or assistant
   */
  private detectRole(container: Element): 'user' | 'assistant' {
    const html = container.outerHTML.toLowerCase();
    const text = container.textContent?.toLowerCase() || '';

    // Check for explicit role indicators
    if (
      html.includes('human') ||
      html.includes('user') ||
      container.querySelector('[data-role="user"]') ||
      container.classList.contains('human-message')
    ) {
      return 'user';
    }

    if (
      html.includes('assistant') ||
      html.includes('claude') ||
      html.includes('ai-message') ||
      container.querySelector('[data-role="assistant"]')
    ) {
      return 'assistant';
    }

    // Check for Claude's avatar or branding
    if (container.querySelector('img[alt*="Claude"]') || container.querySelector('img[alt*="AI"]')) {
      return 'assistant';
    }

    // Check for user avatar patterns
    if (container.querySelector('img[alt*="User"]') || container.querySelector('img[alt*="You"]')) {
      return 'user';
    }

    // Fallback: alternate based on index (user typically starts)
    // This is a weak heuristic but better than nothing
    return 'user';
  }

  /**
   * Extract text content from a message container
   */
  private extractContent(container: Element): string {
    // Look for the actual content area, excluding buttons/metadata
    const contentSelectors = [
      '.prose',
      '[class*="message-content"]',
      '[class*="MessageContent"]',
      'div[dir="auto"]',
      'p',
    ];

    for (const selector of contentSelectors) {
      const contentEl = container.querySelector(selector);
      if (contentEl && contentEl.textContent) {
        return this.cleanContent(contentEl);
      }
    }

    // Fallback: get all text but try to exclude UI elements
    const clone = container.cloneNode(true) as Element;
    
    // Remove buttons, icons, metadata
    clone.querySelectorAll('button, svg, [role="button"], [class*="icon"]').forEach(el => el.remove());
    
    return this.cleanContent(clone);
  }

  /**
   * Clean extracted content
   */
  private cleanContent(element: Element): string {
    let text = element.textContent || '';
    
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Remove common UI text that might be captured
    const uiPatterns = [
      /^Copy$/i,
      /^Edit$/i,
      /^Retry$/i,
      /^\d+\s*\/\s*\d+$/,  // Pagination like "1 / 3"
    ];
    
    for (const pattern of uiPatterns) {
      text = text.replace(pattern, '');
    }
    
    return text.trim();
  }

  /**
   * Check if we're currently on a conversation page
   */
  isOnConversationPage(): boolean {
    const url = window.location.href;
    return url.includes('claude.ai/chat/') && !url.endsWith('/chat/') && !url.endsWith('/chat');
  }

  /**
   * Wait for messages to load (useful after navigation)
   */
  async waitForMessages(timeout = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const containers = this.findMessageContainers();
      if (containers.length > 0) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return false;
  }
}

export const messageScraper = new MessageScraper();
