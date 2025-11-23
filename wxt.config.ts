import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Cortex - AI Memory Manager',
    description: 'Never lose a conversation again. Semantic search, knowledge graphs, and persistent memory for Claude & ChatGPT.',
    permissions: ['storage', 'unlimitedStorage', 'tabs'],
    host_permissions: [
      '*://claude.ai/*',
      '*://chat.openai.com/*',
      '*://gemini.google.com/*'
    ]
  }
});
