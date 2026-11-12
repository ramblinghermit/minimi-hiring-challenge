import { SearchOptions, SearchResponse, SearchResultItem } from '../types';

/**
 * Tavily Search API Client
 * Specialized search API for LLMs with full page snippet extraction
 */
export async function executeTavilySearch(
  query: string,
  apiKey: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const startTime = Date.now();
  const maxResults = options.maxResults || 5;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const results: SearchResultItem[] = [];

  if (Array.isArray(data.results)) {
    for (const item of data.results.slice(0, maxResults)) {
      let domain = '';
      try {
        domain = new URL(item.url).hostname.replace(/^www\./, '');
      } catch {
        domain = 'web';
      }

      results.push({
        title: item.title,
        url: item.url,
        snippet: item.content || '',
        domain,
        score: item.score,
      });
    }
  }

  return {
    query,
    provider: 'tavily',
    results,
    executionTimeMs: Date.now() - startTime,
  };
}
