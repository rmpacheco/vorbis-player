import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import styled from 'styled-components';
const Playlist = lazy(() => import('./Playlist'));
const PlaylistSelection = lazy(() => import('./PlaylistSelection'));
import { getPlaylistTracks, spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';
import { Card, CardHeader, CardContent } from '../components/styled';
import SettingsModal from './SettingsModal';
import { Button } from '../components/styled';
import { Skeleton } from '../components/styled';
import { Alert, AlertDescription } from '../components/styled';
import { flexCenter, flexColumn, cardBase } from '../styles/utils';
import AlbumArt from './AlbumArt';
import { extractDominantColor } from '../utils/colorExtractor';
import SpotifyPlayerControls from './SpotifyPlayerControls';
import VisualEffectsMenu from './VisualEffectsMenu';
import { theme } from '@/styles/theme';
import { DEFAULT_GLOW_RATE } from './AccentColorGlowOverlay';

// Styled components
const Container = styled.div`
  // min-height: 100vh;
  width: 100%;
  ${flexCenter};
  padding: ${({ theme }: any) => theme.spacing.sm};
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.sm}) {
    padding: ${({ theme }: any) => theme.spacing.sm};
  }
`;

const ContentWrapper = styled.div`
  // aspect-ratio: 16/9;
  max-width: 50rem;
  max-height: 58rem;
  min-width: 36rem;
  min-height: 44rem;
  
  // width: calc(100vw - 1rem );
  width: 768px;
  // height: calc(width + 8rem);
  height: 880px;
  // width: calc(100vw - 1rem);
  margin: 0 auto;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  box-sizing: border-box;
  position: absolute;
  z-index: 1000;
  
  // @media (min-width: ${({ theme }: any) => theme.breakpoints.sm}) {
  //   max-width: 60rem;
  // }
  // @media (min-width: ${({ theme }: any) => theme.breakpoints.md}) {
  //   max-width: 72rem;
  // }
`;


const PlaylistDrawer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow-y: auto;
  padding: 1rem;
  box-sizing: border-box;
  
  @media (max-width: 480px) {
    width: 100vw;
  }
`;

const PlaylistContent = styled.div`
  padding: 0.5rem 0 1rem 0;
  
  /* Ensure playlist cards have proper spacing from top and bottom */
  > div:first-child {
    margin-top: 0;
  }
  
  > div:last-child {
    margin-bottom: 0;
  }
`;

const PlaylistOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 999;
`;

const PlaylistHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const PlaylistTitle = styled.h3`
  color: white;
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;


const LoadingCard = styled(Card) <{ backgroundImage?: string; standalone?: boolean }>`
  ${cardBase};
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid rgba(34, 36, 36, 0.68);
  box-shadow: 0 8px 24px rgba(38, 36, 37, 0.7), 0 2px 8px rgba(22, 21, 21, 0.6);
  
  ${({ backgroundImage }) => backgroundImage ? `
    &::after {
      content: '';
      position: absolute;
      inset: 0.1rem;
      background-image: url(${backgroundImage});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: 1.25rem;
      z-index: 0;
    }
    
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(32, 30, 30, 0.7);
      backdrop-filter: blur(24px);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : `
    background: rgba(38, 38, 38, 0.5);
    backdrop-filter: blur(12px);
  `}
`;


const SkeletonContainer = styled.div`
  ${flexColumn};
  gap: ${({ theme }: any) => theme.spacing.md};
`;

const PlaylistFallback = styled.div`
  width: 100%;
  margin-top: ${({ theme }: any) => theme.spacing.lg};
`;

const PlaylistFallbackCard = styled.div`
  background-color: ${({ theme }: any) => theme.colors.gray[800]};
  border-radius: 1.25rem;
  padding: ${({ theme }: any) => theme.spacing.md};
  border: 1px solid ${({ theme }: any) => theme.colors.gray[700]};
`;



const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(theme.colors.accent );
  const [showVideo, setShowVideo] = useState(false);
  const [showVisualEffects, setShowVisualEffects] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState<number>(() => {
    const saved = localStorage.getItem('vorbis-player-glow-intensity');
    return saved ? parseInt(saved, 10) : 100;
  });
  const [glowRate, setGlowRate] = useState<number>(() => {
    const saved = localStorage.getItem('vorbis-player-glow-rate');
    return saved ? parseFloat(saved) : DEFAULT_GLOW_RATE; 
  });
  const [glowMode, setGlowMode] = useState<'global' | 'per-album'>(() => {
    const saved = localStorage.getItem('vorbis-player-glow-mode');
    return saved === 'per-album' ? 'per-album' : 'global';
  });
  const [perAlbumGlow, setPerAlbumGlow] = useState<Record<string, { intensity: number; rate: number }>>(() => {
    const saved = localStorage.getItem('vorbis-player-per-album-glow');
    return saved ? JSON.parse(saved) : {};
  });
  // New: per-song accent color overrides
  const [accentColorOverrides, setAccentColorOverrides] = useState<Record<string, string>>({});

  // Album art filters state
  const [albumFilters, setAlbumFilters] = useState<{
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    blur: number;
    sepia: number;
    grayscale: number;
    invert: number;
  }>(() => {
    const saved = localStorage.getItem('vorbis-player-album-filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: ensure boolean invert and add missing properties
        return {
          brightness: parsed.brightness ?? 100,
          contrast: parsed.contrast ?? 100,
          saturation: parsed.saturation ?? 100,
          hue: parsed.hue ?? 0,
          blur: parsed.blur ?? 0,
          sepia: parsed.sepia ?? 0,
          grayscale: parsed.grayscale ?? 0,
          invert: typeof parsed.invert === 'boolean' ? parsed.invert : (parsed.invert > 0)
        };
      } catch (e) {
        // If parsing fails, use defaults
        return {
          brightness: 100,
          contrast: 100,
          saturation: 100,
          hue: 0,
          blur: 0,
          sepia: 0,
          grayscale: 0,
          invert: false
        };
      }
    }
    return {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0,
      grayscale: 0,
      invert: false
    };
  });

  // Load overrides from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('accentColorOverrides');
    if (stored) {
        setAccentColorOverrides(JSON.parse(stored));
    }
  }, []);

  // Save overrides to localStorage when changed
  useEffect(() => {
    localStorage.setItem('accentColorOverrides', JSON.stringify(accentColorOverrides));
  }, [accentColorOverrides]);

  // Persist album filters to localStorage
  useEffect(() => {
    localStorage.setItem('vorbis-player-album-filters', JSON.stringify(albumFilters));
  }, [albumFilters]);

  const handleFilterChange = useCallback((filterName: string, value: number | boolean) => {
    setAlbumFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setAlbumFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0,
      grayscale: 0,
      invert: false
    });
  }, []);

  const handlePlaylistSelect = async (playlistId: string, playlistName: string) => {
    try {
      setError(null);
      setIsLoading(true);
      setSelectedPlaylistId(playlistId);

      console.log('🎵 Loading tracks from playlist:', playlistName);

      // Initialize Spotify player
      await spotifyPlayer.initialize();

      // Ensure our device is the active player
      try {
        await spotifyPlayer.transferPlaybackToDevice();
        console.log('🎵 Ensured our device is active for playback');
      } catch (error) {
        console.log('🎵 Could not transfer playback, will attempt during first play:', error);
      }

      // Fetch tracks from the selected playlist
      const fetchedTracks = await getPlaylistTracks(playlistId);

      if (fetchedTracks.length === 0) {
        setError("No tracks found in this playlist.");
        return;
      }

      setTracks(fetchedTracks);
      setCurrentTrackIndex(0);

      console.log(`🎵 Loaded ${fetchedTracks.length} tracks, starting playback...`);

      // Start playing the first track (user interaction has occurred)
      setTimeout(async () => {
        try {
          // console.log('🎵 Attempting to start playback after playlist selection...');
          await playTrack(0);
          // console.log('🎵 Playback started successfully after playlist selection!');

          // Check playback state after a delay and try to recover
          setTimeout(async () => {
            const state = await spotifyPlayer.getCurrentState();
            // console.log('🎵 Post-start playback check:', {
            //   paused: state?.paused,
            //   position: state?.position,
            //   trackName: state?.track_window?.current_track?.name,
            //   playerReady: spotifyPlayer.getIsReady(),
            //   deviceId: spotifyPlayer.getDeviceId()
            // });

            // If state is undefined, the player might not be active - try to activate it
            if (!state || !state.track_window?.current_track) {
              console.log('🎵 No player state detected, attempting to transfer playback to our device...');
              try {
                const token = await spotifyAuth.ensureValidToken();
                const deviceId = spotifyPlayer.getDeviceId();

                if (deviceId) {
                  // Transfer playback to our device
                  await fetch('https://api.spotify.com/v1/me/player', {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      device_ids: [deviceId],
                      play: true
                    })
                  });

                  console.log('🎵 Transferred playback to our device');

                  // Try playing the track again
                  setTimeout(async () => {
                    try {
                      await playTrack(0);
                      console.log('🎵 Retried playback after device transfer');
                    } catch (error) {
                      console.error('🎵 Failed to retry playback:', error);
                    }
                  }, 1000);
                }
              } catch (error) {
                console.error('🎵 Failed to transfer playback:', error);
              }
            }
          }, 2000);
        } catch (error) {
          console.error('🎵 Failed to start playback:', error);
        }
      }, 1500);

    } catch (err: unknown) {
      console.error('Failed to load playlist tracks:', err);
      if (err instanceof Error && err.message.includes('authenticated')) {
        setError("Authentication expired. Redirecting to Spotify login...");
        spotifyAuth.redirectToAuth();
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred while loading tracks.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Spotify auth redirect when component mounts
  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        await spotifyAuth.handleRedirect();
      } catch (error) {
        console.error('Auth redirect error:', error);
        setError(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    handleAuthRedirect();
  }, []);



  const playTrack = useCallback(async (index: number) => {
    if (tracks[index]) {
      try {
        console.log('🎵 Attempting to play track:', {
          index,
          trackName: tracks[index].name,
          uri: tracks[index].uri,
          playerReady: spotifyPlayer.getIsReady(),
          deviceId: spotifyPlayer.getDeviceId()
        });

        // Check if we have valid authentication
        const isAuthenticated = spotifyAuth.isAuthenticated();
        console.log('🎵 Authentication status:', isAuthenticated);

        if (!isAuthenticated) {
          console.error('🎵 Not authenticated with Spotify');
          return;
        }

        await spotifyPlayer.playTrack(tracks[index].uri);
        setCurrentTrackIndex(index);
        console.log('🎵 playTrack call completed');

        // Check if playback actually started after a delay
        setTimeout(async () => {
          const state = await spotifyPlayer.getCurrentState();
          if (state?.paused && state.position === 0) {
            console.log('🎵 Track appears to be paused after play call, attempting resume...');
            try {
              await spotifyPlayer.resume();
              console.log('🎵 Resume attempted');
            } catch (resumeError) {
              console.error('🎵 Failed to resume:', resumeError);
            }
          }
        }, 1000);

      } catch (error) {
        console.error('🎵 Failed to play track:', error);
        console.error('🎵 Error details:', {
          error: error instanceof Error ? error.message : String(error),
          playerReady: spotifyPlayer.getIsReady(),
          deviceId: spotifyPlayer.getDeviceId(),
          trackUri: tracks[index].uri
        });
      }
    }
  }, [tracks]);

  // Simple player state monitoring (removed complex auto-play logic)
  useEffect(() => {
    const handlePlayerStateChange = (state: SpotifyPlaybackState | null) => {
      if (state && state.track_window.current_track) {
        const currentTrack = state.track_window.current_track;
        const trackIndex = tracks.findIndex(track => track.id === currentTrack.id);

        if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
          setCurrentTrackIndex(trackIndex);
        }
      }
    };

    spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);
  }, [tracks, currentTrackIndex]);

  // Auto-advance to next track when current track ends
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let hasEnded = false; // Prevent multiple triggers

    const checkForSongEnd = async () => {
      try {
        const state = await spotifyPlayer.getCurrentState();
        if (state && state.track_window.current_track && tracks.length > 0) {
          const currentTrack = state.track_window.current_track;
          const duration = currentTrack.duration_ms;
          const position = state.position;
          const timeRemaining = duration - position;

          // Log current state periodically for debugging
          if (Math.random() < 0.2) { // Log 20% of the time
            console.log('🎵 Playback state:', {
              trackName: currentTrack.name,
              position: Math.round(position / 1000) + 's',
              duration: Math.round(duration / 1000) + 's',
              timeRemaining: Math.round(timeRemaining / 1000) + 's',
              paused: state.paused
            });
          }

          // Check if song has ended (within 2 seconds of completion OR position at end)
          if (!hasEnded && duration > 0 && position > 0 && (
            timeRemaining <= 2000 || // Within 2 seconds of end
            position >= duration - 1000 // Within 1 second of end
          )) {
            console.log('🎵 Song ending detected! Auto-advancing...', {
              timeRemaining: timeRemaining + 'ms',
              position: position + 'ms',
              duration: duration + 'ms',
              currentTrack: currentTrack.name
            });

            hasEnded = true; // Prevent multiple triggers

            // Auto-advance to next track
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            if (tracks[nextIndex]) {
              console.log(`🎵 Playing next track: ${tracks[nextIndex].name}`);
              setTimeout(() => {
                playTrack(nextIndex);
                hasEnded = false; // Reset for next track
              }, 500);
            }
          }
        }
      } catch (error) {
        console.error('Error checking for song end:', error);
      }
    };

    // Poll every 2 seconds to check for song endings (more frequent)
    if (tracks.length > 0) {
      pollInterval = setInterval(checkForSongEnd, 2000);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [tracks, currentTrackIndex, playTrack]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    playTrack(nextIndex);
    // setShuffleCounter(0);
  }, [currentTrackIndex, tracks.length, playTrack]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    const prevIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
    playTrack(prevIndex);
    // setShuffleCounter(0);
  }, [currentTrackIndex, tracks.length, playTrack]);

  // Memoize the current track to prevent unnecessary re-renders
  const currentTrack = useMemo(() => tracks[currentTrackIndex] || null, [tracks, currentTrackIndex]);

  // On track change: use override if present, else extract
  useEffect(() => {
    const extractColor = async () => {
      if (currentTrack?.id && accentColorOverrides[currentTrack.id]) {
        setAccentColor(accentColorOverrides[currentTrack.id]);
        return;
      }
      if (currentTrack?.image) {
        try {
          const dominantColor = await extractDominantColor(currentTrack.image);
          if (dominantColor) {
            setAccentColor(dominantColor.hex);
          } else {
            setAccentColor(theme.colors.accent); // Fallback
          }
        } catch (error) {
          console.error('Failed to extract color from album art:', error);
          setAccentColor(theme.colors.accent); // Fallback
        }
      } else {
        setAccentColor(theme.colors.accent); // Fallback
      }
    };
    extractColor();
  }, [currentTrack?.id, currentTrack?.image, accentColorOverrides, theme.colors.accent]);

  // Handler for user accent color change (from SpotifyPlayerControls)
  const handleAccentColorChange = (color: string) => {
    if (currentTrack?.id) {
      setAccentColorOverrides(prev => ({ ...prev, [currentTrack.id]: color }));
      setAccentColor(color);
    } else {
      setAccentColor(color);
    }
  };

  // Persist glow settings to localStorage
  useEffect(() => {
    localStorage.setItem('vorbis-player-glow-intensity', glowIntensity.toString());
  }, [glowIntensity]);
  useEffect(() => {
    localStorage.setItem('vorbis-player-glow-rate', glowRate.toString());
  }, [glowRate]);
  useEffect(() => {
    localStorage.setItem('vorbis-player-glow-mode', glowMode);
  }, [glowMode]);
  useEffect(() => {
    localStorage.setItem('vorbis-player-per-album-glow', JSON.stringify(perAlbumGlow));
  }, [perAlbumGlow]);

  // Determine current album ID (if available)
  const currentAlbumId = currentTrack?.album || '';
  const currentAlbumName = currentTrack?.album || '';
  // Compute effective glow settings
  const effectiveGlow = glowMode === 'per-album' && currentAlbumId && perAlbumGlow[currentAlbumId]
    ? perAlbumGlow[currentAlbumId]
    : { intensity: glowIntensity, rate: glowRate };

  const renderContent = () => {
    // Show loading state
    if (isLoading) {
      return (
        <LoadingCard standalone>
          <CardContent>
            <SkeletonContainer>
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </SkeletonContainer>
            <p style={{ textAlign: 'center', color: 'white', marginTop: '1rem' }}>Loading music from Spotify...</p>
          </CardContent>
        </LoadingCard>
      );
    }

    // Handle authentication errors
    if (error) {
      const isAuthError = error.includes('Redirecting to Spotify login') ||
        error.includes('No authentication token') ||
        error.includes('Authentication expired');

      if (isAuthError) {
        return (
          <LoadingCard standalone>
            <CardHeader>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', textAlign: 'center' }}>Connect to Spotify</h2>
            </CardHeader>
            <CardContent style={{ textAlign: 'center' }}>
              <p style={{ color: '#d1d5db', marginBottom: '1.5rem' }}>
                Sign in to your Spotify account to access your music. Requires Spotify Premium.
              </p>
              <Button
                onClick={() => spotifyAuth.redirectToAuth()}
                style={{ backgroundColor: theme.colors.accent }}
              >
                Connect Spotify
              </Button>
            </CardContent>
          </LoadingCard>
        );
      }

      return (
        <Alert variant="destructive" style={{ width: '100%' }}>
          <AlertDescription style={{ color: '#fecaca' }}>
            Error: {error}
          </AlertDescription>
        </Alert>
      );
    }

    // Show playlist selection when no playlist is selected
    if (!selectedPlaylistId || tracks.length === 0) {
      return (
        <Suspense fallback={
          <LoadingCard standalone>
            <CardContent>
              <SkeletonContainer>
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </SkeletonContainer>
              <p style={{ textAlign: 'center', color: 'white', marginTop: '1rem' }}>Loading playlist selection...</p>
            </CardContent>
          </LoadingCard>
        }>
          <PlaylistSelection onPlaylistSelect={handlePlaylistSelect} />
        </Suspense>
      );
    }


    return (
      <ContentWrapper>
          <LoadingCard backgroundImage={currentTrack?.image}>
            
           <CardContent style={{ position: 'relative', zIndex: 2 }}>
              <AlbumArt currentTrack={currentTrack} accentColor={accentColor} glowIntensity={effectiveGlow.intensity} glowRate={effectiveGlow.rate} albumFilters={albumFilters} />
            </CardContent>
            <CardContent style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2 }}>
              <SpotifyPlayerControls
                currentTrack={currentTrack}
                accentColor={accentColor}
                onPlay={() => spotifyPlayer.resume()}
                onPause={() => spotifyPlayer.pause()}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onShowPlaylist={() => setShowPlaylist(true)}
                onShowSettings={() => setShowSettings(true)}
                trackCount={tracks.length}
                showVideo={showVideo}
                onToggleVideo={() => setShowVideo(v => !v)}
                onAccentColorChange={handleAccentColorChange}
                onShowVisualEffects={() => setShowVisualEffects(true)}
              />
            </CardContent>
            <VisualEffectsMenu
              isOpen={showVisualEffects}
              onClose={() => setShowVisualEffects(false)}
              accentColor={accentColor}
              filters={albumFilters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
              glowIntensity={glowIntensity}
              setGlowIntensity={setGlowIntensity}
              glowRate={typeof glowRate === 'number' ? glowRate : DEFAULT_GLOW_RATE}
              setGlowRate={setGlowRate}
              glowMode={glowMode}
              setGlowMode={setGlowMode}
              perAlbumGlow={perAlbumGlow}
              setPerAlbumGlow={setPerAlbumGlow}
              currentAlbumId={currentAlbumId}
              currentAlbumName={currentAlbumName}
              effectiveGlow={effectiveGlow}
            />
          </LoadingCard>

        <PlaylistOverlay
          isOpen={showPlaylist}
          onClick={() => setShowPlaylist(false)}
        />

        <PlaylistDrawer isOpen={showPlaylist}>
          <PlaylistHeader>
            <PlaylistTitle>Playlist ({tracks.length} tracks)</PlaylistTitle>
            <CloseButton onClick={() => setShowPlaylist(false)}>×</CloseButton>
          </PlaylistHeader>

          <PlaylistContent>
            <Suspense fallback={<PlaylistFallback><PlaylistFallbackCard><div style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>Loading playlist...</div></PlaylistFallbackCard></PlaylistFallback>}>
              <Playlist
                tracks={tracks}
                currentTrackIndex={currentTrackIndex}
                accentColor={accentColor}
                onTrackSelect={(index) => {
                  playTrack(index);
                  setShowPlaylist(false); // Close drawer after selecting track
                }}
              />
            </Suspense>
          </PlaylistContent>
        </PlaylistDrawer>

      </ContentWrapper>
    );
  };

  return (
    <Container>
      {renderContent()}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentTrack={currentTrack}
        accentColor={accentColor}
        
      />
    </Container>
  );
};

export default AudioPlayerComponent;
