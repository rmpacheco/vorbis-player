import { spotifyAuth } from './spotify';

if (typeof window !== 'undefined') {
  window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify Web Playback SDK is ready');
  };
}

export class SpotifyPlayerService {
  private player: SpotifyPlayer | null = null;
  private deviceId: string | null = null;
  private isReady = false;

  constructor() {}

  async initialize(): Promise<void> {
    if (!spotifyAuth.isAuthenticated()) {
      throw new Error('User must be authenticated before initializing player');
    }

    if (this.player) {
      return;
    }

    // Check DRM support before initializing
    const drmSupported = await this.checkDRMSupport();
    if (!drmSupported) {
      console.warn('🔒 DRM (Widevine) not detected. Spotify playback may fail.');
    }

    return new Promise((resolve, reject) => {
      const initPlayer = () => {
        try {
          this.setupPlayer();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      if (window.Spotify) {
        initPlayer();
      } else {
        window.onSpotifyWebPlaybackSDKReady = initPlayer;
        
        setTimeout(() => {
          if (!this.player) {
            reject(new Error('Spotify SDK failed to load within timeout'));
          }
        }, 10000);
      }
    });
  }

  private async checkDRMSupport(): Promise<boolean> {
    if (!navigator.requestMediaKeySystemAccess) {
      return false;
    }

    try {
      const config = [{
        initDataTypes: ['cenc'],
        audioCapabilities: [{
          contentType: 'audio/mp4;codecs="mp4a.40.2"',
          robustness: 'SW_SECURE_CRYPTO'
        }],
        videoCapabilities: [{
          contentType: 'video/mp4;codecs="avc1.42E01E"',
          robustness: 'SW_SECURE_CRYPTO'
        }]
      }];

      await navigator.requestMediaKeySystemAccess('com.widevine.alpha', config);
      return true;
    } catch (error) {
      console.warn('Widevine DRM not supported:', error);
      return false;
    }
  }

  private setupPlayer(): void {
    if (!spotifyAuth.isAuthenticated()) {
      throw new Error('No Spotify access token available');
    }

    this.player = new window.Spotify.Player({
      name: 'Vorbis Player',
      getOAuthToken: (cb) => {
        spotifyAuth.ensureValidToken().then(cb).catch(() => {
          spotifyAuth.redirectToAuth();
        });
      },
      volume: 0.5
    });

    this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('🎵 Spotify player ready with device ID:', device_id);
      this.deviceId = device_id;
      this.isReady = true;
    });

    this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('Device ID has gone offline', device_id);
      this.isReady = false;
    });

    this.player.addListener('initialization_error', async ({ message }: { message: string }) => {
      console.error('Failed to initialize', message);
      
      // Check if this is a DRM-related error
      if (message.includes('EMEError') || message.includes('keysystem')) {
        const drmSupported = await this.checkDRMSupport();
        if (!drmSupported) {
          console.error('🔒 DRM (Widevine) not available in this environment. Spotify playback requires DRM support.');
          throw new Error('DRM_NOT_SUPPORTED: This environment does not support Widevine DRM, which is required for Spotify playback. Try running in a standard web browser or use a Widevine-enabled Electron build.');
        }
      }
    });

    this.player.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('Failed to authenticate', message);
      spotifyAuth.redirectToAuth();
    });

    this.player.addListener('account_error', ({ message }: { message: string }) => {
      console.error('Failed to validate Spotify account', message);
    });

    this.player.addListener('playback_error', ({ message }: { message: string }) => {
      console.error('Failed to perform playback', message);
    });

    this.player.connect();
  }

  async playTrack(uri: string): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }

    const token = await spotifyAuth.ensureValidToken();
    
    console.log('🎵 Making Spotify API call to play track:', {
      deviceId: this.deviceId,
      uri: uri,
      hasToken: !!token
    });
    
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      body: JSON.stringify({ uris: [uri] }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    console.log('🎵 Spotify API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎵 Spotify API error response:', errorText);
      throw new Error(`Spotify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  async playPlaylist(uris: string[]): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }

    const token = await spotifyAuth.ensureValidToken();
    
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      body: JSON.stringify({ uris }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
  }

  async pause(): Promise<void> {
    if (this.player) {
      await this.player.pause();
    }
  }

  async resume(): Promise<void> {
    if (this.player) {
      await this.player.resume();
    }
  }

  async nextTrack(): Promise<void> {
    if (this.player) {
      await this.player.nextTrack();
    }
  }

  async previousTrack(): Promise<void> {
    if (this.player) {
      await this.player.previousTrack();
    }
  }

  async setVolume(volume: number): Promise<void> {
    if (this.player) {
      await this.player.setVolume(volume);
    }
  }

  async getCurrentState(): Promise<SpotifyPlaybackState | null> {
    if (this.player) {
      return await this.player.getCurrentState();
    }
    return null;
  }

  onPlayerStateChanged(callback: (state: SpotifyPlaybackState | null) => void): void {
    if (this.player) {
      this.player.removeListener('player_state_changed');
      this.player.addListener('player_state_changed', callback);
    }
  }

  disconnect(): void {
    if (this.player) {
      this.player.disconnect();
      this.player = null;
      this.deviceId = null;
      this.isReady = false;
    }
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  getIsReady(): boolean {
    return this.isReady;
  }

  async isDRMSupported(): Promise<boolean> {
    return await this.checkDRMSupport();
  }

  async transferPlaybackToDevice(): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Device not ready for playback transfer');
    }

    const token = await spotifyAuth.ensureValidToken();
    
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [this.deviceId],
          play: false
        })
      });

      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        console.warn('Transfer playback response:', response.status, errorText);
      } else {
        console.log('🎵 Successfully transferred playback to device');
      }
    } catch (error) {
      console.error('🎵 Failed to transfer playback to device:', error);
      throw error;
    }
  }
}

export const spotifyPlayer = new SpotifyPlayerService();