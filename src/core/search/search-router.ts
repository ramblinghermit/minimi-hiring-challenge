import { executeBraveSearch } from './brave-search';
import { executeTavilySearch } from './tavily-search';
import { executeFallbackSearch } from './fallback-search';
import { SearchOptions, SearchResponse, SearchResultItem, SourceCitation } from '../types';

/**
 * Unified Search Engine Router ("The One Tool")
 * Automatically uses the best available search provider:
 * 1. Brave Search API (if BRAVE_SEARCH_API_KEY is present)
 * 2. Tavily Search API (if TAVILY_API_KEY is present)
 * 3. Zero-Key Fallback (DuckDuckGo scraper - ensures agent never fails)
 */
export class SearchRouter {
  private braveKey?: string;
  private tavilyKey?: string;

  constructor() {
    this.braveKey = process.env.BRAVE_SEARCH_API_KEY;
    this.tavilyKey = process.env.TAVILY_API_KEY;
  }

  public getActiveProvider(): 'brave' | 'tavily' | 'fallback' {
    if (this.braveKey) return 'brave';
    if (this.tavilyKey) return 'tavily';
    return 'fallback';
  }

  /**
   * Execute a single web search query with automatic failover
   */
  public async searchSingle(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    if (this.braveKey) {
      try {
        return await executeBraveSearch(query, this.braveKey, options);
      } catch (err) {
        console.warn(`[SearchRouter] Brave search failed, falling back to zero-key search:`, err);
      }
    }

    if (this.tavilyKey) {
      try {
        return await executeTavilySearch(query, this.tavilyKey, options);
      } catch (err) {
        console.warn(`[SearchRouter] Tavily search failed, falling back to zero-key search:`, err);
      }
    }

    // Zero-Key Fallback
    return await executeFallbackSearch(query, options);
  }

  /**
   * Execute multiple search queries in parallel with deduplication
   */
  public async searchParallel(
    queries: string[],
    options: SearchOptions = {}
  ): Promise<{ results: SearchResultItem[]; citations: SourceCitation[]; executionTimeMs: number }> {
    const startTime = Date.now();
    const queryPromises = queries.map((q) => this.searchSingle(q, options));
    const responses = await Promise.allSettled(queryPromises);

    const seenUrls = new Set<string>();
    const aggregatedResults: SearchResultItem[] = [];

    for (const res of responses) {
      if (res.status === 'fulfilled') {
        for (const item of res.value.results) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            aggregatedResults.push(item);
          }
        }
      }
    }

    // Limit to top 8 distinct sources
    const topResults = aggregatedResults.slice(0, 8);

    // Build indexed citations
    const citations: SourceCitation[] = topResults.map((item, index) => ({
      index: index + 1,
      title: item.title,
      url: item.url,
      domain: item.domain,
      snippet: item.snippet,
      publishedDate: item.publishedDate,
    }));

    return {
      results: topResults,
      citations,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export const searchRouter = new SearchRouter();
