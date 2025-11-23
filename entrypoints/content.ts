// entrypoints/content.ts

import { db } from '@/lib/db';
import { scraper } from '@/lib/scraper';
import type { Conversation } from '@/types/conversation';

export default defineContentScript({
  matches: ['*://claude.ai/*'],
  async main() {
    console.log('🧠 Cortex: Initializing...');

    // Initialize database
    await db.init();

    // Wait for page to be ready
    await waitForPageLoad();

    // Create and inject sidebar
    const sidebar = createSidebar();
    document.body.appendChild(sidebar);

    // Shift main content
    shiftMainContent();

    // Load and display conversations
    await loadConversations();

    console.log('🧠 Cortex: Ready');
  }
});

function waitForPageLoad(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', () => resolve());
    }
  });
}

function createSidebar(): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.id = 'cortex-sidebar';
  sidebar.innerHTML = `
    <div style="
      position: fixed;
      left: 0;
      top: 0;
      width: 280px;
      height: 100vh;
      background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      box-shadow: 2px 0 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <!-- Header -->
      <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
          🧠 Cortex
        </h1>
        <p style="margin: 0; font-size: 12px; color: #95a5a6;">
          The brain for your AI conversations
        </p>
      </div>

      <!-- Search Bar -->
      <div style="padding: 16px;">
        <input 
          id="cortex-search"
          type="text" 
          placeholder="🔍 Search conversations..." 
          style="
            width: 100%; 
            padding: 10px 12px; 
            border: none; 
            border-radius: 8px;
            background: rgba(255,255,255,0.1); 
            color: #fff; 
            font-size: 13px;
            outline: none; 
            box-sizing: border-box;
          "
        />
      </div>

      <!-- Action Buttons -->
      <div style="padding: 0 16px 16px 16px; display: flex; gap: 8px;">
        <button 
          id="cortex-refresh"
          style="
            flex: 1;
            padding: 8px 12px;
            background: rgba(52, 152, 219, 0.2);
            border: 1px solid rgba(52, 152, 219, 0.3);
            border-radius: 6px;
            color: #3498db;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          "
        >
          🔄 Refresh
        </button>
        <button 
          id="cortex-clear"
          style="
            flex: 1;
            padding: 8px 12px;
            background: rgba(231, 76, 60, 0.1);
            border: 1px solid rgba(231, 76, 60, 0.3);
            border-radius: 6px;
            color: #e74c3c;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          "
        >
          🗑️ Clear
        </button>
      </div>

      <!-- Conversation List -->
      <div id="cortex-conversations" style="padding: 0 16px; flex: 1; overflow-y: auto;">
        <div style="
          padding: 20px;
          text-align: center;
          color: #95a5a6;
          font-size: 13px;
        ">
          Loading conversations...
        </div>
      </div>

      <!-- Footer -->
      <div style="padding: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
        <div id="cortex-status" style="
          padding: 8px 12px;
          background: rgba(46, 204, 113, 0.1);
          border-radius: 6px;
          border: 1px solid rgba(46, 204, 113, 0.3);
          margin-bottom: 8px;
        ">
          <div style="color: #2ecc71; font-size: 11px; font-weight: 600;">
            ✅ DAY 2: SCRAPING ACTIVE
          </div>
        </div>
        <div style="color: #95a5a6; font-size: 11px; text-align: center;">
          v0.2.0 • Building in Public
        </div>
      </div>
    </div>
  `;

  // Add event listeners
  setTimeout(() => {
    const refreshBtn = document.getElementById('cortex-refresh');
    const clearBtn = document.getElementById('cortex-clear');
    const searchInput = document.getElementById('cortex-search') as HTMLInputElement;

    refreshBtn?.addEventListener('click', async () => {
      await loadConversations();
    });

    clearBtn?.addEventListener('click', async () => {
      if (confirm('Clear all stored conversations?')) {
        await db.clearAll();
        await loadConversations();
      }
    });

    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      filterConversations(query);
    });
  }, 100);

  return sidebar;
}

function shiftMainContent(): void {
  const mainContent = document.querySelector('main, [class*="main"]');
  if (mainContent instanceof HTMLElement) {
    mainContent.style.marginLeft = '280px';
    mainContent.style.transition = 'margin-left 0.3s ease';
  }
}

async function loadConversations(): Promise<void> {
  const container = document.getElementById('cortex-conversations');
  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #95a5a6; font-size: 13px;">
      🔄 Scraping conversations...
    </div>
  `;

  try {
    // Scrape conversations from DOM
    const scrapedConversations = await scraper.scrapeConversationList();
    
    // Save to database
    if (scrapedConversations.length > 0) {
      await db.saveConversations(scrapedConversations);
    }

    // Load all conversations from database
    const conversations = await db.getAllConversations();

    // Sort by updated date (most recent first)
    conversations.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // Display conversations
    displayConversations(conversations);

    // Update status
    updateStatus(conversations.length);
  } catch (error) {
    console.error('Failed to load conversations:', error);
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #e74c3c; font-size: 13px;">
        ⚠️ Failed to load conversations
      </div>
    `;
  }
}

function displayConversations(conversations: Conversation[]): void {
  const container = document.getElementById('cortex-conversations');
  if (!container) return;

  if (conversations.length === 0) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #95a5a6; font-size: 13px;">
        No conversations found
      </div>
    `;
    return;
  }

  container.innerHTML = conversations.map(conv => `
    <div 
      class="cortex-conversation-card" 
      data-id="${conv.id}"
      style="
        padding: 12px;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      "
      onmouseover="this.style.background='rgba(255,255,255,0.1)'"
      onmouseout="this.style.background='rgba(255,255,255,0.05)'"
    >
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 4px;
      ">
        <div style="
          color: #ecf0f1;
          font-size: 13px;
          font-weight: 500;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">
          ${conv.title}
        </div>
        ${conv.isStarred ? '<span style="color: #f39c12;">⭐</span>' : ''}
      </div>
      ${conv.preview ? `
        <div style="
          color: #95a5a6;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">
          ${conv.preview}
        </div>
      ` : ''}
      <div style="
        color: #7f8c8d;
        font-size: 10px;
        margin-top: 4px;
      ">
        ${formatTimestamp(conv.updatedAt)}
      </div>
    </div>
  `).join('');
}

function filterConversations(query: string): void {
  const cards = document.querySelectorAll('.cortex-conversation-card');
  cards.forEach(card => {
    const text = card.textContent?.toLowerCase() || '';
    const matches = text.includes(query);
    (card as HTMLElement).style.display = matches ? 'block' : 'none';
  });
}

function updateStatus(count: number): void {
  const statusDiv = document.getElementById('cortex-status');
  if (statusDiv) {
    statusDiv.innerHTML = `
      <div style="color: #2ecc71; font-size: 11px; font-weight: 600;">
        ✅ ${count} CONVERSATIONS LOADED
      </div>
    `;
  }
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  } catch {
    return 'Unknown';
  }
}
