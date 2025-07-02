/**
 * Test fixtures and utilities for track caching system tests
 */
import type { Track } from '../spotify';
import type { CachedTrack, TrackCacheConfig } from '../trackDataCache';

/**
 * Create a mock Track object with sensible defaults
 */
export const createMockTrack = (overrides: Partial<Track> = {}): Track => ({
  id: 'mock-track-123',
  name: 'Mock Song Title',
  artists: 'Mock Artist',
  album: 'Mock Album',
  duration_ms: 210000, // 3:30
  uri: 'spotify:track:mock-track-123',
  preview_url: 'https://p.scdn.co/mp3-preview/mock-preview.mp3',
  image: 'https://i.scdn.co/image/mock-album-art.jpg',
  ...overrides
});

/**
 * Create a mock CachedTrack object with caching metadata
 */
export const createMockCachedTrack = (
  overrides: Partial<CachedTrack> = {},
  baseTime: number = Date.now()
): CachedTrack => ({
  ...createMockTrack(overrides),
  isLiked: undefined,
  likeStatusChecked: undefined,
  metadataFetched: baseTime,
  cacheExpires: baseTime + 10 * 60 * 1000, // 10 minutes default TTL
  lastAccessed: baseTime,
  ...overrides
});

/**
 * Create mock TrackCacheConfig with testing-appropriate defaults
 */
export const createMockCacheConfig = (overrides: Partial<TrackCacheConfig> = {}): Partial<TrackCacheConfig> => ({
  maxSize: 100,
  metadataTtlMs: 10 * 60 * 1000,    // 10 minutes
  likeStatusTtlMs: 5 * 60 * 1000,   // 5 minutes
  enableDebug: false,
  enableLocalStorage: false,
  ...overrides
});

/**
 * Create multiple mock tracks for batch testing
 */
export const createMockTracks = (count: number, baseOverrides: Partial<Track> = {}): Track[] => {
  return Array.from({ length: count }, (_, index) => 
    createMockTrack({
      id: `mock-track-${index + 1}`,
      name: `Mock Song ${index + 1}`,
      artists: `Mock Artist ${index + 1}`,
      album: `Mock Album ${Math.floor(index / 3) + 1}`, // Group tracks into albums
      uri: `spotify:track:mock-track-${index + 1}`,
      ...baseOverrides
    })
  );
};

/**
 * Create mock Spotify API response for a track
 */
export const createMockSpotifyTrackResponse = (track: Track) => ({
  id: track.id,
  name: track.name,
  artists: track.artists.split(', ').map(name => ({ name })),
  album: { 
    name: track.album,
    images: track.image ? [
      { url: track.image, height: 640, width: 640 },
      { url: track.image.replace('640x640', '300x300'), height: 300, width: 300 },
      { url: track.image.replace('640x640', '64x64'), height: 64, width: 64 }
    ] : []
  },
  duration_ms: track.duration_ms,
  uri: track.uri,
  preview_url: track.preview_url,
  type: 'track',
  is_local: false,
  explicit: false,
  popularity: Math.floor(Math.random() * 100),
  external_ids: { isrc: 'MOCK123456789' },
  external_urls: { spotify: `https://open.spotify.com/track/${track.id}` }
});

/**
 * Create mock Spotify API playlist response
 */
export const createMockPlaylistResponse = (tracks: Track[], hasNext: boolean = false) => ({
  items: tracks.map(track => ({
    track: createMockSpotifyTrackResponse(track),
    added_at: new Date().toISOString(),
    added_by: { id: 'mock-user' },
    is_local: false
  })),
  next: hasNext ? 'https://api.spotify.com/v1/playlists/test/tracks?offset=50&limit=50' : null,
  previous: null,
  total: tracks.length,
  limit: 50,
  offset: 0,
  href: 'https://api.spotify.com/v1/playlists/test/tracks'
});

/**
 * Create mock localStorage data for cache persistence testing
 */
export const createMockLocalStorageData = (tracks: CachedTrack[]): string => {
  const cacheEntries = tracks.map(track => [track.id, track]);
  return JSON.stringify(cacheEntries);
};

/**
 * Time manipulation utilities for TTL testing
 */
