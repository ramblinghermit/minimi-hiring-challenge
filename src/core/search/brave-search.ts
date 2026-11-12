import { SearchOptions, SearchResponse, SearchResultItem } from '../types';

/**
 * Brave Search Web API Client
 * High speed, privacy-first search index
 */
export async function executeBraveSearch(
  query: string,
  apiKey: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const startTime = Date.now();
  const maxResults = options.maxResults || 5;

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.append('q', query);
  url.searchParams.append('count', String(Math.min(maxResults, 10)));
  url.searchParams.append('result_filter', 'web');

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const results: SearchResultItem[] = [];

  if (data.web && Array.isArray(data.web.results)) {
    for (const item of data.web.results.slice(0, maxResults)) {
      let domain = '';
      try {
        domain = new URL(item.url).hostname.replace(/^www\./, '');
      } catch {
        domain = 'web';
      }

      results.push({
        title: item.title,
        url: item.url,
        snippet: item.description || item.snippet || '',
        domain,
        publishedDate: item.page_age || item.age || undefined,
      });
    }
  }

  return {
    query,
    provider: 'brave',
    results,
    executionTimeMs: Date.now() - startTime,
  };
}
