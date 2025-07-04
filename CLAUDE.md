# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Vorbis Player** - a React-based audio-visual player that combines Spotify music streaming with intelligent YouTube video discovery. The app streams music from a user's Spotify account and automatically finds relevant YouTube videos for each track, creating a unified music-video experience with advanced content filtering and persistent learning capabilities.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
tsc -b && vite build

# Lint code
npm run lint

# Preview production build
npm run preview

# Testing
npm run test           # Run tests in watch mode
npm run test:run       # Run tests once
npm run test:ui        # Run tests with UI
npm run test:coverage  # Run tests with coverage

# Proxy server commands (for YouTube search bypass)
npm run proxy:install    # Install proxy server dependencies
npm run proxy:start      # Start proxy server
npm run proxy:dev        # Start proxy server in development mode
npm run proxy:test       # Test proxy server health
npm run dev:all          # Start both proxy and dev server
npm run start:all        # Start both proxy and preview server
```

## Architecture

### Core Components Flow

1. **App.tsx** - Handles Spotify OAuth authentication flow and renders the main AudioPlayerComponent
2. **AudioPlayerComponent** - Main orchestrator that manages audio playback, track selection, and coordinates between playlist and video display. Includes integrated VideoPlayer within a unified card interface with consistent 1.5rem control icons
3. **VideoPlayer** - Handles YouTube video discovery, embedding, and retry logic with persistent blacklist system
4. **PlaylistIcon** - Spotify-inspired queue icon integrated into player controls with accessibility features and responsive design (1.5rem sizing)
5. **SettingsIcon** - Settings gear icon integrated into player controls for accessing configuration options (1.5rem sizing)
6. **VolumeIcon** - Volume trigger icon integrated into player controls with consistent 1.5rem sizing for visual uniformity
7. **PaintbrushIcon** - Visual effects trigger icon integrated into player controls for accessing shimmer and glow effects (1.5rem sizing)
8. **SettingsModal** - Unified settings interface with video management and configuration options
9. **VideoManagementSection** - Video-track association management component embedded within settings modal
10. **VolumeModal** - Responsive volume control modal with slider (desktop) and toggle buttons (mobile)
11. **VisualEffectsMenu** - Bottom sliding menu for controlling shimmer and glow effects with real-time sliders
12. **LikeButton** - Heart-shaped toggle button for saving/removing tracks from user's Spotify Liked Songs library with smooth animations, loading states, and consistent 1.5rem sizing
13. **Playlist** - Collapsible drawer interface showing track listing with current track highlighting

### Key State Management

- `currentTrackIndex`: Tracks which song is currently selected/playing
- `showPlaylist`: Controls visibility of the sliding playlist drawer
- `showSettings`: Controls visibility of the settings modal interface
- `showVolumeModal`: Controls visibility of the volume control modal
- `showVisualEffects`: Controls visibility of the visual effects menu
- `shimmerIntensity`: Controls shimmer effect intensity (0-100) with localStorage persistence
- `glowIntensity`: Controls glow effect intensity (0-100) with localStorage persistence
- `accentColor`: Dynamically extracted dominant color from album artwork
- `volume`: Current volume level (0-100) for Spotify player integration
- `isMuted`: Boolean state for mute/unmute functionality
- `isInitialLoad`: Prevents auto-play from triggering multiple times
- `globalVideoBlacklist`: Persistent Set of failed video IDs stored in localStorage
- Track selection sync: When users click playlist items vs. use audio player next/prev buttons
- Auto-play progression: Seamless advancement between tracks with end-of-song detection

### Authentication & Data Flow

- **Spotify Integration**: Uses PKCE OAuth flow for secure authentication with required scopes
- **Music Streaming**: Streams from user's Spotify playlists using Web Playback SDK (Premium required)
- **Video Discovery**: Intelligent YouTube search via proxy server to bypass CORS restrictions
- **Content Filtering**: Advanced filtering removes ads, promotional content, and low-quality videos
- **Persistent Learning**: Failed video IDs are stored in localStorage and excluded from future searches

### Video Discovery Architecture

- **YouTube Search Service**: Web scraping approach via local proxy server with rate limiting and caching
- **Video Search Orchestrator**: Coordinates search, filtering, and quality scoring with fallback strategies
- **Content Filter Service**: Filters ads, promotional content, low-quality videos with channel quality assessment
- **Video Quality Service**: Assesses video resolution and quality metrics
- **Blacklist System**: Global persistent blacklist prevents retry loops for non-embeddable videos
- **Retry Mechanism**: Hover overlay allows manual retry with alternative video discovery

## Environment Configuration

Required environment variables in `.env.local`:

```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

