export interface VideoSearchResult {
  id: string;
  title: string;
  channelName: string;
  duration: string;
  viewCount?: number;
  uploadDate?: string;
  thumbnailUrl: string;
}

export interface VideoMetadata {
  title?: string;
  channelName?: string;
  duration?: string;
  viewCount?: string;
  uploadDate?: string;
}

export interface CachingService {
  getCachedResults(query: string): Promise<VideoSearchResult[] | null>;
  setCachedResults(query: string, results: VideoSearchResult[]): Promise<void>;
  clearExpiredCache(): Promise<void>;
}

interface CacheEntry {
  results: VideoSearchResult[];
  timestamp: number;
  expiry: number;
}

export class YouTubeSearchService {
  private readonly SEARCH_BASE_URL = 'https://www.youtube.com/results';
  private readonly LOCAL_PROXY_URL = 'http://127.0.0.1:3001/youtube/search';
  private readonly FALLBACK_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ];
  private readonly REQUEST_DELAY = 1000; // Rate limiting
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  private cache = new Map<string, CacheEntry>();
  private lastRequestTime = 0;
  private rateLimitAttempts = 0;
  
  private readonly USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  ];

  async searchVideos(query: string): Promise<VideoSearchResult[]> {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    const cacheKey = this.getCacheKey(query);
    
    // Check cache first
    const cachedResults = await this.getCachedResults(cacheKey);
    if (cachedResults) {
      console.log(`Cache hit for query: ${query}`);
      return cachedResults;
    }

    try {
      // Rate limiting
      await this.enforceRateLimit();
      
      // Fetch search page
      const html = await this.fetchSearchPage(query);
      
      // Extract video IDs and metadata
      const videoIds = this.extractVideoIds(html);
      const results = this.parseVideoMetadata(html, videoIds);
      
      // Cache results
      await this.setCachedResults(cacheKey, results);
      
      console.log(`Found ${results.length} videos for query: ${query}`);
      return results;
    } catch (error) {
      console.error('YouTube search failed:', error);
      
      // Handle rate limiting
      if (this.isRateLimitError(error)) {
        await this.handleRateLimit();
        throw new Error('Rate limited - please try again later');
      }
      
      throw error;
    }
  }

  private async fetchSearchPage(query: string): Promise<string> {
    const encodedQuery = encodeURIComponent(query);
    
    // First, try the local proxy server
    try {
      console.log('🔄 Attempting YouTube search via local proxy server...');
      
      const localProxyUrl = `${this.LOCAL_PROXY_URL}?q=${encodedQuery}`;
      const response = await fetch(localProxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cache-Control': 'max-age=0'
        }
      });

      if (response.ok) {
        const html = await response.text();
        if (html && html.length > 0) {
          console.log('✅ Local proxy succeeded');
          return html;
        }
        console.log('⚠️ Local proxy returned empty response');
      } else {
        console.log(`⚠️ Local proxy failed with status: ${response.status}`);
      }
    } catch (error) {
      console.log('⚠️ Local proxy unavailable:', error instanceof Error ? error.message : 'Unknown error');
      console.log('💡 Make sure to start the proxy server: cd proxy-server && npm install && npm start');
    }

    // Fallback to external proxies
    console.log('🔄 Falling back to external proxy services...');
    const searchUrl = `${this.SEARCH_BASE_URL}?search_query=${encodedQuery}`;
    const userAgent = this.getRandomUserAgent();
    
    for (let i = 0; i < this.FALLBACK_PROXIES.length; i++) {
      const proxy = this.FALLBACK_PROXIES[i];
      const proxiedUrl = `${proxy}${encodeURIComponent(searchUrl)}`;
      
      try {
        console.log(`🔄 Attempting external proxy ${i + 1}/${this.FALLBACK_PROXIES.length}:`, proxy);
        
        const response = await fetch(proxiedUrl, {
          method: 'GET',
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'max-age=0'
          }
        });

        if (!response.ok) {
          console.log(`❌ External proxy ${i + 1} failed with status:`, response.status);
          continue;
        }

        const html = await response.text();
        
        if (html.length === 0) {
          console.log(`❌ External proxy ${i + 1} returned empty response`);
          continue;
        }

        console.log(`✅ External proxy ${i + 1} succeeded`);
        return html;
      } catch (error) {
        console.log(`❌ External proxy ${i + 1} error:`, error);
        continue;
      }
    }
    
    throw new Error('❌ All proxy methods failed. Please start the local proxy server or check your internet connection.');
  }

  extractVideoIds(html: string): string[] {
    const VIDEO_ID_PATTERNS = [
      /"videoId":"([a-zA-Z0-9_-]{11})"/g,
      /\/watch\?v=([a-zA-Z0-9_-]{11})/g,
      /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"/g
    ];

    const videoIds = new Set<string>();
    
    for (const pattern of VIDEO_ID_PATTERNS) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1] && match[1].length === 11) {
          videoIds.add(match[1]);
        }
      }
    }

    return Array.from(videoIds);
  }

  private parseVideoMetadata(html: string, videoIds: string[]): VideoSearchResult[] {
    const METADATA_PATTERNS = {
      title: /"title":\{"runs":\[\{"text":"([^"]+)"/g,
      channelName: /"ownerText":\{"runs":\[\{"text":"([^"]+)"/g,
      duration: /"lengthText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/g,
      viewCount: /"viewCountText":\{"simpleText":"([^"]+)"/g,
      uploadDate: /"publishedTimeText":\{"simpleText":"([^"]+)"/g
    };

    const results: VideoSearchResult[] = [];
    
    // Extract all metadata matches
    const titles = this.extractAllMatches(html, METADATA_PATTERNS.title);
    const channelNames = this.extractAllMatches(html, METADATA_PATTERNS.channelName);
    const durations = this.extractAllMatches(html, METADATA_PATTERNS.duration);
    const viewCounts = this.extractAllMatches(html, METADATA_PATTERNS.viewCount);
    const uploadDates = this.extractAllMatches(html, METADATA_PATTERNS.uploadDate);

    // Match video IDs with metadata (best effort)
    videoIds.forEach((videoId, index) => {
      const title = titles[index] || `Video ${videoId}`;
      const channelName = channelNames[index] || 'Unknown Channel';
      const duration = this.parseDurationFromLabel(durations[index] || '0:00');
      const viewCount = this.parseViewCount(viewCounts[index]);
      const uploadDate = uploadDates[index];

      results.push({
        id: videoId,
        title: this.cleanText(title),
        channelName: this.cleanText(channelName),
        duration,
        viewCount,
        uploadDate,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      });
    });

    return results;
  }

  private extractAllMatches(text: string, pattern: RegExp): string[] {
    const matches: string[] = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        matches.push(match[1]);
      }
    }
    
    return matches;
  }

  private parseDurationFromLabel(label: string): string {
    // Convert accessibility labels like "3 minutes, 45 seconds" to "3:45"
    const minutesMatch = label.match(/(\d+)\s*minutes?/i);
    const secondsMatch = label.match(/(\d+)\s*seconds?/i);
    
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    const seconds = secondsMatch ? parseInt(secondsMatch[1]) : 0;
    
    if (minutes === 0 && seconds === 0) {
      // Try to parse direct time format like "3:45"
      const timeMatch = label.match(/(\d+):(\d+)/);
      if (timeMatch) {
        return `${timeMatch[1]}:${timeMatch[2].padStart(2, '0')}`;
      }
      return '0:00';
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private parseViewCount(viewText?: string): number | undefined {
    if (!viewText) return undefined;
    
    // Remove "views" and commas, handle "K", "M", "B" suffixes
    const cleanText = viewText.replace(/[,\s]/g, '').toLowerCase();
    const numberMatch = cleanText.match(/^([\d.]+)([kmb])?/);
    
    if (!numberMatch) return undefined;
    
    const number = parseFloat(numberMatch[1]);
    const suffix = numberMatch[2];
    
    switch (suffix) {
      case 'k': return Math.floor(number * 1000);
      case 'm': return Math.floor(number * 1000000);
      case 'b': return Math.floor(number * 1000000000);
      default: return Math.floor(number);
    }
  }

  private cleanText(text: string): string {
    // Remove HTML entities and extra whitespace
    return text
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const waitTime = this.REQUEST_DELAY - timeSinceLastRequest;
      console.log(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private async handleRateLimit(): Promise<void> {
    this.rateLimitAttempts++;
    
    // Exponential backoff: 2, 4, 8 seconds
    const delay = Math.min(2000 * Math.pow(2, this.rateLimitAttempts - 1), 8000);
    console.log(`Rate limited, waiting ${delay}ms before retry`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private isRateLimitError(error: any): boolean {
    return error.message?.includes('rate limit') || 
           error.message?.includes('too many requests') ||
           error.message?.includes('429') ||
           (error.status === 429);
  }

  private getRandomUserAgent(): string {
    return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
  }

  private getCacheKey(query: string): string {
    return `youtube_search:${query.toLowerCase().replace(/\s+/g, '_')}`;
  }

  // Caching implementation
  private async getCachedResults(cacheKey: string): Promise<VideoSearchResult[] | null> {
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now > entry.expiry) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return entry.results;
  }

  private async setCachedResults(cacheKey: string, results: VideoSearchResult[]): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry = {
      results,
      timestamp: now,
      expiry: now + this.CACHE_DURATION
    };
    
    this.cache.set(cacheKey, entry);
    
    // Clean expired entries
    this.cleanExpiredCache();
  }

  private async clearExpiredCache(): Promise<void> {
    this.cleanExpiredCache();
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  getLastRateLimitDelay(): number {
    return this.rateLimitAttempts > 0 ? 
      Math.min(2000 * Math.pow(2, this.rateLimitAttempts - 1), 8000) : 0;
  }
}

// Export singleton instance
export const youtubeSearchService = new YouTubeSearchService();