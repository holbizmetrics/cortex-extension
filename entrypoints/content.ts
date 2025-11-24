// entrypoints/content.ts - Day 6: POLISH (with collapse & sidebar control)

import { db } from '@/lib/db';
import { scraper } from '@/lib/scraper';
import { smartTagger } from '@/lib/smart-tags';
import type { Conversation } from '@/types/conversation';

let allConversations: Conversation[] = [];
let selectedTag: string | null = null;
let selectedView: 'all' | 'starred' | 'archived' = 'all';
let isCollapsed = false;
let claudeSidebarHidden = true; // Default: hide Claude's sidebar

export default defineContentScript({
  matches: ['*://claude.ai/*'],
  async main() {
    console.log('🧠 Cortex: Initializing...');

    await db.init();
    await waitForPageLoad();

    const sidebar = createSidebar();
    document.body.appendChild(sidebar);

    toggleClaudeSidebar(claudeSidebarHidden);
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

function toggleClaudeSidebar(hide: boolean): void {
  // Find Claude's native sidebar
  const claudeSidebar = document.querySelector('nav[class*="sidebar"], aside, div[class*="sidebar"]:not(#cortex-sidebar)');
  
  if (claudeSidebar && claudeSidebar instanceof HTMLElement) {
    claudeSidebar.style.display = hide ? 'none' : '';
  }
}

function createSidebar(): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.id = 'cortex-sidebar';
  sidebar.innerHTML = `
    <style>
      #cortex-sidebar {
        transition: transform 0.3s ease;
      }
      
      #cortex-sidebar.collapsed {
        transform: translateX(-320px);
      }
      
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
      
      .cortex-view-btn {
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: #95a5a6;
      }
      
      .cortex-view-btn:hover {
        background: rgba(255,255,255,0.08);
        color: #ecf0f1;
      }
      
      .cortex-view-btn.active {
        background: rgba(52, 152, 219, 0.2);
        border-color: rgba(52, 152, 219, 0.4);
        color: #3498db;
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
      
      .cortex-empty-state {
        padding: 60px 20px;
        text-align: center;
      }
      
      .cortex-empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.3;
      }
      
      .cortex-empty-title {
        color: #ecf0f1;
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      
      .cortex-empty-text {
        color: #95a5a6;
        font-size: 13px;
        line-height: 1.5;
      }
      
      .cortex-toggle-btn {
        position: fixed;
        left: 330px;
        top: 50%;
        transform: translateY(-50%);
        width: 32px;
        height: 64px;
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
        border: 1px solid rgba(255,255,255,0.1);
        border-left: none;
        border-radius: 0 8px 8px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 9998;
        transition: all 0.3s ease;
        box-shadow: 2px 0 10px rgba(0,0,0,0.2);
      }
      
      .cortex-toggle-btn:hover {
        background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
      }
      
      .cortex-toggle-btn.collapsed {
        left: 10px;
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
      <div style="padding: 20px 20px 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <h1 style="
            margin: 0; 
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
          <button
            id="cortex-toggle-claude"
            title="${claudeSidebarHidden ? 'Show Claude sidebar' : 'Hide Claude sidebar'}"
            style="
              width: 28px;
              height: 28px;
              border-radius: 6px;
              background: rgba(255,255,255,0.1);
              border: 1px solid rgba(255,255,255,0.2);
              color: #fff;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              transition: all 0.2s;
            "
            onmouseover="this.style.background='rgba(255,255,255,0.15)'"
            onmouseout="this.style.background='rgba(255,255,255,0.1)'"
          >
            ${claudeSidebarHidden ? '👁️' : '🚫'}
          </button>
        </div>
        <p style="margin: 0; font-size: 12px; color: #95a5a6; font-weight: 500;">
          Organize, search, and never lose context
        </p>
      </div>

      <!-- View Switcher -->
      <div style="padding: 16px 20px 12px 20px; display: flex; gap: 6px;">
        <button 
          id="cortex-view-all" 
          class="cortex-view-btn active"
          data-view="all"
        >
          💬 All
        </button>
        <button 
          id="cortex-view-starred" 
          class="cortex-view-btn"
          data-view="starred"
        >
          ⭐ Starred
        </button>
        <button 
          id="cortex-view-archived" 
          class="cortex-view-btn"
          data-view="archived"
        >
          📦 Archived
        </button>
      </div>

      <!-- Search Bar -->
      <div style="padding: 0 20px 12px 20px;">
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
            ✅ DAY 6: POLISHED
          </div>
        </div>
        <div style="color: #7f8c8d; font-size: 10px; text-align: center; font-weight: 500;">
          v0.6.0 • Building in Public
        </div>
      </div>
    </div>
  `;

  // Create toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'cortex-toggle-btn';
  toggleBtn.innerHTML = '◀';
  toggleBtn.title = 'Toggle Cortex sidebar';
  
  toggleBtn.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    sidebar.classList.toggle('collapsed');
    toggleBtn.classList.toggle('collapsed');
    toggleBtn.innerHTML = isCollapsed ? '▶' : '◀';
    shiftMainContent();
  });

  setTimeout(() => {
    document.body.appendChild(toggleBtn);
  }, 100);

  setTimeout(() => {
    // Claude sidebar toggle
    const toggleClaudeBtn = document.getElementById('cortex-toggle-claude');
    toggleClaudeBtn?.addEventListener('click', () => {
      claudeSidebarHidden = !claudeSidebarHidden;
      toggleClaudeSidebar(claudeSidebarHidden);
      toggleClaudeBtn.innerHTML = claudeSidebarHidden ? '👁️' : '🚫';
      toggleClaudeBtn.title = claudeSidebarHidden ? 'Show Claude sidebar' : 'Hide Claude sidebar';
    });

    // View switcher
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = (btn as HTMLElement).getAttribute('data-view') as typeof selectedView;
        selectedView = view;
        
        document.querySelectorAll('.cortex-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        selectedTag = null;
        displayCurrentView();
      });
    });

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
    mainContent.style.marginLeft = isCollapsed ? '0px' : '320px';
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
    displayCurrentView();
  } catch (error) {
    console.error('Failed to load conversations:', error);
    container.innerHTML = `
      <div class="cortex-empty-state">
        <div class="cortex-empty-icon">⚠️</div>
        <div class="cortex-empty-title">Failed to load</div>
        <div class="cortex-empty-text">Could not load conversations. Please refresh.</div>
      </div>
    `;
  }
}

