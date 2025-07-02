import type { Track } from '../types/track';

/**
 * Enhanced track data interface that includes caching metadata and like status
 */
export interface CachedTrack extends Track {
  /** Whether the track is liked by the user */
  isLiked?: boolean;
  /** Timestamp when like status was last checked */
  likeStatusChecked?: number;
  /** Timestamp when metadata was fetched */
  metadataFetched?: number;
  /** Overall cache expiration timestamp */
  cacheExpires?: number;
  /** Last access timestamp for LRU eviction */
  lastAccessed?: number;
}

/**
 * Configuration options for the track cache
 */
export interface TrackCacheConfig {
  /** Maximum number of tracks to cache (default: 2000) */
  maxSize: number;
  /** TTL for track metadata in milliseconds (default: 10 minutes) */
  metadataTtlMs: number;
  /** TTL for like status in milliseconds (default: 5 minutes) */
  likeStatusTtlMs: number;
  /** Enable debug logging (default: false) */
  enableDebug: boolean;
  /** Enable localStorage persistence (default: false) */
  enableLocalStorage: boolean;
}

/**
 * Service interface for track data caching operations
 */
export interface TrackDataCacheService {
  // Track operations
  getTrack(trackId: string): CachedTrack | null;
  setTrack(track: Track): void;
  updateTrack(trackId: string, updates: Partial<CachedTrack>): void;
  
  // Like status operations
  getLikeStatus(trackId: string): boolean | null;
  setLikeStatus(trackId: string, isLiked: boolean): void;
  
  // Cache management
  delete(trackId: string): void;
  clear(): void;
  size(): number;
  cleanup(): number;
  
  // Utility methods
  hasTrack(trackId: string): boolean;
  isExpired(trackId: string, dataType?: 'metadata' | 'likeStatus'): boolean;
}

/**
 * Comprehensive track data caching service with TTL support, LRU eviction,
 * and selective updates for optimal memory usage and performance.
 */