Optional (for backward compatibility):

```
VITE_DROPBOX_APP_KEY="your_dropbox_app_key"
VITE_DROPBOX_REDIRECT_URI="http://127.0.0.1:3000/auth/dropbox/callback"
```

## Critical Implementation Details

### Auto-Play System

- **Initial Auto-Play**: First song automatically starts when tracks are loaded
- **Auto-Advance**: Detects song end via Spotify player state (within 1s of completion) and advances to next track
- **Infinite Loop**: Returns to first track after last song for continuous playback
- **State Management**: Uses `isInitialLoad` flag and proper useEffect dependency ordering to prevent initialization errors

### Video Blacklist System

- **Global Persistence**: `globalVideoBlacklist` Set stored in localStorage as 'vorbis-player-video-blacklist'
- **Automatic Exclusion**: All video searches exclude blacklisted IDs to prevent retry loops
- **Manual Blacklisting**: Retry button adds current video to blacklist before searching alternatives
- **Cross-Session Memory**: Blacklist survives browser restarts and page refreshes
- **Cache Integration**: Works with video search orchestrator's `findAlternativeVideos` method

### Volume Modal System

- **Responsive Interface**: Modal with different controls based on device type
- **Desktop Experience**: Full volume slider (0-100%) with real-time visual feedback
- **Mobile Experience**: Volume adjustment buttons (+10/-10) with current level display
- **Smart State Management**: Auto-mute at 0%, auto-unmute when increasing volume
- **Keyboard Accessibility**: Arrow keys for volume adjustment, space for mute, escape to close
- **Glass Morphism Styling**: Backdrop blur with semi-transparent background matching app design
- **Accent Color Integration**: Dynamic theming using album artwork dominant colors

### Settings Modal System

- **Integrated Icon**: Settings gear icon integrated into audio player controls alongside playlist and volume buttons
- **Unified Interface**: Modal dialog with organized sections for different configuration areas
- **Video Management**: Complete video-track association management embedded within settings
- **Responsive Design**: 500px width on desktop with max-height constraints, full-width on mobile
- **Glass Morphism Styling**: Backdrop blur with semi-transparent background matching app design
- **Keyboard Navigation**: Full accessibility with escape key support and focus management
- **Sectioned Layout**: Organized into Video Management, Playback, and Interface categories
- **Expandable Settings**: Advanced settings sections can be collapsed/expanded for better organization
- **Consistent Icon Sizing**: All control icons (settings, playlist, volume, visual effects) standardized to 1.5rem for visual consistency

### Playlist Drawer System

- **Integrated Icon**: Spotify-inspired queue icon integrated into audio player controls with consistent 1.5rem sizing
- **Sliding Drawer**: Fixed-position drawer slides from right with smooth animations
- **Responsive Design**: 400px width on desktop, full-width on mobile
- **Overlay Backdrop**: Click-to-close overlay with blur effects
- **Auto-Close**: Drawer closes automatically when user selects a track
- **Space Optimization**: Icon integration maximizes video viewing area while keeping playlist accessible
- **Accessibility**: Full keyboard navigation and screen reader support with track count announcements
- **Touch Optimized**: Larger touch targets on mobile with appropriate hover state handling

### Like Songs System

- **Real-time State Sync**: Checks current like status when tracks load and updates UI immediately
- **Optimistic Updates**: UI responds instantly to like/unlike actions with smooth heart animations
- **Error Handling**: Graceful fallback and retry logic for failed API calls with user feedback
- **Heart Animation**: Custom keyframe animations including heartbeat effect and scale transitions
- **Loading States**: Spinner overlay during API calls prevents double-clicks and provides visual feedback
- **Consistent Integration**: 1.5rem sizing matches other control buttons with proper accessibility
- **Keyboard Support**: Full keyboard navigation with Enter/Space key support and focus indicators
- **ARIA Compliance**: Proper labeling and role attributes for screen reader compatibility

### Visual Effects System

- **Paintbrush Integration**: Paintbrush icon integrated into audio player controls alongside settings, playlist, and volume buttons
- **Side Sliding Menu**: Visual effects menu slides from right side with smooth animations and glass morphism styling
- **Album Art Filters**: Real-time CSS filters applied to album artwork including:
  - Brightness, contrast, saturation, hue rotation
  - Blur, sepia, grayscale, invert effects
  - Smooth transitions with 0.3s ease timing
