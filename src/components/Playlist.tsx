import { memo, useMemo, useCallback } from 'react';
import type { Track } from '../services/spotify';

interface PlaylistProps {
  tracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
}

interface PlaylistItemProps {
  track: Track;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
}

const PlaylistItem = memo<PlaylistItemProps>(({ 
  track, 
  index, 
  isSelected, 
  onSelect 
}) => {
  return (
    <tr
      onClick={() => onSelect(index)}
      className={`cursor-pointer transition-all duration-150 hover:bg-neutral-700/50 border-b border-neutral-600/80 ${
        isSelected 
          ? 'bg-neutral-600 text-white shadow-sm border-neutral-500' 
          : 'text-neutral-300 hover:text-neutral-100'
      }`}
    >
      <td className={`px-3 md:px-6 py-4 md:py-5 text-sm ${
        isSelected ? 'text-white font-medium' : 'text-neutral-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="truncate pr-2 font-bold text-base leading-tight">{track.name}</div>
            <div className="text-xs text-neutral-400 md:hidden truncate mt-1 font-normal opacity-75">
              {track.artists}
            </div>
          </div>
          {isSelected && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 text-green-400">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </div>
      </td>
      <td className={`hidden md:table-cell px-6 py-4 md:py-5 text-sm ${
        isSelected ? 'text-white' : 'text-neutral-400'
      }`}>
        <span className="truncate block">{track.artists}</span>
      </td>
      <td className={`px-3 md:px-6 py-4 md:py-5 text-sm text-center ${
        isSelected ? 'text-white' : 'text-neutral-400'
      }`}>
        <span className="text-sm font-mono tabular-nums">
          {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
        </span>
      </td>
    </tr>
  );
});

const Playlist = memo<PlaylistProps>(({ tracks, currentTrackIndex, onTrackSelect }) => {
  const sortedTracks = useMemo(() => tracks, [tracks]);
  
  const currentTrack = tracks[currentTrackIndex];
  const sortedCurrentTrackIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return sortedTracks.findIndex((track: Track) => track === currentTrack);
  }, [sortedTracks, currentTrack]);

  const handleTrackSelect = useCallback((sortedIndex: number) => {
    const selectedTrack = sortedTracks[sortedIndex];
    const originalIndex = tracks.findIndex((track: Track) => track === selectedTrack);
    if (originalIndex !== -1) {
      onTrackSelect(originalIndex);
    }
  }, [sortedTracks, tracks, onTrackSelect]);

  // Virtualization disabled to maintain proper table structure
  // If needed for large playlists, implement with div-based layout instead of table

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-neutral-700 table-fixed">
            <colgroup>
              <col className="w-4/5 md:w-3/4" />
              <col className="w-1/5 md:w-1/4 min-w-[56px]" />
            </colgroup>
            <thead className="bg-neutral-900">
              <tr>
                <th scope="col" className="px-3 md:px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Track
                </th>
                <th scope="col" className="px-3 md:px-6 py-3 text-center text-xs font-medium text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                  </svg>
                </th>
              </tr>
            </thead>
            <tbody className="bg-neutral-800 divide-y divide-neutral-700">
              {sortedTracks.map((track: Track, index: number) => (
                <tr
                  key={`${track.name}-${track.id}`}
                  onClick={() => handleTrackSelect(index)}
                  className={`cursor-pointer transition-all duration-150 hover:bg-neutral-700/50 border-b border-neutral-600/80 ${
                    index === sortedCurrentTrackIndex 
                      ? 'bg-neutral-600 text-white shadow-sm border-neutral-500' 
                      : 'text-neutral-300 hover:text-neutral-100'
                  }`}
                >
                  <td className={`px-3 md:px-6 py-4 md:py-5 text-sm ${
                    index === sortedCurrentTrackIndex ? 'text-white font-medium' : 'text-neutral-200'
                  } max-w-0 truncate`}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="truncate pr-2 font-bold text-base leading-tight">{track.name}</div>
                      </div>
                      {index === sortedCurrentTrackIndex && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 text-green-400">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </div>
                  </td>
                  <td className={`px-3 md:px-6 py-4 md:py-5 text-sm text-center ${
                    index === sortedCurrentTrackIndex ? 'text-white' : 'text-neutral-400'
                  } whitespace-nowrap`}>
                    <span className="text-sm font-mono tabular-nums">
                      {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default Playlist; 