import { useState, useEffect, memo, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { youtubeService } from '../services/youtube';
import { videoSearchOrchestrator } from '../services/videoSearchOrchestrator';
import { AspectRatio } from './ui/aspect-ratio';
import { LoadingIndicator } from './ui/LoadingIndicator';
import { SearchErrorDisplay, type SearchError } from './ui/SearchErrorDisplay';
import { FallbackVideoDisplay } from './ui/FallbackVideoDisplay';

interface MediaItem {
  id: string;
  type: 'youtube' | 'image';
  url: string;
  title?: string;
  thumbnail?: string;
}

interface VideoPlayerProps {
  currentTrack: Track | null;
}

const Container = styled.div`
  width: 100%;
`;

const VideoContainer = styled.div`
  position: relative;
  border-radius: 0.5rem;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(0.375rem);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  width: 100%;
  height: 100%;
`;

const StyledIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: 0;
`;

const StyledImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TitleOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
  padding: 0.75rem;
`;

const TitleText = styled.p`
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const VideoPlayer = memo<VideoPlayerProps>(({ currentTrack }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPhase, setSearchPhase] = useState<string>('');
  const [error, setError] = useState<SearchError | null>(null);

  const fetchVideoForTrack = useCallback(async (track: Track) => {
    if (!track) return;
    setLoading(true);
    setError(null);
    setSearchPhase('Searching YouTube...');
    try {
      const bestVideo = await videoSearchOrchestrator.findBestVideo(track);
      if (!bestVideo) {
        setError({
          type: 'no_results',
          message: 'No videos found for this track',
          details: `Could not find any suitable videos for "${track.name}" by ${track.artists}`,
          retryable: true
        });
        setMediaItems([]);
        return;
      }
      setMediaItems([{
        id: bestVideo.id,
        type: 'youtube',
        url: youtubeService.createEmbedUrl(bestVideo.id, {
          autoplay: true,
          mute: true,
          loop: true,
          controls: true,
        }),
        title: bestVideo.title,
        thumbnail: bestVideo.thumbnailUrl,
      }]);
      setSearchPhase('');
    } catch (error) {
      setError({
        type: error instanceof Error && error.message.includes('Rate limited') ? 'rate_limit' : 'network_error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined,
        retryable: true
      });
      setMediaItems([]);
    } finally {
      setLoading(false);
      setSearchPhase('');
    }
  }, []);

  useEffect(() => {
    if (!currentTrack) return;
    fetchVideoForTrack(currentTrack);
  }, [currentTrack, fetchVideoForTrack]);

  if (!currentTrack) return null;

  const currentVideoItem = mediaItems.length > 0 ? mediaItems[0] : null;

  return (
    <Container>
      {loading && (
        <LoadingIndicator 
          variant="search" 
          message={searchPhase || "Searching for videos..."}
          className="py-8"
        />
      )}
      {error && !loading && (
        <SearchErrorDisplay 
          error={error}
          onRetry={() => fetchVideoForTrack(currentTrack)}
          onSkip={() => setError(null)}
        />
      )}
      {mediaItems.length === 0 && !loading && !error && currentTrack && (
        <FallbackVideoDisplay 
          track={currentTrack}
          onSearchRetry={() => fetchVideoForTrack(currentTrack)}
        />
      )}
      {currentVideoItem && (
        <AspectRatio ratio={16 / 9} className="w-full mb-4">
          <VideoContainer>
            {currentVideoItem.type === 'youtube' ? (
              <StyledIframe
                src={currentVideoItem.url}
                title={currentVideoItem.title}
                style={{
                  transform: 'scale(1.0)',
                  transformOrigin: 'center center'
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            ) : (
              <StyledImage
                src={currentVideoItem.url}
                alt={currentVideoItem.title}
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=${encodeURIComponent(currentVideoItem.title || 'No Image')}`;
                }}
              />
            )}
            {currentVideoItem.title && (
              <TitleOverlay>
                <TitleText>
                  {currentVideoItem.title}
                </TitleText>
              </TitleOverlay>
            )}
          </VideoContainer>
        </AspectRatio>
      )}
    </Container>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer; 