- **Filter Controls**: Individual sliders for each filter type with real-time preview
- **Persistent Settings**: All filter values stored in localStorage with key 'vorbis-player-album-filters'
- **Dynamic Theming**: Slider thumbs and accents use extracted dominant color for visual consistency
- **Reset Functionality**: One-click reset to restore default filter values
- **Performance Optimized**: CSS filters applied directly to DOM elements for hardware acceleration
- **CRITICAL**: AlbumArt component must receive `albumFilters` prop to apply filter changes
- **Type Consistency**: Filter `invert` property expects boolean in AlbumArtFilters but number in VisualEffectsMenu interface

### YouTube Integration Challenges

- **CORS Bypass**: Uses local proxy server for YouTube search to avoid browser restrictions
- **Embedding Detection**: Client-side detection of YouTube embedding restrictions is limited by CORS
- **Retry Strategy**: Manual retry system with hover overlay when videos fail to embed
- **Rate Limiting**: Implemented in YouTube search service with exponential backoff

### Spotify Integration

- **Web Playback SDK**: High-quality music streaming with full playback controls
- **Player State Monitoring**: Real-time state changes for auto-advance and track synchronization
- **Premium Requirement**: Playback functionality requires Spotify Premium subscription
- **Token Management**: Automatic token refresh for long-term authentication sessions
- **Authentication Flow**: Handles callback at `http://127.0.0.1:3000/auth/spotify/callback`

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: styled-components with custom theme system and Radix UI components
- **Audio**: Spotify Web Playback SDK
- **Video**: YouTube iframe embedding with intelligent discovery via proxy server
- **Authentication**: Spotify Web API with PKCE OAuth
- **Content Intelligence**: Advanced filtering and quality assessment algorithms
- **Storage**: localStorage for persistent blacklist and user preferences
- **UI Components**: Radix UI primitives with custom styled-components
- **State Management**: React hooks with localStorage persistence
- **Build Tool**: Vite with HMR and concurrent proxy server support
- **Testing**: Vitest with React Testing Library and jsdom

## Service Layer Architecture

### YouTube Services

- **youtubeSearch.ts**: Core YouTube search with web scraping via proxy, caching, and rate limiting
- **videoSearchOrchestrator.ts**: High-level coordination of video discovery with quality scoring and fallback strategies
- **contentFilter.ts**: Filters out ads, promotional content, and low-quality videos with channel assessment
- **videoQuality.ts**: Assesses video resolution and quality metrics
- **youtube.ts**: Basic YouTube utilities for video ID extraction and embed URL creation

### Spotify Services

- **spotify.ts**: Spotify Web API integration for playlists and authentication, includes track library management functions for checking, saving, and removing tracks from user's Spotify Liked Songs
- **spotifyPlayer.ts**: Spotify Web Playback SDK wrapper with state management

### Support Services

- **adminService.ts**: Admin panel functionality (legacy from previous version)
- **dropbox.ts**: Dropbox integration (legacy, kept for backward compatibility)
- **trackVideoAssociationService.ts**: Manages track-video associations for video management
- **videoManagementService.ts**: Video management utilities and operations

## Proxy Server Integration

The application includes a Node.js proxy server in `proxy-server/` directory to bypass CORS restrictions for YouTube search:

- **Purpose**: Enables client-side YouTube video discovery without API keys
- **Development**: Use `npm run dev:all` to start both proxy and client simultaneously
- **Health Check**: `npm run proxy:test` verifies proxy server is running
- **Production**: Proxy server must be deployed alongside the client application

## Common Issues & Solutions

### Album Art Filters Not Working
- **Root Cause**: Missing `albumFilters` prop in AlbumArt component
- **Solution**: Always pass `albumFilters={albumFilters}` to AlbumArt component
- **Location**: AudioPlayer.tsx line ~704

### Type Inconsistencies
- **Filter Types**: Ensure filter interfaces match between components
- **Invert Property**: AlbumArtFilters expects boolean, VisualEffectsMenu uses number
- **Solution**: Standardize on single type across all filter components

### Development Workflow
- **Always run both servers**: Use `npm run dev:all` for full functionality
- **Test proxy health**: Run `npm run proxy:test` if videos not loading
- **Component hierarchy**: AudioPlayer → AlbumArt → AlbumArtFilters for filter application

# Command Instructions

- /commit means you are to commit the current working changes to the current branch.   unless otherwise instructed, you should split the changes into logically related commits in the correct sequential order
- /doc means you need to update README.md
- /comdoc means you need to do everything from /doc, then everything from /commit (in that order)

