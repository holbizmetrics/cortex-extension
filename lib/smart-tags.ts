// lib/smart-tags.ts

import type { Conversation } from '@/types/conversation';

export class SmartTagger {
  private tagKeywords = {
    'Development': [
      'code', 'programming', 'debug', 'api', 'function', 'typescript', 
      'javascript', 'python', 'java', 'c#', 'rust', 'golang', 'react',
      'vue', 'angular', 'git', 'github', 'npm', 'package', 'dependency',
      'build', 'compile', 'test', 'unit test', 'integration', 'deployment'
    ],
    'Security': [
      'security', 'vulnerability', 'auth', 'authentication', 'authorization',
      'encryption', 'permission', 'exploit', 'xss', 'csrf', 'sql injection',
      'owasp', 'penetration', 'firewall', 'certificate', 'ssl', 'tls',
      'password', 'token', 'jwt', 'oauth'
    ],
    'Design': [
      'design', 'ui', 'ux', 'interface', 'layout', 'css', 'styling',
      'component', 'figma', 'sketch', 'wireframe', 'mockup', 'prototype',
      'color', 'typography', 'responsive', 'mobile', 'accessibility'
    ],
    'Data': [
      'database', 'sql', 'query', 'data', 'analytics', 'chart', 'graph',
      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'index',
      'migration', 'schema', 'orm', 'prisma', 'sequelize', 'table'
    ],
    'AI/ML': [
      'ai', 'artificial intelligence', 'machine learning', 'model', 'neural',
      'gpt', 'claude', 'training', 'dataset', 'embedding', 'vector',
      'transformer', 'llm', 'prompt', 'fine-tune', 'inference', 'tensorflow',
      'pytorch', 'langchain', 'openai', 'anthropic'
    ],
    'Documentation': [
      'documentation', 'readme', 'guide', 'tutorial', 'explain', 'how to',
      'instructions', 'manual', 'wiki', 'docs', 'specification', 'api doc',
      'comment', 'jsdoc', 'docstring', 'markdown'
    ],
    'Business': [
      'business', 'strategy', 'marketing', 'sales', 'revenue', 'profit',
      'customer', 'user', 'conversion', 'metrics', 'kpi', 'roi', 'growth',
      'startup', 'enterprise', 'b2b', 'b2c', 'pricing', 'monetization'
    ],
    'Research': [
      'research', 'analysis', 'study', 'investigate', 'explore', 'paper',
      'academic', 'thesis', 'experiment', 'hypothesis', 'methodology',
      'findings', 'conclusion', 'literature review', 'survey'
    ],
    'DevOps': [
      'docker', 'kubernetes', 'deployment', 'ci/cd', 'pipeline', 'jenkins',
      'github actions', 'aws', 'azure', 'gcp', 'cloud', 'infrastructure',
      'terraform', 'ansible', 'monitoring', 'logging', 'prometheus', 'grafana'
    ],
    'Architecture': [
      'architecture', 'design pattern', 'microservice', 'monolith', 'scalability',
      'performance', 'optimization', 'system design', 'distributed', 'queue',
      'cache', 'load balancer', 'api gateway', 'service mesh', 'event driven'
    ]
  };

  /**
   * Generate smart tags for a conversation based on keywords
   */
  generateTags(conversation: Conversation): string[] {
    const content = `${conversation.title} ${conversation.preview || ''}`.toLowerCase();
    const tags: Set<string> = new Set();
    const tagScores: Map<string, number> = new Map();

    // Score each tag based on keyword matches
    for (const [tag, keywords] of Object.entries(this.tagKeywords)) {
      let score = 0;
      
      for (const keyword of keywords) {
        if (content.includes(keyword.toLowerCase())) {
          // Weight longer/more specific keywords higher
          score += keyword.split(' ').length;
        }
      }

      if (score > 0) {
        tagScores.set(tag, score);
      }
    }

    // Sort by score and take top 3
    const sortedTags = Array.from(tagScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    return sortedTags;
  }

  /**
   * Batch process conversations to add tags
   */
  processConversations(conversations: Conversation[]): Conversation[] {
    return conversations.map(conv => {
      if (!conv.tags || conv.tags.length === 0) {
        conv.tags = this.generateTags(conv);
      }
      return conv;
    });
  }

  /**
   * Get all unique tags from conversations
   */
  getAllTags(conversations: Conversation[]): string[] {
    const allTags = new Set<string>();
    
    conversations.forEach(conv => {
      conv.tags?.forEach(tag => allTags.add(tag));
    });

    return Array.from(allTags).sort();
  }

  /**
   * Filter conversations by tag
   */
  filterByTag(conversations: Conversation[], tag: string): Conversation[] {
    return conversations.filter(conv => 
      conv.tags?.includes(tag)
    );
  }

  /**
   * Get tag color for consistent UI
   */
  getTagColor(tag: string): { bg: string; color: string; border: string } {
    const colors: Record<string, { bg: string; color: string; border: string }> = {
      'Development': { bg: 'rgba(52, 152, 219, 0.2)', color: '#3498db', border: 'rgba(52, 152, 219, 0.4)' },
      'Security': { bg: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', border: 'rgba(231, 76, 60, 0.4)' },
      'Design': { bg: 'rgba(155, 89, 182, 0.2)', color: '#9b59b6', border: 'rgba(155, 89, 182, 0.4)' },
      'Data': { bg: 'rgba(26, 188, 156, 0.2)', color: '#1abc9c', border: 'rgba(26, 188, 156, 0.4)' },
      'AI/ML': { bg: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f', border: 'rgba(241, 196, 15, 0.4)' },
      'Documentation': { bg: 'rgba(149, 165, 166, 0.2)', color: '#95a5a6', border: 'rgba(149, 165, 166, 0.4)' },
      'Business': { bg: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', border: 'rgba(46, 204, 113, 0.4)' },
      'Research': { bg: 'rgba(230, 126, 34, 0.2)', color: '#e67e22', border: 'rgba(230, 126, 34, 0.4)' },
      'DevOps': { bg: 'rgba(52, 73, 94, 0.3)', color: '#34495e', border: 'rgba(52, 73, 94, 0.5)' },
      'Architecture': { bg: 'rgba(127, 140, 141, 0.2)', color: '#7f8c8d', border: 'rgba(127, 140, 141, 0.4)' },
    };

    return colors[tag] || { bg: 'rgba(155, 89, 182, 0.2)', color: '#9b59b6', border: 'rgba(155, 89, 182, 0.4)' };
  }

  /**
   * Fuzzy search across conversations
   */
  fuzzySearch(conversations: Conversation[], query: string): Conversation[] {
    if (!query) return conversations;

    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/).filter(w => w.length > 0);

    return conversations.filter(conv => {
      const searchText = `${conv.title} ${conv.preview || ''} ${conv.tags?.join(' ') || ''}`.toLowerCase();
      
      // Match if any word is found
      return words.some(word => searchText.includes(word));
    });
  }
}

export const smartTagger = new SmartTagger();
