import { trackDataCache } from './trackDataCache';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-library-modify',
  'user-top-read'
];

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

class SpotifyAuth {
  private tokenData: TokenData | null = null;

  constructor() {
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage() {
    const stored = localStorage.getItem('spotify_token');
    if (stored) {
      try {
        const tokenData = JSON.parse(stored);
        if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
          localStorage.removeItem('spotify_token');
          return;
        }
        this.tokenData = tokenData;
      } catch {
        localStorage.removeItem('spotify_token');
      }
    }
  }

  private saveTokenToStorage(tokenData: TokenData) {
    this.tokenData = tokenData;
    localStorage.setItem('spotify_token', JSON.stringify(tokenData));
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  public async getAuthUrl(): Promise<string> {
    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined. Please set it in your .env.local file.');
    }

    const code_verifier = this.generateCodeVerifier();
    const code_challenge = await this.generateCodeChallenge(code_verifier);
    
    localStorage.setItem('spotify_code_verifier', code_verifier);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      scope: SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: code_challenge,
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  public async handleAuthCallback(code: string): Promise<void> {
    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined.');
    }

    const code_verifier = localStorage.getItem('spotify_code_verifier');
    if (!code_verifier) {
      console.error('Code verifier not found in localStorage. Available keys:', Object.keys(localStorage));
      throw new Error('Code verifier not found. Please restart the authentication flow.');
    }
    console.log('Found code verifier, proceeding with token exchange...');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        clientId: SPOTIFY_CLIENT_ID,
        redirectUri: SPOTIFY_REDIRECT_URI,
        hasCodeVerifier: !!code_verifier,
        codeLength: code?.length
      });
      throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const tokenData: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };

    this.saveTokenToStorage(tokenData);
    localStorage.removeItem('spotify_code_verifier');
  }

  public async refreshAccessToken(): Promise<void> {
    if (!this.tokenData?.refresh_token) {
      throw new Error('No refresh token available');
    }

    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined.');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokenData.refresh_token,
        client_id: SPOTIFY_CLIENT_ID,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    const tokenData: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.tokenData.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };

    this.saveTokenToStorage(tokenData);
  }

  public async ensureValidToken(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('No authentication token available');
    }

    if (Date.now() > this.tokenData.expires_at - 300000) {
      await this.refreshAccessToken();
    }

    return this.tokenData.access_token;
  }

  public isAuthenticated(): boolean {
    return !!this.tokenData?.access_token;
  }

  public async redirectToAuth(): Promise<void> {
    const authUrl = await this.getAuthUrl();
    window.location.href = authUrl;
  }

  public logout(): void {
    this.tokenData = null;
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_code_verifier');
  }

  public async handleRedirect(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      this.logout();
      throw new Error(`Spotify auth error: ${error}`);
    }

    if (code && window.location.pathname === '/auth/spotify/callback') {
      const processedCode = sessionStorage.getItem('spotify_processed_code');
      if (processedCode === code) {
        window.history.replaceState({}, document.title, '/');
        return;
      }

      try {
        await this.handleAuthCallback(code);
        sessionStorage.setItem('spotify_processed_code', code);
        window.history.replaceState({}, document.title, '/');
      } catch (e) {
        console.error('Failed to handle auth callback:', e);
        sessionStorage.removeItem('spotify_processed_code');
        
        // If code verifier is missing, restart the auth flow
        if (e instanceof Error && e.message.includes('Code verifier not found')) {
          console.log('Restarting authentication flow due to missing code verifier...');
          this.logout();
          await this.redirectToAuth();
          return;
        }
        
        this.logout();
        throw e;
      }
    }
  }

  public getAccessToken(): string | null {
    return this.tokenData?.access_token || null;
  }
}

export const spotifyAuth = new SpotifyAuth();

// Re-export Track interface from types
export type { Track } from '../types/track';

export interface PlaylistInfo {
  id: string;
  name: string;
  description: string | null;
  images: { url: string; height: number | null; width: number | null }[];
  tracks: { total: number };
  owner: { display_name: string };
}

export const getUserPlaylists = async (): Promise<PlaylistInfo[]> => {
  try {
    const token = await spotifyAuth.ensureValidToken();
    console.log('✓ Fetching user playlists...');
    
    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Playlist fetch error:', response.status, errorText);
      throw new Error(`Failed to fetch playlists: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✓ Found ${data.items?.length || 0} playlists`);
    
    if (!data.items || data.items.length === 0) {
      console.warn('No playlists found in user account');
      return [];
    }
    
    return data.items.map((playlist: any): PlaylistInfo => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      images: playlist.images || [],
      tracks: { total: playlist.tracks.total },
      owner: { display_name: playlist.owner.display_name }
    }));
    
  } catch (error) {
    console.error('Error fetching user playlists:', error);
    throw error;
  }
};