class TrackDataCacheServiceImpl implements TrackDataCacheService {
  private cache: Map<string, CachedTrack> = new Map();
  private config: TrackCacheConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<TrackCacheConfig>) {
    this.config = {
      maxSize: 2000,
      metadataTtlMs: 10 * 60 * 1000, // 10 minutes
      likeStatusTtlMs: 5 * 60 * 1000, // 5 minutes
      enableDebug: false,
      enableLocalStorage: false,
      ...config
    };

    // Start periodic cleanup
    this.startPeriodicCleanup();

    // Load from localStorage if enabled
    if (this.config.enableLocalStorage) {
      this.loadFromLocalStorage();
    }

    this.debug('TrackDataCache initialized', {
      maxSize: this.config.maxSize,
      metadataTtlMs: this.config.metadataTtlMs,
      likeStatusTtlMs: this.config.likeStatusTtlMs
    });
  }

  /**
   * Get a cached track by ID
   * @param trackId - The Spotify track ID
   * @returns The cached track or null if not found/expired
   */
  getTrack(trackId: string): CachedTrack | null {
    if (!trackId) {
      this.debug('getTrack: Invalid trackId provided');
      return null;
    }

    const cached = this.cache.get(trackId);
    if (!cached) {
      this.debug(`getTrack: Track ${trackId} not found in cache`);
      return null;
    }

    // Update last accessed time for LRU
    cached.lastAccessed = Date.now();

    // Check if overall cache entry is expired
    if (this.isExpired(trackId)) {
      this.debug(`getTrack: Track ${trackId} cache expired, removing`);
      this.cache.delete(trackId);
      return null;
    }

    this.debug(`getTrack: Retrieved track ${trackId} from cache`);
    return { ...cached }; // Return a copy to prevent external mutation
  }

  /**
   * Cache a complete track object
   * @param track - The track to cache
   */
  setTrack(track: Track): void {
    if (!track?.id) {
      this.debug('setTrack: Invalid track provided');
      return;
    }

    const now = Date.now();
    const cachedTrack: CachedTrack = {
      ...track,
      metadataFetched: now,
      cacheExpires: now + this.config.metadataTtlMs,
      lastAccessed: now
    };

    // Preserve existing like status if present and not expired
    const existing = this.cache.get(track.id);
    if (existing && !this.isExpired(track.id, 'likeStatus')) {
      cachedTrack.isLiked = existing.isLiked;
      cachedTrack.likeStatusChecked = existing.likeStatusChecked;
    }

    this.cache.set(track.id, cachedTrack);
    this.debug(`setTrack: Cached track ${track.id}`, { name: track.name });

    // Check if we need to evict entries
    this.enforceMaxSize();

    // Persist to localStorage if enabled
    if (this.config.enableLocalStorage) {
      this.saveToLocalStorage();
    }
  }

  /**
   * Update specific fields of a cached track
   * @param trackId - The track ID to update
   * @param updates - Partial updates to apply
   */
  updateTrack(trackId: string, updates: Partial<CachedTrack>): void {
    if (!trackId) {
      this.debug('updateTrack: Invalid trackId provided');
      return;
    }

    const existing = this.cache.get(trackId);
    if (!existing) {
      this.debug(`updateTrack: Track ${trackId} not found in cache`);
      return;
    }

    const now = Date.now();
    const updatedTrack: CachedTrack = {
      ...existing,
      ...updates,
      lastAccessed: now
    };

    // Update cache expiration if metadata is being updated
    if (updates.name || updates.artists || updates.album || updates.image) {
      updatedTrack.metadataFetched = now;
      updatedTrack.cacheExpires = now + this.config.metadataTtlMs;
    }

    // Update like status timestamp if like status is being updated
    if (updates.isLiked !== undefined) {
      updatedTrack.likeStatusChecked = now;
    }

    this.cache.set(trackId, updatedTrack);
    this.debug(`updateTrack: Updated track ${trackId}`, updates);

    // Persist to localStorage if enabled
    if (this.config.enableLocalStorage) {
      this.saveToLocalStorage();
    }
  }

  /**
   * Get the like status of a track
   * @param trackId - The track ID to check
   * @returns The like status or null if not cached/expired
   */
  getLikeStatus(trackId: string): boolean | null {
    if (!trackId) {
      this.debug('getLikeStatus: Invalid trackId provided');
      return null;
    }

    const cached = this.cache.get(trackId);
    if (!cached) {
      this.debug(`getLikeStatus: Track ${trackId} not found in cache`);
      return null;
    }

    // Check if like status is expired
    if (this.isExpired(trackId, 'likeStatus')) {
      this.debug(`getLikeStatus: Like status for ${trackId} is expired`);
      return null;
    }

    // Update last accessed time
    cached.lastAccessed = Date.now();

    this.debug(`getLikeStatus: Retrieved like status for ${trackId}`, { isLiked: cached.isLiked });
    return cached.isLiked ?? null;
  }

  /**
   * Set the like status of a track
   * @param trackId - The track ID
   * @param isLiked - Whether the track is liked
   */
  setLikeStatus(trackId: string, isLiked: boolean): void {
    if (!trackId) {
      this.debug('setLikeStatus: Invalid trackId provided');
      return;
    }

    const now = Date.now();
    const existing = this.cache.get(trackId);

    if (existing) {
      // Update existing entry
      existing.isLiked = isLiked;
      existing.likeStatusChecked = now;
      existing.lastAccessed = now;
    } else {
      // Create minimal cache entry for like status only
      const cachedTrack: CachedTrack = {
        id: trackId,
        name: '',
        artists: '',
        album: '',
        duration_ms: 0,
        uri: '',
        isLiked,
        likeStatusChecked: now,
        cacheExpires: now + this.config.likeStatusTtlMs,
        lastAccessed: now
      };
      this.cache.set(trackId, cachedTrack);
    }

    this.debug(`setLikeStatus: Set like status for ${trackId}`, { isLiked });

    // Check if we need to evict entries
    this.enforceMaxSize();

    // Persist to localStorage if enabled
    if (this.config.enableLocalStorage) {
      this.saveToLocalStorage();
    }
  }

  /**
   * Delete a track from the cache
   * @param trackId - The track ID to delete
   */
  delete(trackId: string): void {
    if (!trackId) {
      this.debug('delete: Invalid trackId provided');
      return;
    }

    const deleted = this.cache.delete(trackId);
    if (deleted) {
      this.debug(`delete: Removed track ${trackId} from cache`);
      
      // Persist to localStorage if enabled
      if (this.config.enableLocalStorage) {
        this.saveToLocalStorage();
      }
    }
  }

  /**
   * Clear all cached tracks
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.debug(`clear: Cleared cache of ${size} tracks`);

    // Clear localStorage if enabled
    if (this.config.enableLocalStorage) {
      localStorage.removeItem('vorbis-player-track-cache');
    }
  }

  /**
   * Get the current cache size
   * @returns The number of cached tracks
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries from the cache
   * @returns The number of entries removed
   */
  cleanup(): number {
    const initialSize = this.cache.size;
    const now = Date.now();
    let removedCount = 0;

    for (const [trackId, cached] of this.cache.entries()) {
      // Remove if overall cache is expired or if both metadata and like status are expired
      const metadataExpired = this.isExpired(trackId, 'metadata');
      const likeStatusExpired = this.isExpired(trackId, 'likeStatus');
      
      if (cached.cacheExpires && now > cached.cacheExpires) {
        this.cache.delete(trackId);
        removedCount++;
      } else if (metadataExpired && likeStatusExpired) {
        // Both data types are expired, remove the entry
        this.cache.delete(trackId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.debug(`cleanup: Removed ${removedCount} expired entries`);
      
      // Persist to localStorage if enabled
      if (this.config.enableLocalStorage) {
        this.saveToLocalStorage();
      }
    }

    return removedCount;
  }

  /**
   * Check if a track exists in the cache (regardless of expiration)
   * @param trackId - The track ID to check
   * @returns Whether the track exists in the cache
   */
  hasTrack(trackId: string): boolean {
    return trackId ? this.cache.has(trackId) : false;
  }

  /**
   * Check if a track's data is expired
   * @param trackId - The track ID to check
   * @param dataType - Specific data type to check expiration for
   * @returns Whether the data is expired
   */
  isExpired(trackId: string, dataType?: 'metadata' | 'likeStatus'): boolean {
    if (!trackId) return true;

    const cached = this.cache.get(trackId);
    if (!cached) return true;

    const now = Date.now();

    if (dataType === 'metadata') {
      return !cached.metadataFetched || 
             (now > cached.metadataFetched + this.config.metadataTtlMs);
    }

    if (dataType === 'likeStatus') {
      return !cached.likeStatusChecked || 
             (now > cached.likeStatusChecked + this.config.likeStatusTtlMs);
    }

    // Check overall cache expiration
    return cached.cacheExpires ? now > cached.cacheExpires : false;
  }

  /**
   * Enforce maximum cache size using LRU eviction
   */
  private enforceMaxSize(): void {
    if (this.cache.size <= this.config.maxSize) return;

    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => (a.lastAccessed || 0) - (b.lastAccessed || 0));

    const toRemove = this.cache.size - this.config.maxSize;
    let removedCount = 0;

    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [trackId] = entries[i];
      this.cache.delete(trackId);
      removedCount++;
    }

    this.debug(`enforceMaxSize: Evicted ${removedCount} tracks using LRU policy`);
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startPeriodicCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop periodic cleanup
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('vorbis-player-track-cache');
      if (stored) {
        const data = JSON.parse(stored);
        if (Array.isArray(data)) {
          let loadedCount = 0;
          for (const [trackId, track] of data) {
            if (trackId && track && typeof track === 'object') {
              this.cache.set(trackId, track);
              loadedCount++;
            }
          }
          this.debug(`loadFromLocalStorage: Loaded ${loadedCount} tracks from localStorage`);
        }
      }
    } catch (error) {
      this.debug('loadFromLocalStorage: Failed to load from localStorage', error);
      localStorage.removeItem('vorbis-player-track-cache');
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveToLocalStorage(): void {
    try {
      const data = Array.from(this.cache.entries());
      localStorage.setItem('vorbis-player-track-cache', JSON.stringify(data));
    } catch (error) {
      this.debug('saveToLocalStorage: Failed to save to localStorage', error);
    }
  }

  /**
   * Debug logging helper
   */
  private debug(message: string, data?: any): void {
    if (this.config.enableDebug) {
      console.log(`[TrackDataCache] ${message}`, data || '');
    }
  }

  /**
   * Cleanup resources when the service is destroyed
   */
  destroy(): void {
    this.stopPeriodicCleanup();
    this.clear();
    this.debug('TrackDataCache destroyed');
  }
}

// Singleton instance
let cacheInstance: TrackDataCacheServiceImpl | null = null;

/**
 * Get the singleton track data cache instance
 * @param config - Optional configuration for the cache
 * @returns The track data cache service instance
 */
export function getTrackDataCache(config?: Partial<TrackCacheConfig>): TrackDataCacheService {
  if (!cacheInstance) {
    cacheInstance = new TrackDataCacheServiceImpl(config);
  }
  return cacheInstance;
}

/**
 * Reset the singleton cache instance (useful for testing)
 */
export function resetTrackDataCache(): void {
  if (cacheInstance) {
    cacheInstance.destroy();
    cacheInstance = null;
  }
}

// Export default instance for convenience
export const trackDataCache = getTrackDataCache();