// entrypoints/content.ts - Day 5: FUNCTIONAL

import { db } from '@/lib/db';
import { scraper } from '@/lib/scraper';
import { smartTagger } from '@/lib/smart-tags';
import type { Conversation } from '@/types/conversation';

let allConversations: Conversation[] = [];
let selectedTag: string | null = null;

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
        position: relative;
      }
      
      .cortex-conversation-card:hover {
        transform: translateX(4px);
        background: rgba(255,255,255,0.12) !important;
      }
      
      .cortex-conversation-card:hover .cortex-card-actions {
        opacity: 1;
        pointer-events: all;
      }
      
      .cortex-card-actions {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 4px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        z-index: 10;
      }
      
      .cortex-action-btn {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
        background: rgba(0,0,0,0.3);
        backdrop-filter: blur(4px);
      }
      
      .cortex-action-btn:hover {
        transform: scale(1.1);
        background: rgba(0,0,0,0.5);
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
      
      .cortex-tag {
        display: inline-flex;
        align-items: center;
        padding: 3px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
        margin-right: 4px;
        margin-bottom: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .cortex-tag:hover {
        transform: scale(1.05);
        filter: brightness(1.2);
      }
      
      .cortex-tag.active {
        box-shadow: 0 0 0 2px rgba(255,255,255,0.3);
        transform: scale(1.1);
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
      
      #cortex-conversations::-webkit-scrollbar {
        width: 6px;
      }
      
      #cortex-conversations::-webkit-scrollbar-track {
        background: transparent;
      }
      
      #cortex-conversations::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
      }
      
      #cortex-conversations::-webkit-scrollbar-thumb:hover {
        background: rgba(255,255,255,0.3);
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
      <div style="padding: 24px 20px 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
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
          <span style="
            font-size: 10px;
            padding: 2px 6px;
            background: linear-gradient(135deg, #f39c12, #e67e22);
            border-radius: 6px;
            font-weight: 700;
            letter-spacing: 0.5px;
          ">PRO</span>
        </h1>
        <p style="margin: 0; font-size: 12px; color: #95a5a6; font-weight: 500;">
          Click, star, export, and organize
        </p>
      </div>

      <!-- Search Bar -->
      <div style="padding: 16px 20px 12px 20px;">
        <div style="position: relative;">
          <input 
            id="cortex-search"
            type="text" 
            placeholder="🔍 Fuzzy search..." 
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

      <!-- Tag Filter -->
      <div id="cortex-tag-filter" style="
        padding: 0 20px 12px 20px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      ">
        <!-- Tags will be inserted here -->
      </div>

      <!-- Action Buttons -->
      <div style="padding: 0 20px 16px 20px; display: flex; gap: 8px;">
        <button 
          id="cortex-refresh"
          style="
            flex: 1;
            padding: 10px 12px;
            background: linear-gradient(135deg, rgba(52, 152, 219, 0.2) 0%, rgba(41, 128, 185, 0.2) 100%);
            border: 1px solid rgba(52, 152, 219, 0.4);
            border-radius: 8px;
            color: #3498db;
            font-size: 11px;
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
          id="cortex-export"
          style="
            flex: 1;
            padding: 10px 12px;
            background: linear-gradient(135deg, rgba(46, 204, 113, 0.2) 0%, rgba(39, 174, 96, 0.2) 100%);
            border: 1px solid rgba(46, 204, 113, 0.4);
            border-radius: 8px;
            color: #2ecc71;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='linear-gradient(135deg, rgba(46, 204, 113, 0.3) 0%, rgba(39, 174, 96, 0.3) 100%)'; this.style.transform='scale(1.02)'"
          onmouseout="this.style.background='linear-gradient(135deg, rgba(46, 204, 113, 0.2) 0%, rgba(39, 174, 96, 0.2) 100%)'; this.style.transform='scale(1)'"
        >
          📥 Export
        </button>
        <button 
          id="cortex-clear"
          style="
            padding: 10px 12px;
            background: linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(192, 57, 43, 0.15) 100%);
            border: 1px solid rgba(231, 76, 60, 0.3);
            border-radius: 8px;
            color: #e74c3c;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='linear-gradient(135deg, rgba(231, 76, 60, 0.25) 0%, rgba(192, 57, 43, 0.25) 100%)'; this.style.transform='scale(1.02)'"
          onmouseout="this.style.background='linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(192, 57, 43, 0.15) 100%)'; this.style.transform='scale(1)'"
        >
          🗑️
        </button>
      </div>

      <!-- Conversation List -->
      <div id="cortex-conversations" style="
        padding: 0 20px; 
        flex: 1; 
        overflow-y: auto;
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
            ✅ DAY 5: FUNCTIONAL
          </div>
        </div>
        <div style="color: #7f8c8d; font-size: 10px; text-align: center; font-weight: 500;">
          v0.5.0 • Building in Public
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const refreshBtn = document.getElementById('cortex-refresh');
    const exportBtn = document.getElementById('cortex-export');
    const clearBtn = document.getElementById('cortex-clear');
    const searchInput = document.getElementById('cortex-search') as HTMLInputElement;

    refreshBtn?.addEventListener('click', async () => {
      await loadConversations();
    });

    exportBtn?.addEventListener('click', () => {
      exportAllConversations();
    });

    clearBtn?.addEventListener('click', async () => {
      if (confirm('Clear all stored conversations?')) {
        await db.clearAll();
        await loadConversations();
      }
    });

    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
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
      const tagged = smartTagger.processConversations(scrapedConversations);
      await db.saveConversations(tagged);
    }

    allConversations = await db.getAllConversations();
    allConversations.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    renderTagFilter();
    displayConversations(allConversations);
    updateStatus(allConversations.length);
  } catch (error) {
    console.error('Failed to load conversations:', error);
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #e74c3c; font-size: 13px;">
        ⚠️ Failed to load conversations
      </div>
    `;
  }
}

function renderTagFilter(): void {
  const filterContainer = document.getElementById('cortex-tag-filter');
  if (!filterContainer) return;

  const allTags = smartTagger.getAllTags(allConversations);
  
  if (allTags.length === 0) {
    filterContainer.style.display = 'none';
    return;
  }

  filterContainer.style.display = 'flex';
  filterContainer.innerHTML = allTags.map(tag => {
    const colors = smartTagger.getTagColor(tag);
    const isActive = selectedTag === tag;
    
    return `
      <span 
        class="cortex-tag ${isActive ? 'active' : ''}"
        data-tag="${tag}"
        style="
          background: ${colors.bg};
          color: ${colors.color};
          border: 1px solid ${colors.border};
        "
      >
        ${tag}
      </span>
    `;
  }).join('');

  filterContainer.querySelectorAll('.cortex-tag').forEach(tagEl => {
    tagEl.addEventListener('click', () => {
      const tag = tagEl.getAttribute('data-tag');
      if (tag === selectedTag) {
        selectedTag = null;
        displayConversations(allConversations);
      } else {
        selectedTag = tag;
        const filtered = smartTagger.filterByTag(allConversations, tag);
        displayConversations(filtered);
      }
      renderTagFilter();
    });
  });
}

function displayConversations(conversations: Conversation[]): void {
  const container = document.getElementById('cortex-conversations');
  if (!container) return;

  if (conversations.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #95a5a6; font-size: 13px;">
        ${selectedTag ? `No conversations tagged "${selectedTag}"` : 'No conversations found'}
      </div>
    `;
    return;
  }

  container.innerHTML = conversations.map(conv => {
    const platformEmoji = conv.platform === 'claude' ? '🤖' : '💬';
    const messageCountDisplay = conv.messageCount > 0 ? conv.messageCount : '?';
    const starIcon = conv.isStarred ? '⭐' : '☆';
    
    const tagsHTML = conv.tags && conv.tags.length > 0 
      ? conv.tags.map(tag => {
          const colors = smartTagger.getTagColor(tag);
          return `<span class="cortex-tag" style="
            background: ${colors.bg};
            color: ${colors.color};
            border: 1px solid ${colors.border};
            cursor: default;
            pointer-events: none;
          ">${tag}</span>`;
        }).join('')
      : '';
    
    return `
    <div 
      class="cortex-conversation-card" 
      data-id="${conv.id}"
      data-conv='${JSON.stringify(conv).replace(/'/g, "&apos;")}'
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
      <!-- Action Buttons -->
      <div class="cortex-card-actions">
        <div class="cortex-action-btn" data-action="star" title="Star">
          ${starIcon}
        </div>
        <div class="cortex-action-btn" data-action="export" title="Export">
          📥
        </div>
        <div class="cortex-action-btn" data-action="delete" title="Delete">
          🗑️
        </div>
      </div>

      <!-- Header Row -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 8px;
        gap: 8px;
        padding-right: 80px;
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
      </div>

      <!-- Tags -->
      ${tagsHTML ? `
        <div style="margin-bottom: 8px; display: flex; flex-wrap: wrap;">
          ${tagsHTML}
        </div>
      ` : ''}

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

  // Add click handlers
  container.querySelectorAll('.cortex-conversation-card').forEach(card => {
    const conv = JSON.parse(card.getAttribute('data-conv') || '{}');
    
    // Click card to navigate
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.cortex-action-btn')) return; // Don't navigate if clicking action button
      navigateToConversation(conv);
    });

    // Action buttons
    card.querySelectorAll('.cortex-action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).getAttribute('data-action');
        
        switch (action) {
          case 'star':
            await toggleStar(conv);
            break;
          case 'export':
            exportConversation(conv);
            break;
          case 'delete':
            if (confirm(`Delete "${conv.title}" from Cortex?`)) {
              await db.deleteConversation(conv.id);
              await loadConversations();
            }
            break;
        }
      });
    });
  });
}

function navigateToConversation(conv: Conversation): void {
  // Navigate to the conversation in Claude
  const baseUrl = 'https://claude.ai/chat/';
  window.location.href = baseUrl + conv.id;
}

async function toggleStar(conv: Conversation): Promise<void> {
  conv.isStarred = !conv.isStarred;
  await db.saveConversations([conv]);
  await loadConversations();
}

function exportConversation(conv: Conversation): void {
  const markdown = `# ${conv.title}

**Platform:** ${conv.platform}  
**Date:** ${new Date(conv.updatedAt).toLocaleDateString()}  
**Tags:** ${conv.tags?.join(', ') || 'None'}  

## Preview

${conv.preview || 'No preview available'}

---

*Exported from Cortex - The brain for your AI conversations*
`;

  downloadFile(markdown, `${sanitizeFilename(conv.title)}.md`, 'text/markdown');
}

function exportAllConversations(): void {
  const conversations = selectedTag 
    ? smartTagger.filterByTag(allConversations, selectedTag)
    : allConversations;

  const markdown = conversations.map(conv => `
# ${conv.title}

**Platform:** ${conv.platform}  
**Date:** ${new Date(conv.updatedAt).toLocaleDateString()}  
**Tags:** ${conv.tags?.join(', ') || 'None'}  

${conv.preview || 'No preview available'}

---
`).join('\n\n');

  const header = `# Cortex Conversations Export

**Total Conversations:** ${conversations.length}  
**Export Date:** ${new Date().toLocaleDateString()}  
${selectedTag ? `**Filtered by Tag:** ${selectedTag}` : ''}

---

`;

  downloadFile(header + markdown, 'cortex-export.md', 'text/markdown');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .substring(0, 50);
}

function filterConversations(query: string): void {
  if (!query) {
    displayConversations(selectedTag ? smartTagger.filterByTag(allConversations, selectedTag) : allConversations);
    return;
  }

  const baseConversations = selectedTag 
    ? smartTagger.filterByTag(allConversations, selectedTag)
    : allConversations;
    
  const filtered = smartTagger.fuzzySearch(baseConversations, query);
  displayConversations(filtered);
}

function updateStatus(count: number): void {
  const statusDiv = document.getElementById('cortex-status');
  if (statusDiv) {
    const tagInfo = selectedTag ? ` • ${selectedTag}` : '';
    statusDiv.innerHTML = `
      <div style="color: #2ecc71; font-size: 11px; font-weight: 600; text-align: center;">
        ✅ ${count} CONVERSATIONS${tagInfo}
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