export const getPlaylistTracks = async (playlistId: string): Promise<Track[]> => {
  try {
    const token = await spotifyAuth.ensureValidToken();
    console.log(`✓ Fetching tracks from playlist: ${playlistId}`);
    
    const tracks: Track[] = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
    
    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tracks fetch error:', response.status, errorText);
        throw new Error(`Failed to fetch tracks: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      for (const item of data.items || []) {
        if (item.track?.id && item.track.type === 'track') {
          const track = item.track;
          const albumImage = track.album?.images?.[0]?.url;
          
          const trackData: Track = {
            id: track.id,
            name: track.name,
            artists: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
            album: track.album?.name || 'Unknown Album',
            duration_ms: track.duration_ms || 0,
            uri: track.uri,
            preview_url: track.preview_url,
            image: albumImage
          };
          
          // Cache the complete track data
          try {
            trackDataCache.setTrack(trackData);
          } catch (error) {
            console.warn('Failed to cache track data:', error);
          }
          
          tracks.push(trackData);
        }
      }
      
      nextUrl = data.next; // Pagination
    }
    
    console.log(`✓ Found ${tracks.length} valid tracks`);
    return tracks;
    
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    throw error;
  }
};

export const getSpotifyUserPlaylists = async (): Promise<Track[]> => {
  try {
    const token = await spotifyAuth.ensureValidToken();
    console.log('✓ Token obtained successfully');
    
    console.log('Fetching user playlists...');
    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Playlist fetch error:', response.status, errorText);
      throw new Error(`Failed to fetch playlists: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✓ Found ${data.items?.length || 0} playlists:`, data.items?.map((p: { name: string }) => p.name));
    
    if (!data.items || data.items.length === 0) {
      console.warn('No playlists found in user account');
      return [];
    }
    
    const tracks: Track[] = [];
    
    // Get tracks from user's playlists (limit to first 10 playlists to avoid rate limits)
    for (const playlist of (data.items || []).slice(0, 10)) {
      if (!playlist.tracks?.href) {
        console.warn(`Playlist ${playlist.name} has no tracks href`);
        continue;
      }
      
      console.log(`Fetching tracks from playlist: "${playlist.name}" (${playlist.tracks.total} tracks)`);
      const tracksResponse = await fetch(playlist.tracks.href + '?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        console.log(`✓ Found ${tracksData.items?.length || 0} track items in "${playlist.name}"`);
        
        let validTracksInPlaylist = 0;
        for (const item of (tracksData.items || [])) {
          if (item.track && item.track.id && !item.track.is_local && item.track.type === 'track') {
            const trackData: Track = {
              id: item.track.id,
              name: item.track.name || 'Unknown Track',
              artists: (item.track.artists || []).map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
              album: item.track.album?.name || 'Unknown Album',
              duration_ms: item.track.duration_ms || 0,
              uri: item.track.uri,
              preview_url: item.track.preview_url,
              image: item.track.album?.images?.[0]?.url,
            };
            
            // Cache the complete track data
            try {
              trackDataCache.setTrack(trackData);
            } catch (error) {
              console.warn('Failed to cache track data:', error);
            }
            
            tracks.push(trackData);
            validTracksInPlaylist++;
          } else {
            console.debug(`Skipped item in "${playlist.name}":`, {
              hasTrack: !!item.track,
              hasId: !!item.track?.id,
              isLocal: item.track?.is_local,
              type: item.track?.type
            });
          }
        }
        console.log(`✓ Added ${validTracksInPlaylist} valid tracks from "${playlist.name}"`);
      } else {
        const errorText = await tracksResponse.text();
        console.warn(`Failed to fetch tracks from playlist "${playlist.name}":`, tracksResponse.status, errorText);
      }
    }

    console.log(`✓ Total tracks collected from playlists: ${tracks.length}`);
    
    // If no tracks found in playlists, try to get liked songs
    if (tracks.length === 0) {
      console.log('No tracks found in playlists, trying liked songs...');
      
      const likedResponse = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (likedResponse.ok) {
        const likedData = await likedResponse.json();
        console.log(`✓ Found ${likedData.items?.length || 0} liked songs`);
        
        for (const item of (likedData.items || [])) {
          if (item.track && item.track.id && !item.track.is_local && item.track.type === 'track') {
            const trackData: Track = {
              id: item.track.id,
              name: item.track.name || 'Unknown Track',
              artists: (item.track.artists || []).map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
              album: item.track.album?.name || 'Unknown Album',
              duration_ms: item.track.duration_ms || 0,
              uri: item.track.uri,
              preview_url: item.track.preview_url,
              image: item.track.album?.images?.[0]?.url,
            };
            
            // Cache the complete track data with like status = true
            try {
              trackDataCache.setTrack(trackData);
              trackDataCache.setLikeStatus(trackData.id, true);
            } catch (error) {
              console.warn('Failed to cache track data:', error);
            }
            
            tracks.push(trackData);
          }
        }
        console.log(`✓ Added ${tracks.length} tracks from liked songs`);
      } else {
        console.warn('Failed to fetch liked songs:', likedResponse.status);
      }
    }
    
    if (tracks.length === 0) {
      console.warn('No valid tracks found anywhere. This could mean:');
      console.warn('- All playlists are empty');
      console.warn('- No liked songs');
      console.warn('- All tracks are local files (not supported)');
      console.warn('- User needs to add music to their Spotify account');
    }
    
    return tracks;
  } catch (error) {
    console.error('Error in getSpotifyUserPlaylists:', error);
    if (error instanceof Error && error.message === 'No authentication token available') {
      spotifyAuth.redirectToAuth();
      throw new Error('Redirecting to Spotify login...');
    }
    throw error;
  }
};

/**
 * Check if a track is saved in the user's library (liked songs)
 * @param trackId - The Spotify track ID to check
 * @returns Promise<boolean> - True if the track is saved, false otherwise
 */
export const checkTrackSaved = async (trackId: string): Promise<boolean> => {
  // Check cache first
  try {
    const cachedStatus = trackDataCache.getLikeStatus(trackId);
    if (cachedStatus !== null) {
      return cachedStatus;
    }
  } catch (error) {
    console.warn('Failed to check cache for like status:', error);
  }

  // Cache miss or expired, make API call
  try {
    const token = await spotifyAuth.ensureValidToken();
    const response = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check track saved status: ${response.status}`);
    }
    
    const data = await response.json();
    const isLiked = Boolean(data[0]); // Returns boolean
    
    // Cache the result
    try {
      trackDataCache.setLikeStatus(trackId, isLiked);
    } catch (error) {
      console.warn('Failed to cache like status:', error);
    }
    
    return isLiked;
  } catch (error) {
    // On API failure, try to return cached value even if expired as fallback
    try {
      const cachedTrack = trackDataCache.getTrack(trackId);
      if (cachedTrack && cachedTrack.isLiked !== undefined) {
        console.warn('Using potentially stale cached like status due to API failure');
        return cachedTrack.isLiked;
      }
    } catch (cacheError) {
      console.warn('Failed to retrieve fallback cached status:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Add a track to the user's library (liked songs)
 * @param trackId - The Spotify track ID to save
 * @returns Promise<void>
 */
export const saveTrack = async (trackId: string): Promise<void> => {
  const token = await spotifyAuth.ensureValidToken();
  const response = await fetch('https://api.spotify.com/v1/me/tracks', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: [trackId] })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to save track: ${response.status}`);
  }
  
  // Update cache with new like status after successful API call
  try {
    trackDataCache.setLikeStatus(trackId, true);
  } catch (error) {
    console.warn('Failed to update cache after saving track:', error);
  }
};

/**
 * Remove a track from the user's library (liked songs)
 * @param trackId - The Spotify track ID to remove
 * @returns Promise<void>
 */
export const unsaveTrack = async (trackId: string): Promise<void> => {
  const token = await spotifyAuth.ensureValidToken();
  const response = await fetch('https://api.spotify.com/v1/me/tracks', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: [trackId] })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to unsave track: ${response.status}`);
  }
  
  // Update cache with new like status after successful API call
  try {
    trackDataCache.setLikeStatus(trackId, false);
  } catch (error) {
    console.warn('Failed to update cache after unsaving track:', error);
  }
};

/**
 * Get cached track data if available
 * @param trackId - The Spotify track ID to retrieve
 * @returns The cached track data or null if not available
 */
export const getCachedTrack = (trackId: string): Track | null => {
  try {
    const cachedTrack = trackDataCache.getTrack(trackId);
    if (cachedTrack) {
      // Return only the Track interface properties
      return {
        id: cachedTrack.id,
        name: cachedTrack.name,
        artists: cachedTrack.artists,
        album: cachedTrack.album,
        duration_ms: cachedTrack.duration_ms,
        uri: cachedTrack.uri,
        preview_url: cachedTrack.preview_url,
        image: cachedTrack.image
      };
    }
  } catch (error) {
    console.warn('Failed to retrieve cached track:', error);
  }
  return null;
};

/**
 * Get cached like status if available
 * @param trackId - The Spotify track ID to check
 * @returns The cached like status or null if not available
 */
export const getCachedLikeStatus = (trackId: string): boolean | null => {
  try {
    return trackDataCache.getLikeStatus(trackId);
  } catch (error) {
    console.warn('Failed to retrieve cached like status:', error);
    return null;
  }
};