function displayCurrentView(): void {
  let conversations = [...allConversations];

  switch (selectedView) {
    case 'starred':
      conversations = conversations.filter(c => c.isStarred);
      break;
    case 'archived':
      conversations = conversations.filter(c => c.isArchived);
      break;
    case 'all':
      conversations = conversations.filter(c => !c.isArchived);
      break;
  }

  if (selectedTag) {
    conversations = smartTagger.filterByTag(conversations, selectedTag);
  }

  renderTagFilter();
  displayConversations(conversations);
  updateStatus(conversations.length);
}

function renderTagFilter(): void {
  const filterContainer = document.getElementById('cortex-tag-filter');
  if (!filterContainer) return;

  let viewConversations = [...allConversations];
  switch (selectedView) {
    case 'starred':
      viewConversations = viewConversations.filter(c => c.isStarred);
      break;
    case 'archived':
      viewConversations = viewConversations.filter(c => c.isArchived);
      break;
    case 'all':
      viewConversations = viewConversations.filter(c => !c.isArchived);
      break;
  }

  const allTags = smartTagger.getAllTags(viewConversations);
  
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
      } else {
        selectedTag = tag;
      }
      displayCurrentView();
    });
  });
}

function displayConversations(conversations: Conversation[]): void {
  const container = document.getElementById('cortex-conversations');
  if (!container) return;

  if (conversations.length === 0) {
    container.innerHTML = getEmptyState();
    return;
  }

  container.innerHTML = conversations.map(conv => {
    const platformEmoji = conv.platform === 'claude' ? '🤖' : '💬';
    const messageCountDisplay = conv.messageCount > 0 ? conv.messageCount : '?';
    const starIcon = conv.isStarred ? '⭐' : '☆';
    const archiveIcon = conv.isArchived ? '📦' : '📥';
    
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
      <div class="cortex-card-actions">
        <div class="cortex-action-btn" data-action="star" title="${conv.isStarred ? 'Unstar' : 'Star'}">
          ${starIcon}
        </div>
        <div class="cortex-action-btn" data-action="archive" title="${conv.isArchived ? 'Unarchive' : 'Archive'}">
          ${archiveIcon}
        </div>
        <div class="cortex-action-btn" data-action="export" title="Export">
          📤
        </div>
        <div class="cortex-action-btn" data-action="delete" title="Delete">
          🗑️
        </div>
      </div>

      <div style="
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 8px;
        gap: 8px;
        padding-right: 110px;
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

      ${tagsHTML ? `
        <div style="margin-bottom: 8px; display: flex; flex-wrap: wrap;">
          ${tagsHTML}
        </div>
      ` : ''}

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

  container.querySelectorAll('.cortex-conversation-card').forEach(card => {
    const conv = JSON.parse(card.getAttribute('data-conv') || '{}');
    
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.cortex-action-btn')) return;
      navigateToConversation(conv);
    });

    card.querySelectorAll('.cortex-action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).getAttribute('data-action');
        
        switch (action) {
          case 'star':
            await toggleStar(conv);
            break;
          case 'archive':
            await toggleArchive(conv);
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

function getEmptyState(): string {
  switch (selectedView) {
    case 'starred':
      return `
        <div class="cortex-empty-state">
          <div class="cortex-empty-icon">⭐</div>
          <div class="cortex-empty-title">No starred conversations</div>
          <div class="cortex-empty-text">Star conversations to keep them here for quick access.</div>
        </div>
      `;
    case 'archived':
      return `
        <div class="cortex-empty-state">
          <div class="cortex-empty-icon">📦</div>
          <div class="cortex-empty-title">No archived conversations</div>
          <div class="cortex-empty-text">Archive conversations you've completed to declutter your list.</div>
        </div>
      `;
    default:
      if (selectedTag) {
        return `
          <div class="cortex-empty-state">
            <div class="cortex-empty-icon">🏷️</div>
            <div class="cortex-empty-title">No conversations tagged "${selectedTag}"</div>
            <div class="cortex-empty-text">Try a different tag or clear the filter.</div>
          </div>
        `;
      }
      return `
        <div class="cortex-empty-state">
          <div class="cortex-empty-icon">💬</div>
          <div class="cortex-empty-title">No conversations found</div>
          <div class="cortex-empty-text">Start a conversation in Claude and click Refresh.</div>
        </div>
      `;
  }
}

function navigateToConversation(conv: Conversation): void {
  window.location.href = 'https://claude.ai/chat/' + conv.id;
}

async function toggleStar(conv: Conversation): Promise<void> {
  conv.isStarred = !conv.isStarred;
  
  // Update in database
  const allConvs = await db.getAllConversations();
  const targetConv = allConvs.find(c => c.id === conv.id);
  if (targetConv) {
    targetConv.isStarred = conv.isStarred;
    await db.saveConversations([targetConv]);
  }
  
  // Update local state
  const localConv = allConversations.find(c => c.id === conv.id);
  if (localConv) {
    localConv.isStarred = conv.isStarred;
  }
  
  displayCurrentView();
}

async function toggleArchive(conv: Conversation): Promise<void> {
  conv.isArchived = !conv.isArchived;
  if (conv.isArchived) {
    conv.isStarred = false;
  }
  
  // Update in database
  const allConvs = await db.getAllConversations();
  const targetConv = allConvs.find(c => c.id === conv.id);
  if (targetConv) {
    targetConv.isArchived = conv.isArchived;
    targetConv.isStarred = conv.isStarred;
    await db.saveConversations([targetConv]);
  }
  
  // Update local state
  const localConv = allConversations.find(c => c.id === conv.id);
  if (localConv) {
    localConv.isArchived = conv.isArchived;
    localConv.isStarred = conv.isStarred;
  }
  
  displayCurrentView();
}

function exportConversation(conv: Conversation): void {
  const markdown = `# ${conv.title}

**Platform:** ${conv.platform}  
**Date:** ${new Date(conv.updatedAt).toLocaleDateString()}  
**Tags:** ${conv.tags?.join(', ') || 'None'}  
**Starred:** ${conv.isStarred ? 'Yes' : 'No'}  
**Archived:** ${conv.isArchived ? 'Yes' : 'No'}  

## Preview

${conv.preview || 'No preview available'}

---

*Exported from Cortex v0.6.0*
`;

  downloadFile(markdown, `${sanitizeFilename(conv.title)}.md`, 'text/markdown');
}

function exportAllConversations(): void {
  let conversations = [...allConversations];

  switch (selectedView) {
    case 'starred':
      conversations = conversations.filter(c => c.isStarred);
      break;
    case 'archived':
      conversations = conversations.filter(c => c.isArchived);
      break;
    case 'all':
      conversations = conversations.filter(c => !c.isArchived);
      break;
  }

  if (selectedTag) {
    conversations = smartTagger.filterByTag(conversations, selectedTag);
  }

  const markdown = conversations.map(conv => `
# ${conv.title}

**Platform:** ${conv.platform}  
**Date:** ${new Date(conv.updatedAt).toLocaleDateString()}  
**Tags:** ${conv.tags?.join(', ') || 'None'}  
**Starred:** ${conv.isStarred ? 'Yes' : 'No'}  

${conv.preview || 'No preview available'}

---
`).join('\n\n');

  const header = `# Cortex Conversations Export

**View:** ${selectedView}  
**Total Conversations:** ${conversations.length}  
**Export Date:** ${new Date().toLocaleDateString()}  
${selectedTag ? `**Tag Filter:** ${selectedTag}` : ''}

---

`;

  downloadFile(header + markdown, `cortex-${selectedView}-export.md`, 'text/markdown');
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
    displayCurrentView();
    return;
  }

  let baseConversations = [...allConversations];

  switch (selectedView) {
    case 'starred':
      baseConversations = baseConversations.filter(c => c.isStarred);
      break;
    case 'archived':
      baseConversations = baseConversations.filter(c => c.isArchived);
      break;
    case 'all':
      baseConversations = baseConversations.filter(c => !c.isArchived);
      break;
  }

  if (selectedTag) {
    baseConversations = smartTagger.filterByTag(baseConversations, selectedTag);
  }
    
  const filtered = smartTagger.fuzzySearch(baseConversations, query);
  displayConversations(filtered);
}

function updateStatus(count: number): void {
  const statusDiv = document.getElementById('cortex-status');
  if (statusDiv) {
    const viewLabel = selectedView === 'all' ? 'ACTIVE' : selectedView.toUpperCase();
    const tagInfo = selectedTag ? ` • ${selectedTag}` : '';
    statusDiv.innerHTML = `
      <div style="color: #2ecc71; font-size: 11px; font-weight: 600; text-align: center;">
        ✅ ${count} ${viewLabel}${tagInfo}
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
