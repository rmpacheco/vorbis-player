import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  TrackDataCacheService, 
  CachedTrack, 
  TrackCacheConfig, 
  getTrackDataCache, 
  resetTrackDataCache 
} from '../trackDataCache';
import type { Track } from '../spotify';

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

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};
Object.defineProperty(console, 'log', { value: mockConsole.log });
Object.defineProperty(console, 'warn', { value: mockConsole.warn });
Object.defineProperty(console, 'error', { value: mockConsole.error });

// Mock setInterval and clearInterval for cleanup timer
const mockSetInterval = vi.fn(() => 'timer-id-123');
const mockClearInterval = vi.fn();
Object.defineProperty(global, 'setInterval', { value: mockSetInterval });
Object.defineProperty(global, 'clearInterval', { value: mockClearInterval });

describe('TrackDataCacheService', () => {
  let cacheService: TrackDataCacheService;
  let mockDate: number;

  // Test fixtures
  const createMockTrack = (overrides: Partial<Track> = {}): Track => ({
    id: 'track123',
    name: 'Test Song',
    artists: 'Test Artist',
    album: 'Test Album',
    duration_ms: 210000,
    uri: 'spotify:track:track123',
    preview_url: 'https://example.com/preview.mp3',
    image: 'https://example.com/image.jpg',
    ...overrides
  });

  const createMockConfig = (overrides: Partial<TrackCacheConfig> = {}): Partial<TrackCacheConfig> => ({
    maxSize: 100,
    metadataTtlMs: 10 * 60 * 1000, // 10 minutes
    likeStatusTtlMs: 5 * 60 * 1000, // 5 minutes
    enableDebug: false,
    enableLocalStorage: false,
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetTrackDataCache();
    mockDate = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(mockDate);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetTrackDataCache();
  });

  describe('Cache Initialization', () => {
    it('should initialize with default configuration', () => {
      cacheService = getTrackDataCache();
      
      expect(cacheService).toBeDefined();
      expect(cacheService.size()).toBe(0);
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
    });

    it('should initialize with custom configuration', () => {
      const config = createMockConfig({
        maxSize: 50,
        metadataTtlMs: 5 * 60 * 1000,
        enableDebug: true
      });
      
      cacheService = getTrackDataCache(config);
      
      expect(cacheService).toBeDefined();
      expect(cacheService.size()).toBe(0);
    });

    it('should load from localStorage when enabled', () => {
      const storedData = [
        ['track1', { id: 'track1', name: 'Song 1', artists: 'Artist 1', album: 'Album 1', duration_ms: 180000, uri: 'spotify:track:track1' }]
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedData));

      cacheService = getTrackDataCache({ enableLocalStorage: true });
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('vorbis-player-track-cache');
      expect(cacheService.size()).toBe(1);
      expect(cacheService.hasTrack('track1')).toBe(true);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      cacheService = getTrackDataCache({ enableLocalStorage: true });
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('vorbis-player-track-cache');
      expect(cacheService.size()).toBe(0);
    });
  });

  describe('Track Operations', () => {
    beforeEach(() => {
      cacheService = getTrackDataCache(createMockConfig());
    });

    describe('setTrack', () => {
      it('should cache a track with correct metadata', () => {
        const track = createMockTrack();
        
        cacheService.setTrack(track);
        
        expect(cacheService.size()).toBe(1);
        expect(cacheService.hasTrack(track.id)).toBe(true);
        
        const cached = cacheService.getTrack(track.id);
        expect(cached).toMatchObject(track);
        expect(cached?.metadataFetched).toBe(mockDate);
        expect(cached?.cacheExpires).toBe(mockDate + 10 * 60 * 1000);
        expect(cached?.lastAccessed).toBe(mockDate);
      });

      it('should preserve existing like status when updating track', () => {
        const track = createMockTrack();
        
        // First set like status
        cacheService.setLikeStatus(track.id, true);
        
        // Then set track data
        cacheService.setTrack(track);
        
        const cached = cacheService.getTrack(track.id);
        expect(cached?.isLiked).toBe(true);
        expect(cached?.likeStatusChecked).toBeDefined();
      });

      it('should not preserve expired like status', () => {
        const track = createMockTrack();
        
        // Set like status in the past
        vi.spyOn(Date, 'now').mockReturnValue(mockDate - 10 * 60 * 1000);
        cacheService.setLikeStatus(track.id, true);
        
        // Update track data in present
        vi.spyOn(Date, 'now').mockReturnValue(mockDate);
        cacheService.setTrack(track);
        
        const cached = cacheService.getTrack(track.id);
        expect(cached?.isLiked).toBeUndefined();
      });

      it('should handle invalid track data', () => {
        // @ts-expect-error Testing invalid input
        cacheService.setTrack(null);
        expect(cacheService.size()).toBe(0);
        
        // @ts-expect-error Testing invalid input
        cacheService.setTrack({ name: 'No ID' });
        expect(cacheService.size()).toBe(0);
      });

      it('should save to localStorage when enabled', () => {
        // Reset singleton and create fresh instance with localStorage enabled
        resetTrackDataCache();
        mockLocalStorage.setItem.mockClear();
        cacheService = getTrackDataCache({ enableLocalStorage: true });
        const track = createMockTrack();
        
        cacheService.setTrack(track);
        
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'vorbis-player-track-cache',
          expect.any(String)
        );
      });
    });

    describe('getTrack', () => {
      it('should return cached track and update access time', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        // Advance time
        const laterTime = mockDate + 1000;
        vi.spyOn(Date, 'now').mockReturnValue(laterTime);
        
        const cached = cacheService.getTrack(track.id);
        
        expect(cached).toMatchObject(track);
        expect(cached?.lastAccessed).toBe(laterTime);
      });

      it('should return null for non-existent track', () => {
        const result = cacheService.getTrack('nonexistent');
        expect(result).toBeNull();
      });

      it('should return null for expired track', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        // Advance time beyond expiration
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 15 * 60 * 1000);
        
        const result = cacheService.getTrack(track.id);
        expect(result).toBeNull();
        expect(cacheService.hasTrack(track.id)).toBe(false);
      });

      it('should handle invalid track ID', () => {
        expect(cacheService.getTrack('')).toBeNull();
        expect(cacheService.getTrack(null as any)).toBeNull();
      });

      it('should return a copy to prevent mutation', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        const cached1 = cacheService.getTrack(track.id);
        const cached2 = cacheService.getTrack(track.id);
        
        expect(cached1).not.toBe(cached2);
        expect(cached1).toEqual(cached2);
      });
    });

    describe('updateTrack', () => {
      it('should update specific fields of cached track', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        const updates = { name: 'Updated Song Name', artists: 'Updated Artist' };
        cacheService.updateTrack(track.id, updates);
        
        const cached = cacheService.getTrack(track.id);
        expect(cached?.name).toBe('Updated Song Name');
        expect(cached?.artists).toBe('Updated Artist');
        expect(cached?.album).toBe(track.album); // Unchanged
      });

      it('should update metadata timestamps when metadata fields change', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        const updateTime = mockDate + 1000;
        vi.spyOn(Date, 'now').mockReturnValue(updateTime);
        
        cacheService.updateTrack(track.id, { name: 'New Name' });
        
        const cached = cacheService.getTrack(track.id);
        expect(cached?.metadataFetched).toBe(updateTime);
        expect(cached?.cacheExpires).toBe(updateTime + 10 * 60 * 1000);
      });

      it('should update like status timestamp when like status changes', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        const updateTime = mockDate + 1000;
        vi.spyOn(Date, 'now').mockReturnValue(updateTime);
        
        cacheService.updateTrack(track.id, { isLiked: true });
        
        const cached = cacheService.getTrack(track.id);
        expect(cached?.isLiked).toBe(true);
        expect(cached?.likeStatusChecked).toBe(updateTime);
      });

      it('should handle non-existent track', () => {
        cacheService.updateTrack('nonexistent', { name: 'New Name' });
        expect(cacheService.size()).toBe(0);
      });

      it('should handle invalid track ID', () => {
        cacheService.updateTrack('', { name: 'New Name' });
        cacheService.updateTrack(null as any, { name: 'New Name' });
        expect(cacheService.size()).toBe(0);
      });
    });

    describe('delete', () => {
      it('should remove track from cache', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        expect(cacheService.hasTrack(track.id)).toBe(true);
        
        cacheService.delete(track.id);
        
        expect(cacheService.hasTrack(track.id)).toBe(false);
        expect(cacheService.size()).toBe(0);
      });

      it('should handle non-existent track deletion', () => {
        cacheService.delete('nonexistent');
        expect(cacheService.size()).toBe(0);
      });

      it('should save to localStorage when enabled', () => {
        // Reset singleton and create fresh instance with localStorage enabled
        resetTrackDataCache();
        cacheService = getTrackDataCache({ enableLocalStorage: true });
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        // Clear after initial save, then delete should trigger another save
        mockLocalStorage.setItem.mockClear();
        cacheService.delete(track.id);
        
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
      });
    });

    describe('clear', () => {
      it('should clear all tracks from cache', () => {
        const track1 = createMockTrack({ id: 'track1' });
        const track2 = createMockTrack({ id: 'track2' });
        
        cacheService.setTrack(track1);
        cacheService.setTrack(track2);
        expect(cacheService.size()).toBe(2);
        
        cacheService.clear();
        expect(cacheService.size()).toBe(0);
      });

      it('should clear localStorage when enabled', () => {
        // Reset singleton and create fresh instance with localStorage enabled
        resetTrackDataCache();
        cacheService = getTrackDataCache({ enableLocalStorage: true });
        
        // Clear previous mocks
        mockLocalStorage.removeItem.mockClear();
        cacheService.clear();
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('vorbis-player-track-cache');
      });
    });
  });

  describe('Like Status Operations', () => {
    beforeEach(() => {
      cacheService = getTrackDataCache(createMockConfig());
    });

    describe('setLikeStatus', () => {
      it('should set like status for existing track', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        cacheService.setLikeStatus(track.id, true);
        
        const cached = cacheService.getTrack(track.id);
        expect(cached?.isLiked).toBe(true);
        expect(cached?.likeStatusChecked).toBe(mockDate);
      });

      it('should create minimal cache entry for new track', () => {
        const trackId = 'new-track';
        
        cacheService.setLikeStatus(trackId, false);
        
        expect(cacheService.hasTrack(trackId)).toBe(true);
        const cached = cacheService.getTrack(trackId);
        expect(cached?.id).toBe(trackId);
        expect(cached?.isLiked).toBe(false);
        expect(cached?.name).toBe('');
      });

      it('should handle invalid track ID', () => {
        cacheService.setLikeStatus('', true);
        cacheService.setLikeStatus(null as any, true);
        expect(cacheService.size()).toBe(0);
      });
    });

    describe('getLikeStatus', () => {
      it('should return cached like status', () => {
        const trackId = 'track123';
        cacheService.setLikeStatus(trackId, true);
        
        expect(cacheService.getLikeStatus(trackId)).toBe(true);
      });

      it('should return null for non-existent track', () => {
        expect(cacheService.getLikeStatus('nonexistent')).toBeNull();
      });

      it('should return null for expired like status', () => {
        const trackId = 'track123';
        cacheService.setLikeStatus(trackId, true);
        
        // Advance time beyond like status TTL
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 10 * 60 * 1000);
        
        expect(cacheService.getLikeStatus(trackId)).toBeNull();
      });

      it('should update access time when retrieving like status', () => {
        const trackId = 'track123';
        cacheService.setLikeStatus(trackId, true);
        
        const laterTime = mockDate + 1000;
        vi.spyOn(Date, 'now').mockReturnValue(laterTime);
        
        cacheService.getLikeStatus(trackId);
        
        const cached = cacheService.getTrack(trackId);
        expect(cached?.lastAccessed).toBe(laterTime);
      });

      it('should handle invalid track ID', () => {
        expect(cacheService.getLikeStatus('')).toBeNull();
        expect(cacheService.getLikeStatus(null as any)).toBeNull();
      });
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      cacheService = getTrackDataCache(createMockConfig({ maxSize: 3 }));
    });

    describe('LRU Eviction', () => {
      it('should evict least recently used tracks when cache is full', () => {
        // Fill cache to capacity
        const track1 = createMockTrack({ id: 'track1' });
        const track2 = createMockTrack({ id: 'track2' });
        const track3 = createMockTrack({ id: 'track3' });
        
        cacheService.setTrack(track1);
        cacheService.setTrack(track2);
        cacheService.setTrack(track3);
        expect(cacheService.size()).toBe(3);
        
        // Access track2 to make it more recent
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 1000);
        cacheService.getTrack('track2');
        
        // Add new track, should evict track1 (oldest)
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 2000);
        const track4 = createMockTrack({ id: 'track4' });
        cacheService.setTrack(track4);
        
        expect(cacheService.size()).toBe(3);
        expect(cacheService.hasTrack('track1')).toBe(false); // Evicted
        expect(cacheService.hasTrack('track2')).toBe(true);  // Kept (accessed recently)
        expect(cacheService.hasTrack('track3')).toBe(true);  // Kept
        expect(cacheService.hasTrack('track4')).toBe(true);  // New
      });

      it('should handle eviction correctly with like status entries', () => {
        // Fill cache with like status entries
        cacheService.setLikeStatus('track1', true);
        cacheService.setLikeStatus('track2', false);
        cacheService.setLikeStatus('track3', true);
        expect(cacheService.size()).toBe(3);
        
        // Add new track, should evict oldest
        const track4 = createMockTrack({ id: 'track4' });
        cacheService.setTrack(track4);
        
        expect(cacheService.size()).toBe(3);
        expect(cacheService.hasTrack('track1')).toBe(false);
      });
    });

    describe('cleanup', () => {
      it('should remove expired entries', () => {
        const track1 = createMockTrack({ id: 'track1' });
        const track2 = createMockTrack({ id: 'track2' });
        
        cacheService.setTrack(track1);
        cacheService.setTrack(track2);
        expect(cacheService.size()).toBe(2);
        
        // Advance time to expire track1
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 15 * 60 * 1000);
        
        const removedCount = cacheService.cleanup();
        
        expect(removedCount).toBeGreaterThan(0);
        expect(cacheService.size()).toBeLessThan(2);
      });

      it('should remove entries where both metadata and like status are expired', () => {
        const trackId = 'track1';
        
        // Set track first with old timestamp
        vi.spyOn(Date, 'now').mockReturnValue(mockDate);
        const track = createMockTrack({ id: trackId });
        cacheService.setTrack(track);
        cacheService.setLikeStatus(trackId, true);
        
        // Now advance time to expire both metadata and like status
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 15 * 60 * 1000);
        
        const removedCount = cacheService.cleanup();
        expect(removedCount).toBe(1);
        expect(cacheService.hasTrack(trackId)).toBe(false);
      });

      it('should not remove entries with only one expired data type', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        cacheService.setLikeStatus(track.id, true);
        
        // Advance time to expire only like status
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 6 * 60 * 1000);
        
        const removedCount = cacheService.cleanup();
        expect(removedCount).toBe(0);
        expect(cacheService.hasTrack(track.id)).toBe(true);
      });
    });

    describe('isExpired', () => {
      it('should check metadata expiration correctly', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        expect(cacheService.isExpired(track.id, 'metadata')).toBe(false);
        
        // Advance time beyond metadata TTL
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 15 * 60 * 1000);
        
        expect(cacheService.isExpired(track.id, 'metadata')).toBe(true);
      });

      it('should check like status expiration correctly', () => {
        const trackId = 'track123';
        cacheService.setLikeStatus(trackId, true);
        
        expect(cacheService.isExpired(trackId, 'likeStatus')).toBe(false);
        
        // Advance time beyond like status TTL
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 10 * 60 * 1000);
        
        expect(cacheService.isExpired(trackId, 'likeStatus')).toBe(true);
      });

      it('should check overall expiration when no data type specified', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        expect(cacheService.isExpired(track.id)).toBe(false);
        
        // Advance time beyond overall cache expiration
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 15 * 60 * 1000);
        
        expect(cacheService.isExpired(track.id)).toBe(true);
      });

      it('should return true for non-existent tracks', () => {
        expect(cacheService.isExpired('nonexistent')).toBe(true);
        expect(cacheService.isExpired('nonexistent', 'metadata')).toBe(true);
        expect(cacheService.isExpired('nonexistent', 'likeStatus')).toBe(true);
      });

      it('should return true for invalid track IDs', () => {
        expect(cacheService.isExpired('')).toBe(true);
        expect(cacheService.isExpired(null as any)).toBe(true);
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      cacheService = getTrackDataCache(createMockConfig());
    });

    describe('hasTrack', () => {
      it('should return true for existing tracks', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        expect(cacheService.hasTrack(track.id)).toBe(true);
      });

      it('should return false for non-existent tracks', () => {
        expect(cacheService.hasTrack('nonexistent')).toBe(false);
      });

      it('should return false for invalid track IDs', () => {
        expect(cacheService.hasTrack('')).toBe(false);
        expect(cacheService.hasTrack(null as any)).toBe(false);
      });

      it('should return true even for expired tracks', () => {
        const track = createMockTrack();
        cacheService.setTrack(track);
        
        // Advance time to expire track
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + 15 * 60 * 1000);
        
        expect(cacheService.hasTrack(track.id)).toBe(true);
        expect(cacheService.getTrack(track.id)).toBeNull(); // But getTrack returns null
      });
    });

    describe('size', () => {
      it('should return correct cache size', () => {
        expect(cacheService.size()).toBe(0);
        
        const track1 = createMockTrack({ id: 'track1' });
        const track2 = createMockTrack({ id: 'track2' });
        
        cacheService.setTrack(track1);
        expect(cacheService.size()).toBe(1);
        
        cacheService.setTrack(track2);
        expect(cacheService.size()).toBe(2);
        
        cacheService.delete(track1.id);
        expect(cacheService.size()).toBe(1);
        
        cacheService.clear();
        expect(cacheService.size()).toBe(0);
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large numbers of cache operations efficiently', () => {
      cacheService = getTrackDataCache(createMockConfig({ maxSize: 1000 }));
      
      const startTime = performance.now();
      
      // Add many tracks
      for (let i = 0; i < 500; i++) {
        const track = createMockTrack({ id: `track${i}`, name: `Song ${i}` });
        cacheService.setTrack(track);
      }
      
      // Access many tracks
      for (let i = 0; i < 250; i++) {
        cacheService.getTrack(`track${i}`);
      }
      
      // Update many like statuses
      for (let i = 250; i < 500; i++) {
        cacheService.setLikeStatus(`track${i}`, i % 2 === 0);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(cacheService.size()).toBe(500);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle concurrent access patterns', () => {
      cacheService = getTrackDataCache(createMockConfig());
      const trackId = 'concurrent-track';
      
      // Simulate concurrent operations
      const track = createMockTrack({ id: trackId });
      cacheService.setTrack(track);
      
      // Multiple rapid accesses
      for (let i = 0; i < 10; i++) {
        vi.spyOn(Date, 'now').mockReturnValue(mockDate + i * 100);
        cacheService.getTrack(trackId);
        cacheService.setLikeStatus(trackId, i % 2 === 0);
      }
      
      const cached = cacheService.getTrack(trackId);
      expect(cached).toBeDefined();
      expect(cached?.isLiked).toBe(false); // Last operation was i=9, 9%2 !== 0
    });

    it('should cleanup efficiently with many expired entries', () => {
      cacheService = getTrackDataCache(createMockConfig({ maxSize: 1000 }));
      
      // Add many tracks
      for (let i = 0; i < 100; i++) {
        const track = createMockTrack({ id: `track${i}` });
        cacheService.setTrack(track);
      }
      
      expect(cacheService.size()).toBe(100);
      
      // Advance time to expire everything
      vi.spyOn(Date, 'now').mockReturnValue(mockDate + 20 * 60 * 1000);
      
      const removedCount = cacheService.cleanup();
      
      expect(removedCount).toBe(100);
      expect(cacheService.size()).toBe(0);
    });
  });

  describe('Configuration Changes', () => {
    it('should respect different TTL configurations', () => {
      const shortTtlConfig = createMockConfig({
        metadataTtlMs: 1000,    // 1 second
        likeStatusTtlMs: 500,  // 0.5 seconds
      });
      
      cacheService = getTrackDataCache(shortTtlConfig);
      
      const track = createMockTrack();
      cacheService.setTrack(track);
      cacheService.setLikeStatus(track.id, true);
      
      // Advance time slightly
      vi.spyOn(Date, 'now').mockReturnValue(mockDate + 600);
      
      expect(cacheService.isExpired(track.id, 'likeStatus')).toBe(true);
      expect(cacheService.isExpired(track.id, 'metadata')).toBe(false);
      
      // Advance time more
      vi.spyOn(Date, 'now').mockReturnValue(mockDate + 1100);
      
      expect(cacheService.isExpired(track.id, 'metadata')).toBe(true);
    });

    it('should respect different max size configurations', () => {
      cacheService = getTrackDataCache(createMockConfig({ maxSize: 2 }));
      
      const track1 = createMockTrack({ id: 'track1' });
      const track2 = createMockTrack({ id: 'track2' });
      const track3 = createMockTrack({ id: 'track3' });
      
      cacheService.setTrack(track1);
      cacheService.setTrack(track2);
      expect(cacheService.size()).toBe(2);
      
      cacheService.setTrack(track3);
      expect(cacheService.size()).toBe(2); // Should evict oldest
      expect(cacheService.hasTrack('track1')).toBe(false);
    });

    it('should handle debug mode configuration', () => {
      cacheService = getTrackDataCache(createMockConfig({ enableDebug: true }));
      
      const track = createMockTrack();
      cacheService.setTrack(track);
      
      expect(mockConsole.log).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      cacheService = getTrackDataCache(createMockConfig());
    });

    it('should handle null and undefined values gracefully', () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        cacheService.setTrack(null);
        // @ts-expect-error Testing invalid input
        cacheService.setTrack(undefined);
        // @ts-expect-error Testing invalid input
        cacheService.updateTrack(null, {});
        // @ts-expect-error Testing invalid input
        cacheService.setLikeStatus(undefined, true);
      }).not.toThrow();
      
      expect(cacheService.size()).toBe(0);
    });

    it('should handle extremely large cache sizes', () => {
      const maxSize = 5000;
      resetTrackDataCache();
      cacheService = getTrackDataCache(createMockConfig({ maxSize }));
      
      // This should not cause memory issues or infinite loops
      for (let i = 0; i < maxSize; i++) {
        const track = createMockTrack({ id: `track${i}` });
        cacheService.setTrack(track);
      }
      
      expect(cacheService.size()).toBe(maxSize);
    });

    it('should handle tracks with missing optional fields', () => {
      const minimalTrack: Track = {
        id: 'minimal',
        name: 'Minimal Track',
        artists: 'Artist',
        album: 'Album',
        duration_ms: 180000,
        uri: 'spotify:track:minimal'
        // Missing preview_url and image
      };
      
      cacheService.setTrack(minimalTrack);
      
      const cached = cacheService.getTrack('minimal');
      expect(cached).toMatchObject(minimalTrack);
      expect(cached?.preview_url).toBeUndefined();
      expect(cached?.image).toBeUndefined();
    });

    it('should handle time going backwards', () => {
      const track = createMockTrack();
      cacheService.setTrack(track);
      
      // Simulate time going backwards (system clock change)
      vi.spyOn(Date, 'now').mockReturnValue(mockDate - 1000);
      
      // Should still work without errors
      const cached = cacheService.getTrack(track.id);
      expect(cached).toBeDefined();
      
      cacheService.setLikeStatus(track.id, true);
      expect(cacheService.getLikeStatus(track.id)).toBe(true);
    });
  });

  describe('Singleton Behavior', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = getTrackDataCache();
      const instance2 = getTrackDataCache();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton correctly', () => {
      const instance1 = getTrackDataCache();
      instance1.setTrack(createMockTrack());
      expect(instance1.size()).toBe(1);
      
      resetTrackDataCache();
      
      const instance2 = getTrackDataCache();
      expect(instance2.size()).toBe(0);
      expect(instance1).not.toBe(instance2);
    });

    it('should handle destruction correctly', () => {
      // Create a fresh instance that will have setInterval called
      resetTrackDataCache();
      mockSetInterval.mockClear();
      mockClearInterval.mockClear();
      
      const instance = getTrackDataCache();
      instance.setTrack(createMockTrack());
      
      // Verify setInterval was called during initialization
      expect(mockSetInterval).toHaveBeenCalled();
      
      resetTrackDataCache();
      
      // Now clearInterval should have been called during destruction
      expect(mockClearInterval).toHaveBeenCalled();
    });
  });
});