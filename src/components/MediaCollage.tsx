import { useState, useEffect, memo, useCallback, useRef } from 'react';
import type { Track } from '../services/spotify';
import { youtubeService } from '../services/youtube';
import { videoSearchOrchestrator } from '../services/videoSearchOrchestrator';
import { HyperText } from './hyper-text';
import { Card, CardContent } from './ui/card';
import { Toggle } from './ui/toggle';
import { AspectRatio } from './ui/aspect-ratio';
import { cn } from '../lib/utils';
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

interface MediaCollageProps {
  currentTrack: Track | null;
}

const MediaCollage = memo<MediaCollageProps>(({ currentTrack }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPhase, setSearchPhase] = useState<string>('');
  const [error, setError] = useState<SearchError | null>(null);
  const [lockVideoToTrack, setLockVideoToTrack] = useState<boolean>(() => {
    const saved = localStorage.getItem('vorbis-player-lock-video');
    return saved === 'true';
  });
  const lockedVideoRef = useRef<MediaItem | null>(null);



  const fetchMediaContent = useCallback(async (track: Track) => {
    if (!track) return;

    setMediaItems([]);
    setLoading(true);
    setError(null);
    
    try {
      setSearchPhase('Searching YouTube...');
      
      // Use videoSearchOrchestrator to find the best video for the track
      const bestVideo = await videoSearchOrchestrator.findBestVideo(track);
      
      if (!bestVideo) {
        console.log(`No suitable video found for: ${track.name} by ${track.artists}`);
        setError({
          type: 'no_results',
          message: 'No videos found for this track',
          details: `Could not find any suitable videos for "${track.name}" by ${track.artists}`,
          retryable: true
        });
        setMediaItems([]);
        return;
      }

      setSearchPhase('Creating video embed...');

      const video: MediaItem = {
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
      };

      setMediaItems([video]);
      lockedVideoRef.current = video;
      setSearchPhase('');
    } catch (error) {
      console.error('Error fetching media content:', error);
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

    if (lockVideoToTrack && lockedVideoRef.current) {
      setMediaItems([lockedVideoRef.current]);
      return;
    }

    fetchMediaContent(currentTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTrack,
    fetchMediaContent
  ]);


  useEffect(() => {
    if (lockVideoToTrack && lockedVideoRef.current) {
      setMediaItems([lockedVideoRef.current]);
    }
  }, [lockVideoToTrack]);


  const handleLockVideoToggle = useCallback(() => {
    const newLockState = !lockVideoToTrack;
    setLockVideoToTrack(newLockState);
    localStorage.setItem('vorbis-player-lock-video', newLockState.toString());
  }, [lockVideoToTrack]);

  const handleShuffleVideo = useCallback(async () => {
    if (!currentTrack) return;
    
    setLoading(true);
    setError(null);
    setSearchPhase('Finding alternatives...');
    
    try {
      // Find alternative videos for the same track
      const currentVideoId = mediaItems[0]?.id;
      const excludeIds = currentVideoId ? [currentVideoId] : [];
      
      const alternativeVideos = await videoSearchOrchestrator.findAlternativeVideos(currentTrack, excludeIds);
      
      if (alternativeVideos.length > 0) {
        // Select a random alternative
        const randomIndex = Math.floor(Math.random() * alternativeVideos.length);
        const selectedVideo = alternativeVideos[randomIndex];
        
        const video: MediaItem = {
          id: selectedVideo.id,
          type: 'youtube',
          url: youtubeService.createEmbedUrl(selectedVideo.id, {
            autoplay: true,
            mute: true,
            loop: true,
            controls: true,
          }),
          title: selectedVideo.title,
          thumbnail: selectedVideo.thumbnailUrl,
        };

        setMediaItems([video]);
        if (!lockVideoToTrack) {
          lockedVideoRef.current = video;
        }
      } else {
        console.log(`No alternative videos found for: ${currentTrack.name}`);
        setError({
          type: 'no_results',
          message: 'No alternative videos found',
          details: `Could not find alternative videos for "${currentTrack.name}"`,
          retryable: true
        });
      }
    } catch (error) {
      console.error('Error shuffling video:', error);
      setError({
        type: error instanceof Error && error.message.includes('Rate limited') ? 'rate_limit' : 'network_error',
        message: error instanceof Error ? error.message : 'Shuffle failed',
        details: error instanceof Error ? error.stack : undefined,
        retryable: true
      });
    } finally {
      setLoading(false);
      setSearchPhase('');
    }
  }, [currentTrack, mediaItems, lockVideoToTrack]);

  const handleRetry = useCallback(() => {
    if (currentTrack) {
      fetchMediaContent(currentTrack);
    }
  }, [currentTrack, fetchMediaContent]);

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="w-full mb-6">
      <Card className="bg-white/5 backdrop-blur-sm border-white/10">
        <CardContent className="p-4">
          <div className="relative flex justify-between items-center mb-4">
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold text-white">
                Now Playing
              </h3>
              {currentTrack && (
                <p className="text-sm text-white/70 truncate">
                  {currentTrack.name} · {currentTrack.artists}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">

              {/* Video Lock Toggle */}
              <Toggle
                pressed={lockVideoToTrack}
                onPressedChange={handleLockVideoToggle}
                className={cn(
                  "px-3 py-1 text-sm font-medium transition-all duration-200",
                  "data-[state=on]:bg-blue-600/80 data-[state=on]:text-white data-[state=on]:shadow-sm",
                  "data-[state=off]:text-white/70 data-[state=off]:hover:text-white data-[state=off]:hover:bg-white/10 data-[state=off]:border data-[state=off]:border-white/20"
                )}
                title={lockVideoToTrack ? 'Video locked to track (click to unlock)' : 'Video changes with tracks (click to lock)'}
              >
                {lockVideoToTrack ? '🔒' : '🔓'}
              </Toggle>

              {loading && (
                <LoadingIndicator 
                  variant="search" 
                  phase={searchPhase}
                  className="h-5 w-5"
                />
              )}
            </div>
          </div>

          <div className="w-full">
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
                onRetry={handleRetry}
                onSkip={() => setError(null)}
              />
            )}
            
            {mediaItems.length === 0 && !loading && !error && currentTrack && (
              <FallbackVideoDisplay 
                track={currentTrack}
                onSearchRetry={handleRetry}
              />
            )}
            
            {mediaItems.map((item) => (
              <VideoItem key={item.id} item={item} />
            ))}
          </div>

          {/* Shuffle Bar - Full width clickable area */}
          {mediaItems.length > 0 && !loading && (
            <button
              onClick={handleShuffleVideo}
              className="group w-full py-3 bg-white/5 hover:bg-white/10 border-t border-b border-white/10 transition-all duration-200 active:bg-white/15 flex justify-center items-center"
              title="Click anywhere to shuffle video"
            >
              <HyperText
                duration={600}
                className="text-white text-lg font-semibold tracking-wider pointer-events-none"
                as="span"
              >
                SHUFFLE 🎵
              </HyperText>
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
});


const VideoItem = memo<{
  item: MediaItem;
}>(({ item }) => {
  return (
    <AspectRatio ratio={3 / 4} className="w-full">
      <div className="relative rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-105 hover:bg-white/20 w-full h-full">
        {item.type === 'youtube' ? (
          <iframe
            src={item.url}
            title={item.title}
            className="w-full h-full border-0"
            style={{
              transform: 'scale(1.0)',
              transformOrigin: 'center center'
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <img
            src={item.url}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=${encodeURIComponent(item.title || 'No Image')}`;
            }}
          />
        )}

        {item.title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-white text-sm font-medium truncate">
              {item.title}
            </p>
          </div>
        )}
      </div>
    </AspectRatio>
  );
});

VideoItem.displayName = 'VideoItem';

MediaCollage.displayName = 'MediaCollage';

export default MediaCollage;
