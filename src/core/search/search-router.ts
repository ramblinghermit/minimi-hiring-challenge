import { executeBraveSearch } from './brave-search';
import { executeTavilySearch } from './tavily-search';
import { executeFallbackSearch } from './fallback-search';
import { SearchOptions, SearchResponse, SearchResultItem, SourceCitation } from '../types';
import { SecurityGuardrails } from '../security/guardrails';
import { sanitizeSearchSnippet } from '../security/prompt-injection';

/**
 * Known programmatic SEO farms and scraper sites that pollute search results
 */
const LOW_QUALITY_DOMAINS = new Set([
  'macrotrends.net',
  'marketbeat.com',
  'stockanalysis.com',
  'tickerreport.com',
  'defenseworld.net',
  'americanbankingnews.com',
  'etfdailynews.com',
  'investorplace.com',
  'zacks.com',
  'gurufocus.com',
  'tipranks.com',
  'fool.com',
  'benzinga.com',
]);

/**
 * Authoritative, high-signal primary source domains to prioritize
 */
const HIGH_QUALITY_DOMAINS = new Set([
  'sec.gov',
  'reuters.com',
  'bloomberg.com',
  'cnbc.com',
  'wsj.com',
  'ft.com',
  'apnews.com',
  'nytimes.com',
  'theverge.com',
  'techcrunch.com',
  'arstechnica.com',
  'github.com',
  'wikipedia.org',
]);

/**
 * Unified Search Engine Router ("The One Tool")
 * Automatically uses the best available search provider:
 * 1. Brave Search API (if BRAVE_SEARCH_API_KEY is present)
 * 2. Tavily Search API (if TAVILY_API_KEY is present)
 * 3. Zero-Key Fallback (DuckDuckGo scraper - ensures agent never fails)
 */
export class SearchRouter {
  private get braveKey(): string | undefined {
    return process.env.BRAVE_SEARCH_API_KEY;
  }

  private get tavilyKey(): string | undefined {
    return process.env.TAVILY_API_KEY;
  }

  public getActiveProvider(): 'brave' | 'tavily' | 'fallback' {
    if (this.braveKey) return 'brave';
    if (this.tavilyKey) return 'tavily';
    return 'fallback';
  }

  /**
   * Execute a single web search query with automatic failover and guardrails
   */
  public async searchSingle(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const validation = SecurityGuardrails.validateSearchQuery(query);
    if (!validation.valid) {
      console.warn(`[SearchRouter] Blocked unsafe search query: "${query}" (${validation.reason})`);
      return {
        results: [],
        provider: 'fallback',
        query,
        executionTimeMs: 0,
      };
    }
    const safeQuery = validation.sanitizedQuery;

    if (this.braveKey) {
      try {
        return await executeBraveSearch(safeQuery, this.braveKey, options);
      } catch (err) {
        console.warn(`[SearchRouter] Brave search failed, falling back to zero-key search:`, err);
      }
    }

    if (this.tavilyKey) {
      try {
        return await executeTavilySearch(safeQuery, this.tavilyKey, options);
      } catch (err) {
        console.warn(`[SearchRouter] Tavily search failed, falling back to zero-key search:`, err);
      }
    }

    // Zero-Key Fallback
    return await executeFallbackSearch(safeQuery, options);
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
    const candidates: SearchResultItem[] = [];

    for (const res of responses) {
      if (res.status === 'fulfilled') {
        for (const item of res.value.results) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            candidates.push(item);
          }
        }
      }
    }

    // Filter out low-quality SEO farms if other sources are available
    const cleanResults = candidates.filter(
      (item) => !LOW_QUALITY_DOMAINS.has(item.domain.toLowerCase())
    );
    const pool = cleanResults.length >= 2 ? cleanResults : candidates;

    // Rank: boost authoritative primary sources, demote low-quality farms
    pool.sort((a, b) => {
      const aIsHigh = HIGH_QUALITY_DOMAINS.has(a.domain.toLowerCase()) ? 1 : 0;
      const bIsHigh = HIGH_QUALITY_DOMAINS.has(b.domain.toLowerCase()) ? 1 : 0;
      const aIsLow = LOW_QUALITY_DOMAINS.has(a.domain.toLowerCase()) ? 1 : 0;
      const bIsLow = LOW_QUALITY_DOMAINS.has(b.domain.toLowerCase()) ? 1 : 0;
      return (bIsHigh - aIsHigh) || (aIsLow - bIsLow);
    });

    // Limit to top 8 distinct sources
    const topResults = pool.slice(0, 8);

    // Build indexed citations with prompt injection sanitization
    const citations: SourceCitation[] = topResults.map((item, index) => ({
      index: index + 1,
      title: sanitizeSearchSnippet(item.title),
      url: item.url,
      domain: item.domain,
      snippet: sanitizeSearchSnippet(item.snippet),
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
