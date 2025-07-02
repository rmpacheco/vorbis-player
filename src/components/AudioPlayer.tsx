import { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import styled, { keyframes } from 'styled-components';
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
import VideoPlayer from './VideoPlayer';
import { extractDominantColor, getTransparentVariant } from '../utils/colorExtractor';
import SpotifyPlayerControls from './SpotifyPlayerControls';

// Styled components
const Container = styled.div`
  min-height: 100vh;
  width: 100%;
  ${flexCenter};
  padding: ${({ theme }: any) => theme.spacing.sm};
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.sm}) {
    padding: ${({ theme }: any) => theme.spacing.sm};
  }
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 48rem; /* 768px - matches playlist and video nicely */
  margin: 0 auto;
  padding-left: 1rem;
  padding-right: 1rem;
  box-sizing: border-box;
  position: absolute;
  z-index: 1000;
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.sm}) {
    max-width: 60rem;
  }
  @media (min-width: ${({ theme }: any) => theme.breakpoints.md}) {
    max-width: 72rem;
  }
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


const HeaderArea = styled.div`
  position: relative;
  z-index: 3;
  padding: 0rem 1rem 0 1rem;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  
  @media (max-width: 480px) {
    padding: 0rem 0.75rem 0 0.75rem;
    gap: 0.375rem;
  }
`;

const HeaderButton = styled.button<{ accentColor: string }>`
  border: none;
  background: rgba(115, 115, 115, 0.2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
  
  &:hover {
    background: rgba(115, 115, 115, 0.3);
  }
  
  @media (max-width: 480px) {
    padding: 0.375rem;
    
    svg {
      width: 1.25rem;
      height: 1.25rem;
    }
  }
`;

const LoadingCard = styled(Card) <{ backgroundImage?: string; standalone?: boolean }>`
  ${cardBase};
  position: relative;
  aspect-ratio: 1/1;
  overflow: hidden;
  border: 0px solid rgba(176, 27, 164, 0.5);
  border-radius: 1.25rem;
  border-top: 0px solid rgba(16, 182, 49, 0.5);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
  
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
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);

      inset: 0;
      left: -1.5rem;
      right: -1.5rem;
      top: -1.5rem;
      bottom: -1.5rem;
      // background-image: url(${backgroundImage});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: 1.25rem;
      z-index: 1;
      filter: blur(18px);
      mask-image: linear-gradient(to top, black 10rem, transparent 10rem);
      -webkit-mask-image: linear-gradient(to top, black 10rem, transparent 10rem);
      pointer-events: none;
      clip-path: inset(0 1.25rem);
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

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const VideoPlayerContainer = styled.div`
  margin: ${({ theme }: any) => theme.spacing.sm} ;
  
  /* Handle empty state when no embeddable videos */
  &:empty {
    display: none;
  }
`;


const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videoRefreshKey, setVideoRefreshKey] = useState(0);
  const [accentColor, setAccentColor] = useState<string>('goldenrod');
  const [showVideo, setShowVideo] = useState(false);

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

  // Extract dominant color from album art when track changes
  useEffect(() => {
    const extractColor = async () => {
      if (currentTrack?.image) {
        try {
          const dominantColor = await extractDominantColor(currentTrack.image);
          if (dominantColor) {
            setAccentColor(dominantColor.hex);
          } else {
            setAccentColor('goldenrod'); // Fallback
          }
        } catch (error) {
          console.error('Failed to extract color from album art:', error);
          setAccentColor('goldenrod'); // Fallback
        }
      } else {
        setAccentColor('goldenrod'); // Fallback when no image
      }
    };

    extractColor();
  }, [currentTrack?.image]);

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
                style={{ backgroundColor: 'goldenrod' }}
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
            {/* Header with Settings and Playlist buttons */}
            <HeaderArea>
              <HeaderButton 
                accentColor={accentColor} 
                onClick={() => setShowSettings(true)}
                title="Settings"
              >
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
                </svg>
              </HeaderButton>
              
              <HeaderButton 
                accentColor={accentColor} 
                onClick={() => setShowPlaylist(true)}
                title="Playlist"
              >
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
                </svg>
              </HeaderButton>
            </HeaderArea>

            <CardContent style={{ position: 'absolute', bottom: `0.5rem`, left: 0, right: 0, zIndex: 2 }}>
              <VideoPlayerContainer>
                <Suspense fallback={<div style={{ minHeight: 320 }}>Loading video player...</div>}>
                  <VideoPlayer key={videoRefreshKey} currentTrack={currentTrack} showVideo={showVideo} />
                </Suspense>
              </VideoPlayerContainer>

              <SpotifyPlayerControls
                currentTrack={currentTrack}
                accentColor={accentColor}
                onPlay={() => spotifyPlayer.resume()}
                onPause={() => spotifyPlayer.pause()}
                onNext={handleNext}
                onPrevious={handlePrevious}
                trackCount={tracks.length}
                showVideo={showVideo}
                onToggleVideo={() => setShowVideo(v => !v)}
              />
            </CardContent>
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
        onVideoChanged={() => {
          // Force VideoPlayer to refresh by changing its key
          setVideoRefreshKey(prev => prev + 1);
        }}
      />
    </Container>
  );
};

export default AudioPlayerComponent;
