// lib/scraper.ts

import type { Conversation } from '@/types/conversation';

export class ClaudeScraper {
  /**
   * Scrape conversation list from Claude.ai sidebar
   */
  async scrapeConversationList(): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    await this.waitForElement('[data-testid="conversation-list"]', 5000)
      .catch(() => console.log('Conversation list not found, trying alternative selectors'));

    const conversationElements = this.findConversationElements();

    for (let i = 0; i < conversationElements.length; i++) {
      try {
        const conversation = await this.parseConversationElement(conversationElements[i], i);
        if (conversation) {
          conversations.push(conversation);
        }
      } catch (error) {
        console.error('Failed to parse conversation element:', error);
      }
    }

    console.log(`🧠 Cortex: Scraped ${conversations.length} conversations`);
    return conversations;
  }

  private findConversationElements(): Element[] {
    let elements = Array.from(document.querySelectorAll('[data-testid*="conversation"]'));
    
    if (elements.length === 0) {
      const sidebar = document.querySelector('nav, aside, [class*="sidebar"]');
      if (sidebar) {
        elements = Array.from(sidebar.querySelectorAll('a[href*="/chat/"]'));
      }
    }

    if (elements.length === 0) {
      elements = Array.from(document.querySelectorAll('a[href*="conversation"]'));
    }

    return elements;
  }

  private async parseConversationElement(element: Element, fallbackIndex: number): Promise<Conversation | null> {
    const href = element.getAttribute('href');
    const id = this.extractConversationId(href) || `conv-${Date.now()}-${fallbackIndex}`;

    // Extract title
    const titleElement = element.querySelector('[class*="title"], h3, h4, strong');
    const title = titleElement?.textContent?.trim() || 
                  element.textContent?.trim().substring(0, 50) || 
                  'Untitled Conversation';

    // Extract timestamp
    const timeElement = element.querySelector('time, [class*="time"], [class*="date"]');
    const timestamp = timeElement?.getAttribute('datetime') || 
                     timeElement?.textContent || 
                     new Date().toISOString();

    // Extract preview text - try multiple strategies
    let preview = '';
    
    // Strategy 1: Look for preview/subtitle element
    const previewElement = element.querySelector('[class*="preview"], [class*="subtitle"], p');
    if (previewElement) {
      preview = previewElement.textContent?.trim().substring(0, 100) || '';
    }
    
    // Strategy 2: If no preview, try to get from message content
    if (!preview) {
      const messageElements = element.querySelectorAll('[class*="message"], [class*="content"]');
      if (messageElements.length > 0) {
        preview = messageElements[0].textContent?.trim().substring(0, 100) || '';
      }
    }

    // Strategy 3: Get first text content that's not the title
    if (!preview) {
      const allText = element.textContent?.trim() || '';
      const titleText = title.trim();
      preview = allText
        .replace(titleText, '')
        .replace(/\n+/g, ' ')
        .trim()
        .substring(0, 100);
    }

    // Estimate message count (will be more accurate when we scrape full conversations)
    const messageCount = this.estimateMessageCount(element);

    return {
      id,
      platform: 'claude',
      title,
      preview: preview || undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
      messageCount,
      tags: [],
      isStarred: false,
      isArchived: false
    };
  }

  private estimateMessageCount(element: Element): number {
    // Try to find message count badge
    const badge = element.querySelector('[class*="badge"], [class*="count"]');
    if (badge) {
      const count = parseInt(badge.textContent || '0', 10);
      if (!isNaN(count)) return count;
    }

    // Estimate based on visible message elements
    const messages = element.querySelectorAll('[class*="message"]');
    if (messages.length > 0) return messages.length;

    // Default estimate
    return 0;
  }

  private extractConversationId(href: string | null): string | null {
    if (!href) return null;

    const patterns = [
      /chat\/([a-f0-9-]{36})/i,
      /conversation\/([a-zA-Z0-9-_]+)/,
      /\/([a-zA-Z0-9-_]{20,})/
    ];

    for (const pattern of patterns) {
      const match = href.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private waitForElement(selector: string, timeout: number): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  getCurrentConversationId(): string | null {
    return this.extractConversationId(window.location.href);
  }
}

export const scraper = new ClaudeScraper();
