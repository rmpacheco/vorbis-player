import { useState, useEffect, memo, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { youtubeService } from '../services/youtube';
import { videoSearchOrchestrator } from '../services/videoSearchOrchestrator';
import { videoManagementService } from '../services/videoManagementService';
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
  border-radius: 1rem;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(0.375rem);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2);
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


// Global blacklist for non-embeddable videos (persists across component remounts and page refreshes)
const BLACKLIST_STORAGE_KEY = 'vorbis-player-video-blacklist';

// Load blacklist from localStorage on app start
const loadBlacklist = (): Set<string> => {
  try {
    const stored = localStorage.getItem(BLACKLIST_STORAGE_KEY);
    if (stored) {
      const array = JSON.parse(stored);
      return new Set(array);
    }
  } catch (error) {
    console.warn('Failed to load video blacklist from localStorage:', error);
  }
  return new Set<string>();
};

// Save blacklist to localStorage
const saveBlacklist = (blacklist: Set<string>): void => {
  try {
    localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(Array.from(blacklist)));
  } catch (error) {
    console.warn('Failed to save video blacklist to localStorage:', error);
  }
};

const globalVideoBlacklist = loadBlacklist();

const VideoPlayer = memo<VideoPlayerProps>(({ currentTrack }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPhase, setSearchPhase] = useState<string>('');
  const [error, setError] = useState<SearchError | null>(null);
  const [noEmbeddableVideos, setNoEmbeddableVideos] = useState(false);
  const [iframeLoadError, setIframeLoadError] = useState(false);

  const fetchVideoForTrack = useCallback(async (track: Track) => {
    if (!track) return;
    setLoading(true);
    setError(null);
    setNoEmbeddableVideos(false);
    setIframeLoadError(false);
    setSearchPhase('Checking saved videos...');
    
    try {
      // First check if we have a saved association for this track
      const savedAssociation = await videoManagementService.getVideoForTrack(track);
      
      if (savedAssociation) {
        setMediaItems([{
          id: savedAssociation.videoId,
          type: 'youtube',
          url: youtubeService.createEmbedUrl(savedAssociation.videoId, {
            autoplay: true,
            mute: true,
            loop: true,
            controls: true,
          }),
          title: savedAssociation.videoTitle,
          thumbnail: savedAssociation.videoThumbnail,
        }]);
        setSearchPhase('');
        setLoading(false);
        return;
      }
      
      // If no saved association, fall back to search
      setSearchPhase('Searching YouTube...');
      const blacklistedArray = Array.from(globalVideoBlacklist);
      const searchResult = await videoSearchOrchestrator.findAlternativeVideosWithMetadata(track, blacklistedArray);
      const bestVideo = searchResult.videos.length > 0 ? searchResult.videos[0] : null;
      
      // Check if all videos were filtered due to embedding restrictions
      if (searchResult.allFilteredDueToEmbedding && searchResult.videos.length === 0) {
        console.log(`All videos filtered due to embedding restrictions for "${track.name}" by ${track.artists}`);
        setNoEmbeddableVideos(true);
        setMediaItems([]);
        setSearchPhase('');
        return;
      }
      
      if (!bestVideo) {
        console.log(`No videos found for "${track.name}" by ${track.artists}`);
        // Check if we should show embedding error instead of generic no results
        if (searchResult.allFilteredDueToEmbedding) {
          console.log(`Setting noEmbeddableVideos for "${track.name}" - all results filtered due to embedding`);
          setNoEmbeddableVideos(true);
        } else {
          setError({
            type: 'no_results',
            message: 'No videos found for this track',
            details: `Could not find any suitable videos for "${track.name}" by ${track.artists}`,
            retryable: true
          });
        }
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
      console.error('Error in fetchVideoForTrack:', error);
      setError({
        type: error instanceof Error && error.message.includes('Rate limited') ? 'rate_limit' : 'network_error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined,
        retryable: true
      });
      setMediaItems([]);
      setNoEmbeddableVideos(false); // Reset embedding state on error
      setIframeLoadError(false); // Reset iframe error state on error
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

  // Show placeholder when no embeddable videos are available or iframe failed to load
  if ((noEmbeddableVideos || iframeLoadError) && !loading) {
    const reason = noEmbeddableVideos ? 'no embeddable videos available' : 'video failed to load';
    console.log(`VideoPlayer: Showing placeholder for "${currentTrack.name}" - ${reason}`);
    return (
      <Container>
        <AspectRatio ratio={16 / 9} className="w-full mb-4">
          <VideoContainer style={{ 
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            backdropFilter: 'none'
          }}>
            {/* Empty placeholder to maintain aspect ratio and allow album art to show through */}
          </VideoContainer>
        </AspectRatio>
      </Container>
    );
  }

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
      {error && !loading && !noEmbeddableVideos && !iframeLoadError && (
        <SearchErrorDisplay 
          error={error}
          onRetry={() => fetchVideoForTrack(currentTrack)}
          onSkip={() => setError(null)}
        />
      )}
      {mediaItems.length === 0 && !loading && !error && currentTrack && !noEmbeddableVideos && !iframeLoadError && (
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
                onError={() => {
                  // Add current video to blacklist when iframe fails to load
                  console.log(`Video ${currentVideoItem.id} failed to embed, adding to blacklist and hiding video player`);
                  globalVideoBlacklist.add(currentVideoItem.id);
                  saveBlacklist(globalVideoBlacklist);
                  // Set iframe load error to hide video player
                  setIframeLoadError(true);
                  // Clear current media items to prevent showing broken video
                  setMediaItems([]);
                }}
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
          </VideoContainer>
        </AspectRatio>
      )}
    </Container>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer; 