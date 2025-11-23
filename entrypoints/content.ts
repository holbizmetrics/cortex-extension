// entrypoints/content.ts - Day 3: PRETTIER

import { db } from '@/lib/db';
import { scraper } from '@/lib/scraper';
import type { Conversation } from '@/types/conversation';

export default defineContentScript({
  matches: ['*://claude.ai/*'],
  async main() {
    console.log('🧠 Cortex: Initializing...');

    await db.init();
    await waitForPageLoad();

    const sidebar = createSidebar();
    document.body.appendChild(sidebar);

    shiftMainContent();
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
    <style>
      #cortex-sidebar * {
        box-sizing: border-box;
      }
      
      .cortex-conversation-card {
        transition: all 0.2s ease;
      }
      
      .cortex-conversation-card:hover {
        transform: translateX(4px);
        background: rgba(255,255,255,0.12) !important;
      }
      
      .cortex-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
      }
      
      .cortex-skeleton {
        background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
        background-size: 200% 100%;
        animation: cortex-loading 1.5s infinite;
      }
      
      @keyframes cortex-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    </style>
    
    <div style="
      position: fixed;
      left: 0;
      top: 0;
      width: 320px;
      height: 100vh;
      background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      box-shadow: 2px 0 20px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <!-- Header -->
      <div style="padding: 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <h1 style="
          margin: 0 0 6px 0; 
          font-size: 22px; 
          font-weight: 700; 
          color: #fff; 
          display: flex; 
          align-items: center; 
          gap: 10px;
          letter-spacing: -0.5px;
        ">
          🧠 Cortex
        </h1>
        <p style="margin: 0; font-size: 12px; color: #95a5a6; font-weight: 500;">
          The brain for your AI conversations
        </p>
      </div>

      <!-- Search Bar -->
      <div style="padding: 16px 20px;">
        <div style="position: relative;">
          <input 
            id="cortex-search"
            type="text" 
            placeholder="🔍 Search conversations..." 
            style="
              width: 100%; 
              padding: 12px 14px; 
              border: none; 
              border-radius: 10px;
              background: rgba(255,255,255,0.08); 
              color: #fff; 
              font-size: 13px;
              outline: none; 
              transition: all 0.2s;
            "
            onfocus="this.style.background='rgba(255,255,255,0.12)'"
            onblur="this.style.background='rgba(255,255,255,0.08)'"
          />
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="padding: 0 20px 16px 20px; display: flex; gap: 10px;">
        <button 
          id="cortex-refresh"
          style="
            flex: 1;
            padding: 10px 14px;
            background: linear-gradient(135deg, rgba(52, 152, 219, 0.2) 0%, rgba(41, 128, 185, 0.2) 100%);
            border: 1px solid rgba(52, 152, 219, 0.4);
            border-radius: 8px;
            color: #3498db;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='linear-gradient(135deg, rgba(52, 152, 219, 0.3) 0%, rgba(41, 128, 185, 0.3) 100%)'; this.style.transform='scale(1.02)'"
          onmouseout="this.style.background='linear-gradient(135deg, rgba(52, 152, 219, 0.2) 0%, rgba(41, 128, 185, 0.2) 100%)'; this.style.transform='scale(1)'"
        >
          🔄 Refresh
        </button>
        <button 
          id="cortex-clear"
          style="
            flex: 1;
            padding: 10px 14px;
            background: linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(192, 57, 43, 0.15) 100%);
            border: 1px solid rgba(231, 76, 60, 0.3);
            border-radius: 8px;
            color: #e74c3c;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='linear-gradient(135deg, rgba(231, 76, 60, 0.25) 0%, rgba(192, 57, 43, 0.25) 100%)'; this.style.transform='scale(1.02)'"
          onmouseout="this.style.background='linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(192, 57, 43, 0.15) 100%)'; this.style.transform='scale(1)'"
        >
          🗑️ Clear
        </button>
      </div>

      <!-- Conversation List -->
      <div id="cortex-conversations" style="
        padding: 0 20px; 
        flex: 1; 
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.2) transparent;
      ">
        <div style="padding: 40px 20px; text-align: center; color: #95a5a6; font-size: 13px;">
          Loading conversations...
        </div>
      </div>

      <!-- Footer -->
      <div style="padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.1);">
        <div id="cortex-status" style="
          padding: 10px 14px;
          background: linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(39, 174, 96, 0.15) 100%);
          border-radius: 8px;
          border: 1px solid rgba(46, 204, 113, 0.3);
          margin-bottom: 10px;
        ">
          <div style="color: #2ecc71; font-size: 11px; font-weight: 600; text-align: center;">
            ✅ DAY 3: PRETTIER MODE
          </div>
        </div>
        <div style="color: #7f8c8d; font-size: 10px; text-align: center; font-weight: 500;">
          v0.3.0 • Building in Public
        </div>
      </div>
    </div>
  `;

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
    mainContent.style.marginLeft = '320px';
    mainContent.style.transition = 'margin-left 0.3s ease';
  }
}

async function loadConversations(): Promise<void> {
  const container = document.getElementById('cortex-conversations');
  if (!container) return;

  // Show loading skeleton
  container.innerHTML = Array(5).fill(0).map(() => `
    <div class="cortex-skeleton" style="
      padding: 16px;
      margin-bottom: 10px;
      border-radius: 12px;
      height: 90px;
    "></div>
  `).join('');

  try {
    const scrapedConversations = await scraper.scrapeConversationList();
    
    if (scrapedConversations.length > 0) {
      await db.saveConversations(scrapedConversations);
    }

    const conversations = await db.getAllConversations();
    conversations.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    displayConversations(conversations);
    updateStatus(conversations.length);
  } catch (error) {
    console.error('Failed to load conversations:', error);
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #e74c3c; font-size: 13px;">
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
      <div style="padding: 40px 20px; text-align: center; color: #95a5a6; font-size: 13px;">
        No conversations found
      </div>
    `;
    return;
  }

  container.innerHTML = conversations.map(conv => {
    const platformEmoji = conv.platform === 'claude' ? '🤖' : '💬';
    const messageCountDisplay = conv.messageCount > 0 ? conv.messageCount : '?';
    
    return `
    <div 
      class="cortex-conversation-card" 
      data-id="${conv.id}"
      style="
        padding: 14px 16px;
        margin-bottom: 10px;
        background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
        border-radius: 12px;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      "
    >
      <!-- Header Row -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 8px;
        gap: 8px;
      ">
        <div style="
          color: #ecf0f1;
          font-size: 13px;
          font-weight: 600;
          flex: 1;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        ">
          ${platformEmoji} ${conv.title}
        </div>
        ${conv.isStarred ? '<span style="font-size: 14px;">⭐</span>' : ''}
      </div>

      <!-- Preview Text -->
      ${conv.preview ? `
        <div style="
          color: #95a5a6;
          font-size: 12px;
          line-height: 1.5;
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        ">
          ${conv.preview}
        </div>
      ` : ''}

      <!-- Footer Row -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      ">
        <div style="
          color: #7f8c8d;
          font-size: 10px;
          font-weight: 500;
        ">
          ${formatTimestamp(conv.updatedAt)}
        </div>
        
        <div class="cortex-badge" style="
          background: rgba(52, 152, 219, 0.15);
          color: #3498db;
          border: 1px solid rgba(52, 152, 219, 0.3);
        ">
          ${messageCountDisplay} msg${messageCountDisplay !== '1' ? 's' : ''}
        </div>
      </div>
    </div>
  `}).join('');
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
      <div style="color: #2ecc71; font-size: 11px; font-weight: 600; text-align: center;">
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
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Unknown';
  }
}
