// lib/scraper.ts

import type { Conversation } from '@/types/conversation';

export class ClaudeScraper {
  /**
   * Scrape conversation list from Claude.ai sidebar
   * Note: DOM selectors may need adjustment as Claude updates their UI
   */
  async scrapeConversationList(): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    // Wait for sidebar to load
    await this.waitForElement('[data-testid="conversation-list"]', 5000)
      .catch(() => console.log('Conversation list not found, trying alternative selectors'));

    // Try multiple selector strategies (Claude's DOM changes frequently)
    const conversationElements = this.findConversationElements();

    conversationElements.forEach((element, index) => {
      try {
        const conversation = this.parseConversationElement(element, index);
        if (conversation) {
          conversations.push(conversation);
        }
      } catch (error) {
        console.error('Failed to parse conversation element:', error);
      }
    });

    console.log(`🧠 Cortex: Scraped ${conversations.length} conversations`);
    return conversations;
  }

  private findConversationElements(): Element[] {
    // Strategy 1: Look for common conversation item patterns
    let elements = Array.from(document.querySelectorAll('[data-testid*="conversation"]'));
    
    if (elements.length === 0) {
      // Strategy 2: Look for links in sidebar that contain chat history
      const sidebar = document.querySelector('nav, aside, [class*="sidebar"]');
      if (sidebar) {
        elements = Array.from(sidebar.querySelectorAll('a[href*="/chat/"]'));
      }
    }

    if (elements.length === 0) {
      // Strategy 3: Look for any links with href containing conversation IDs
      elements = Array.from(document.querySelectorAll('a[href*="conversation"]'));
    }

    return elements;
  }

  private parseConversationElement(element: Element, fallbackIndex: number): Conversation | null {
    // Extract conversation ID from href
    const href = element.getAttribute('href');
    const id = this.extractConversationId(href) || `conv-${Date.now()}-${fallbackIndex}`;

    // Extract title
    const titleElement = element.querySelector('[class*="title"], h3, h4, strong');
    const title = titleElement?.textContent?.trim() || 
                  element.textContent?.trim().substring(0, 50) || 
                  'Untitled Conversation';

    // Extract timestamp (if available)
    const timeElement = element.querySelector('time, [class*="time"], [class*="date"]');
    const timestamp = timeElement?.getAttribute('datetime') || 
                     timeElement?.textContent || 
                     new Date().toISOString();

    // Extract preview text
    const previewElement = element.querySelector('[class*="preview"], p');
    const preview = previewElement?.textContent?.trim().substring(0, 100);

    return {
      id,
      platform: 'claude',
      title,
      preview,
      createdAt: timestamp,
      updatedAt: timestamp,
      messageCount: 0, // Will be updated when we scrape individual conversations
      tags: [],
      isStarred: false,
      isArchived: false
    };
  }

  private extractConversationId(href: string | null): string | null {
    if (!href) return null;

    // Extract UUID or ID from href
    const patterns = [
      /chat\/([a-f0-9-]{36})/i,           // UUID format
      /conversation\/([a-zA-Z0-9-_]+)/,   // Generic ID
      /\/([a-zA-Z0-9-_]{20,})/            // Long alphanumeric ID
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

  /**
   * Get the current conversation ID from the URL
   */
  getCurrentConversationId(): string | null {
    return this.extractConversationId(window.location.href);
  }
}

export const scraper = new ClaudeScraper();