export const TimeUtils = {
  /**
   * Advance mock time by specified milliseconds
   */
  advanceTime: (mockDateFn: jest.SpyInstance, currentTime: number, advanceMs: number): number => {
    const newTime = currentTime + advanceMs;
    mockDateFn.mockReturnValue(newTime);
    return newTime;
  },

  /**
   * Create time points for TTL testing
   */
  createTimePoints: (baseTime: number) => ({
    start: baseTime,
    likeStatusExpired: baseTime + 6 * 60 * 1000,  // 6 minutes (beyond 5min TTL)
    metadataExpired: baseTime + 11 * 60 * 1000,   // 11 minutes (beyond 10min TTL)
    allExpired: baseTime + 15 * 60 * 1000         // 15 minutes (beyond all TTLs)
  })
};

/**
 * Performance testing utilities
 */
export const PerformanceUtils = {
  /**
   * Measure execution time of an operation
   */
  measureTime: async <T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    return { result, duration: end - start };
  },

  /**
   * Create a large number of operations for stress testing
   */
  createBatchOperations: (count: number, operationFn: (index: number) => Promise<any>): Promise<any>[] => {
    return Array.from({ length: count }, (_, i) => operationFn(i));
  }
};

/**
 * Mock API response utilities
 */
export const MockApiUtils = {
  /**
   * Create successful API response mock
   */
  successResponse: (data: any) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  }),

  /**
   * Create error API response mock
   */
  errorResponse: (status: number, message: string = 'API Error') => ({
    ok: false,
    status,
    statusText: getStatusText(status),
    json: () => Promise.reject(new Error('Response not JSON')),
    text: () => Promise.resolve(message)
  }),

  /**
   * Create network error mock
   */
  networkError: (message: string = 'Network Error') => {
    throw new Error(message);
  },

  /**
   * Create timeout error mock
   */
  timeoutError: () => {
    throw new Error('Request timeout');
  }
};

/**
 * Get HTTP status text for given status code
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  return statusTexts[status] || 'Unknown';
}

/**
 * Cache state assertion utilities
 */
export const CacheAssertions = {
  /**
   * Assert cache contains expected tracks
   */
  assertCacheContains: (cache: any, trackIds: string[]) => {
    trackIds.forEach(id => {
      if (!cache.hasTrack(id)) {
        throw new Error(`Expected cache to contain track ${id}`);
      }
    });
  },

  /**
   * Assert cache does not contain specified tracks
   */
  assertCacheDoesNotContain: (cache: any, trackIds: string[]) => {
    trackIds.forEach(id => {
      if (cache.hasTrack(id)) {
        throw new Error(`Expected cache to NOT contain track ${id}`);
      }
    });
  },

  /**
   * Assert cache size matches expected value
   */
  assertCacheSize: (cache: any, expectedSize: number) => {
    const actualSize = cache.size();
    if (actualSize !== expectedSize) {
      throw new Error(`Expected cache size ${expectedSize}, got ${actualSize}`);
    }
  },

  /**
   * Assert track data matches expected values
   */
  assertTrackData: (actual: Track | null, expected: Track) => {
    if (!actual) {
      throw new Error('Expected track data, got null');
    }
    
    const keys: (keyof Track)[] = ['id', 'name', 'artists', 'album', 'duration_ms', 'uri'];
    keys.forEach(key => {
      if (actual[key] !== expected[key]) {
        throw new Error(`Expected ${key} to be ${expected[key]}, got ${actual[key]}`);
      }
    });
  }
};

/**
 * Common test scenarios for reuse across test files
 */
export const TestScenarios = {
  /**
   * Basic cache hit/miss scenarios
   */
  cacheHitMiss: {
    hit: 'should return cached data when available',
    miss: 'should fetch from API when not cached',
    expired: 'should refetch when cached data is expired'
  },

  /**
   * Error handling scenarios
   */
  errorHandling: {
    apiError: 'should handle API errors gracefully',
    networkError: 'should handle network errors gracefully',
    cacheError: 'should handle cache errors gracefully',
    fallback: 'should fall back to stale cache on API failure'
  },

  /**
   * Performance scenarios
   */
  performance: {
    largeDataset: 'should handle large datasets efficiently',
    concurrent: 'should handle concurrent operations correctly',
    memory: 'should manage memory usage appropriately'
  },

  /**
   * Edge cases
   */
  edgeCases: {
    invalidInput: 'should handle invalid input gracefully',
    emptyData: 'should handle empty data sets',
    malformedData: 'should handle malformed data gracefully'
  }
};

/**
 * Default test timeout for async operations
 */
export const TEST_TIMEOUTS = {
  fast: 1000,     // 1 second for fast operations
  medium: 5000,   // 5 seconds for medium operations
  slow: 10000,    // 10 seconds for slow operations
  stress: 30000   // 30 seconds for stress tests
} as const;