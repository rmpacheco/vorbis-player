/**
 * Track data interface for Spotify tracks
 */
export interface Track {
  id: string;
  name: string;
  artists: string;
  album: string;
  duration_ms: number;
  uri: string;
  preview_url?: string;
  image?: string;
}