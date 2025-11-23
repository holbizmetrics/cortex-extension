export default defineContentScript({
  matches: ['*://claude.ai/*'],
  main() {
    console.log('🧠 Cortex: Initializing...');
    
    const initCortex = () => {
      if (document.getElementById('cortex-sidebar')) return;

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
          <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
              🧠 Cortex
            </h1>
            <p style="margin: 0; font-size: 12px; color: #95a5a6;">
              The brain for your AI conversations
            </p>
          </div>

          <div style="padding: 16px;">
            <input type="text" placeholder="🔍 Search conversations..." style="
              width: 100%; padding: 10px 12px; border: none; border-radius: 8px;
              background: rgba(255,255,255,0.1); color: #fff; font-size: 13px;
              outline: none; box-sizing: border-box;
            "/>
          </div>

          <div style="padding: 0 16px; flex: 1; overflow-y: auto;">
            <div style="padding: 12px; margin-bottom: 8px; background: rgba(52, 152, 219, 0.2);
              border-radius: 8px; cursor: pointer; border-left: 3px solid #3498db;">
              <div style="display: flex; justify-content: space-between; align-items: center;
                color: #fff; font-size: 13px; font-weight: 500;">
                <span>💬 All Conversations</span>
                <span style="background: #e74c3c; color: white; padding: 2px 8px;
                  border-radius: 10px; font-size: 11px; font-weight: 600;">0</span>
              </div>
            </div>

            <div style="padding: 12px; margin-bottom: 8px; background: rgba(255,255,255,0.05);
              border-radius: 8px; cursor: pointer;">
              <div style="color: #ecf0f1; font-size: 13px;">📁 Projects</div>
            </div>

            <div style="padding: 12px; margin-bottom: 8px; background: rgba(255,255,255,0.05);
              border-radius: 8px; cursor: pointer;">
              <div style="color: #ecf0f1; font-size: 13px;">⭐ Starred</div>
            </div>

            <div style="padding: 12px; margin-bottom: 8px; background: rgba(255,255,255,0.05);
              border-radius: 8px; cursor: pointer;">
              <div style="color: #ecf0f1; font-size: 13px;">💡 Knowledge Graph</div>
            </div>

            <div style="margin-top: 20px; padding: 12px; background: rgba(46, 204, 113, 0.1);
              border-radius: 8px; border: 1px solid rgba(46, 204, 113, 0.3);">
              <div style="color: #2ecc71; font-size: 11px; font-weight: 600; margin-bottom: 4px;">
                ✅ DAY 1: SIDEBAR ACTIVE
              </div>
              <div style="color: #95a5a6; font-size: 10px;">
                Scraping conversations next...
              </div>
            </div>
          </div>

          <div style="padding: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="color: #95a5a6; font-size: 11px; text-align: center;">
              v0.1.0 • Building in Public
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(sidebar);
      
      const mainContent = document.querySelector('main, [class*="main"]');
      if (mainContent instanceof HTMLElement) {
        mainContent.style.marginLeft = '280px';
        mainContent.style.transition = 'margin-left 0.3s ease';
      }

      console.log('🧠 Cortex: Sidebar injected');
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCortex);
    } else {
      initCortex();
    }
  }
});
