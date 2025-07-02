import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  checkTrackSaved, 
  saveTrack, 
  unsaveTrack, 
  getPlaylistTracks,
  getCachedTrack,
  getCachedLikeStatus,
  spotifyAuth,
  type Track
} from '../spotify';
import { resetTrackDataCache, getTrackDataCache, trackDataCache } from '../trackDataCache';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock console methods to avoid noise in tests
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};
Object.defineProperty(console, 'log', { value: mockConsole.log });
Object.defineProperty(console, 'warn', { value: mockConsole.warn });
Object.defineProperty(console, 'error', { value: mockConsole.error });

describe('Spotify Service Cache Integration', () => {
  let mockDate: number;

  // Test fixtures
  const mockToken = 'mock-access-token';
  const mockTrackId = 'spotify-track-123';
  const mockPlaylistId = 'playlist-456';

  const createMockTrack = (overrides: Partial<Track> = {}): Track => ({
    id: mockTrackId,
    name: 'Test Song',
    artists: 'Test Artist',
    album: 'Test Album',
    duration_ms: 210000,
    uri: `spotify:track:${mockTrackId}`,
    preview_url: 'https://example.com/preview.mp3',
    image: 'https://example.com/image.jpg',
    ...overrides
  });

  const createMockSpotifyTrackResponse = (track: Track) => ({
    id: track.id,
    name: track.name,
    artists: [{ name: track.artists }],
    album: { 
      name: track.album,
      images: track.image ? [{ url: track.image }] : []
    },
    duration_ms: track.duration_ms,
    uri: track.uri,
    preview_url: track.preview_url,
    type: 'track'
  });

  const createMockPlaylistResponse = (tracks: Track[]) => ({
    items: tracks.map(track => ({
      track: createMockSpotifyTrackResponse(track)
    })),
    next: null
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetTrackDataCache();
    mockDate = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(mockDate);

    // Mock spotifyAuth.ensureValidToken to return a valid token
    vi.spyOn(spotifyAuth, 'ensureValidToken').mockResolvedValue(mockToken);
    
    // Reset localStorage mocks
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    mockLocalStorage.clear.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetTrackDataCache();
  });

  describe('Cache Hit/Miss Scenarios', () => {
    it('should cache like status after API call', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([true])
      });

      const result1 = await checkTrackSaved(mockTrackId);
      expect(result1).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      mockFetch.mockClear();
      const result2 = await checkTrackSaved(mockTrackId);
      expect(result2).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled(); // Should not call API again
    });

    it('should make API call when cache is expired', async () => {
      // Initial call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([false])
      });

      await checkTrackSaved(mockTrackId);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time beyond like status TTL (5 minutes)
      vi.spyOn(Date, 'now').mockReturnValue(mockDate + 6 * 60 * 1000);

      // Mock API response with different result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([true])
      });

      const result = await checkTrackSaved(mockTrackId);
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Should call API again
    });

    it('should cache track data from playlist fetch', async () => {
      const tracks = [
        createMockTrack({ id: 'track1', name: 'Song 1' }),
        createMockTrack({ id: 'track2', name: 'Song 2' })
      ];
      
      const mockResponse = createMockPlaylistResponse(tracks);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await getPlaylistTracks(mockPlaylistId);

      expect(result).toHaveLength(2);
      
      // Verify tracks can be retrieved from cache
      const cachedTrack1 = getCachedTrack('track1');
      const cachedTrack2 = getCachedTrack('track2');
      
      expect(cachedTrack1).not.toBeNull();
      expect(cachedTrack2).not.toBeNull();
      expect(cachedTrack1?.name).toBe('Song 1');
      expect(cachedTrack2?.name).toBe('Song 2');
    });
  });

  describe('Cache Consistency After Operations', () => {
    it('should update cache after save/unsave operations', async () => {
      // Initial state - not liked
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([false])
      });

      let result = await checkTrackSaved(mockTrackId);
      expect(result).toBe(false);

      // Save track
      mockFetch.mockResolvedValueOnce({ ok: true });
      await saveTrack(mockTrackId);

      // Check cached status without API call
      mockFetch.mockClear();
      result = await checkTrackSaved(mockTrackId);
      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();

      // Unsave track
      mockFetch.mockResolvedValueOnce({ ok: true });
      await unsaveTrack(mockTrackId);

      // Check cached status again
      mockFetch.mockClear();
      result = await checkTrackSaved(mockTrackId);
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling with Cache Fallback', () => {
    it('should use stale cache on API failure', async () => {
      // First, cache a value
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([true])
      });

      await checkTrackSaved(mockTrackId);

      // Advance time to expire cache
      vi.spyOn(Date, 'now').mockReturnValue(mockDate + 10 * 60 * 1000);

      // Mock API failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkTrackSaved(mockTrackId);
      expect(result).toBe(true); // Should return stale cached value
    });

    it('should handle API errors appropriately when no cache available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(checkTrackSaved(mockTrackId)).rejects.toThrow(
        'Failed to check track saved status: 401'
      );
    });
  });

  describe('Performance Benefits', () => {
    it('should be faster with cache hits', async () => {
      // Initial API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([true])
      });

      await checkTrackSaved(mockTrackId);

      // Measure cached calls
      const start = performance.now();
      
      for (let i = 0; i < 10; i++) {
        await checkTrackSaved(mockTrackId);
      }
      
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(50); // Should be very fast
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial call
    });
  });

  describe('Cache Utility Functions', () => {
    it('should return cached track data when available', async () => {
      const tracks = [createMockTrack()];
      const mockResponse = createMockPlaylistResponse(tracks);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await getPlaylistTracks(mockPlaylistId);
      
      const cached = getCachedTrack(mockTrackId);
      expect(cached).toEqual(tracks[0]);
    });

    it('should return null for non-cached tracks', () => {
      const result = getCachedTrack('nonexistent');
      expect(result).toBeNull();
    });

    it('should return cached like status when available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([true])
      });

      await checkTrackSaved(mockTrackId);
      
      const cached = getCachedLikeStatus(mockTrackId);
      expect(cached).toBe(true);
    });

    it('should return null for non-cached like status', () => {
      const result = getCachedLikeStatus('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Pagination Handling', () => {
    it('should cache tracks from multiple pages', async () => {
      const page1Tracks = [createMockTrack({ id: 'track1', name: 'Song 1' })];
      const page2Tracks = [createMockTrack({ id: 'track2', name: 'Song 2' })];
      
      const mockResponse1 = {
        items: page1Tracks.map(track => ({
          track: createMockSpotifyTrackResponse(track)
        })),
        next: 'https://api.spotify.com/v1/playlists/test/tracks?offset=1&limit=50'
      };
      
      const mockResponse2 = {
        items: page2Tracks.map(track => ({
          track: createMockSpotifyTrackResponse(track)
        })),
        next: null
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse1)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse2)
        });

      const result = await getPlaylistTracks(mockPlaylistId);

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Verify both tracks are cached
      expect(getCachedTrack('track1')).not.toBeNull();
      expect(getCachedTrack('track2')).not.toBeNull();
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should handle mixed operations efficiently', async () => {
      // Initial playlist load
      const tracks = [
        createMockTrack({ id: 'track1' }),
        createMockTrack({ id: 'track2' })
      ];
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockPlaylistResponse(tracks))
      });

      await getPlaylistTracks(mockPlaylistId);

      // Check like status for first track (not cached)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([false])
      });

      const likeStatus = await checkTrackSaved('track1');
      expect(likeStatus).toBe(false);

      // Save the track
      mockFetch.mockResolvedValueOnce({ ok: true });
      await saveTrack('track1');

      // All subsequent operations should use cache
      mockFetch.mockClear();
      
      const cachedTrack = getCachedTrack('track1');
      const cachedLikeStatus = getCachedLikeStatus('track1');
      const stillLiked = await checkTrackSaved('track1');

      expect(cachedTrack).not.toBeNull();
      expect(cachedLikeStatus).toBe(true);
      expect(stillLiked).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled(); // No API calls needed
    });
  });
});