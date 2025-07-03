# Vorbis Player

A modern audio-visual player that combines Spotify music streaming with intelligent YouTube video discovery. Experience your music with automatic video accompaniment and a sleek, unified interface designed for continuous entertainment.

<img src="src/assets/screenshot-player.png" alt="Vorbis Player" width="600">
<img src="src/assets/screenshot-playlist.png" alt="Vorbis Player - Playlist" width="600">

## Features

### 🎵 Audio Experience
- **Spotify Integration**: Stream high-quality music from your Spotify account (Premium required)
- **Auto-Play & Continuous Playback**: Automatically starts first song and seamlessly advances through tracks
- **Infinite Playlist**: Loops back to beginning when reaching the end of your music collection
- **Smart Retry System**: Hover over videos to retry with alternative content when embedding fails

### 🎬 Visual Experience  
- **Intelligent Video Discovery**: Automatically finds relevant YouTube videos for each track
- **Persistent Blacklist**: Remembers and avoids non-embeddable videos across sessions
- **Integrated Player Card**: Video and audio controls unified in a single elegant interface
- **Dynamic Album Art Background**: Blurred album artwork creates immersive visual atmosphere
- **Seamless Video Placeholders**: When no video is available, shows clear album art through transparent "window" effect while maintaining consistent card sizing
- **Smooth Loading States**: Simple spinner overlays during video search maintain layout stability

### 🎛️ User Interface
- **Three-Column Layout**: Track info, controls, and settings organized in an intuitive three-column design with optimized space utilization
- **Centered Control Layout**: Main playback controls (previous, play/pause, next) positioned in the center column for easy access
- **Timeline-Integrated Controls**: Settings and volume controls positioned along the timeline for compact, streamlined interface
- **Fixed-Size Layout**: Consistent 768px x 880px dimensions for predictable layout and optimal viewing experience
- **Unified Settings Modal**: Comprehensive settings interface with video management and configuration options
- **Sliding Playlist Drawer**: Space-saving collapsible playlist accessible from anywhere with 1.5rem consistent icon sizing
- **Square Video Format**: 1:1 aspect ratio video display optimized for modern mobile-first viewing
- **Warm Color Palette**: Warmer background tones (rgba(85, 78, 78, 0.56)) for comfortable viewing
- **Enhanced Color Extraction**: Improved accent color selection with higher saturation (50%) and lightness (40%) thresholds for more vibrant colors
- **Refined Blur Effects**: Optimized backdrop blur (24px) for better visual clarity while maintaining glass morphism design
- **Mobile-Optimized**: Reduced minimum width (585px) and touch-friendly controls for all devices
- **Accessibility-First**: Full keyboard navigation and screen reader support

### 🔒 Security & Performance
- **Secure Authentication**: PKCE OAuth flow for safe Spotify access
- **Client-Side Intelligence**: Advanced video filtering and quality assessment
- **Persistent Storage**: Remembers failed videos and user preferences locally

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Spotify Premium account
- Access to Spotify Developer Dashboard

### Installation

1. **Clone and install dependencies**

   ```bash
   git clone git@github.com:rmpacheco/vorbis-player.git
   cd vorbis-player
   npm install
   ```

2. **Set up Spotify App**
   - Create a new app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Choose "Web Playback SDK" for planned API usage
   - Add redirect URI: `http://127.0.0.1:3000/auth/spotify/callback`
   - **Important**: Use `127.0.0.1` instead of `localhost` for Spotify OAuth compatibility
   - Copy your Client ID

3. **Configure environment**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Spotify Client ID
   ```

   Required in `.env.local`:

   ```
   VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id_here"
   VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
   ```

4. **Prepare your Spotify account**
   - Ensure you have a Spotify Premium subscription
   - Create playlists with your favorite music
   - The app will access your playlists to display tracks

5. **Set up the proxy server (for YouTube video discovery)**

   ```bash
   npm run proxy:install
   ```

6. **Start the app**

   For development with full video functionality:
   ```bash
   npm run dev:all  # Starts both proxy server and dev server
   ```

   Or start components separately:
   ```bash
   npm run proxy:start  # Start proxy server (in separate terminal)
   npm run dev          # Start development server (in another terminal)
   ```

7. **First run**
   - Open <http://127.0.0.1:3000>
   - Click "Connect Spotify" to authenticate
   - Music starts automatically with accompanying videos
   - Use the queue icon to browse your playlist
   - Access settings via the gear icon for video management
   - Hover over any video to retry with alternative content if needed

## How It Works

### Audio-Visual Integration

- **Spotify Streaming**: High-quality music from your personal playlists and library
- **YouTube Discovery**: Intelligent search for relevant music videos using advanced filtering
- **Smart Matching**: Content filtering removes ads, low-quality, and irrelevant videos
- **Automatic Progression**: Seamless transitions between tracks with continuous video playback
- **Retry System**: Manual retry option finds alternative videos when embedding fails

### Interface Management

- **Three-Column Layout**: Track information, centered controls, and settings organized in a clean three-column design for optimal space efficiency
- **Centered Playback Controls**: Main playback buttons (previous, play/pause, next) positioned in the center column for primary access
- **Timeline-Integrated Controls**: Settings and volume controls positioned along the timeline for streamlined secondary access
- **Smart Control Placement**: Like button and playlist on the right, settings and volume on the left for intuitive operation
- **Fixed Dimensions**: Consistent 768px x 880px layout provides predictable viewing experience across all devices
- **Settings Modal**: Comprehensive settings system with video management, playback preferences, and configuration options
- **Collapsible Playlist**: Playlist drawer slides out when needed, maximizing video space with consistent 1.5rem icon sizing
- **Track Selection**: Click any song to jump immediately to that track
- **Square Video Display**: 1:1 aspect ratio optimized for modern viewing preferences and mobile devices
- **Enhanced Shadow Effects**: Improved container shadows with inset effects for better depth perception
- **Visual Feedback**: Current track highlighting and album artwork throughout interface
- **Consistent Sizing**: Player card maintains stable dimensions during all loading states and content transitions
- **Responsive Design**: Mobile-optimized with 585px minimum width for better small-screen compatibility

### Authentication

- Uses secure PKCE OAuth flow
- Tokens stored locally with automatic refresh
- Required scopes: streaming, user-read-email, user-read-private, user-read-playback-state
- Requires Spotify Premium for playback functionality

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run lint         # Run ESLint
npm run preview      # Preview production build

# Proxy server commands (for YouTube search bypass)
npm run proxy:install    # Install proxy server dependencies
npm run proxy:start      # Start proxy server
npm run proxy:dev        # Start proxy server in development mode
npm run proxy:test       # Test proxy server health
npm run dev:all          # Start both proxy and dev server
npm run start:all        # Start both proxy and preview server
```

### Project Structure

```
src/
├── components/           # React components
│   ├── AudioPlayer.tsx  # Main orchestrator with integrated video player
│   ├── VideoPlayer.tsx  # YouTube video discovery and display
│   ├── Playlist.tsx     # Collapsible track listing drawer
│   ├── PlaylistIcon.tsx # Playlist queue icon component
│   ├── PlaylistSelection.tsx # Playlist selection interface
│   ├── LikeButton.tsx    # Heart-shaped button for liking/unliking tracks with animations
│   ├── SettingsModal.tsx # Unified settings interface
│   ├── SettingsIcon.tsx # Settings gear icon component
│   ├── SpotifyAudioPlayer.tsx # Core Spotify audio playback component
│   ├── SpotifyPlayerControls.tsx # Three-column player control interface with timeline-integrated controls
│   ├── VideoManagementSection.tsx # Video management component for settings
│   ├── VideoManagementSettings.tsx # Video management settings component
│   ├── VideoManagementButton.tsx # Button for video management access
│   ├── admin/           # Admin components
│   │   └── VideoAdmin.tsx # Video administration interface
│   ├── styled/          # styled-components UI library
│   │   ├── Avatar.tsx   # Image component with fallback support
│   │   ├── Button.tsx   # Button component with variants
│   │   ├── Card.tsx     # Card layout components
│   │   ├── Alert.tsx    # Alert component
│   │   ├── ScrollArea.tsx # Scrollable area component
│   │   ├── Skeleton.tsx # Loading skeleton component
│   │   ├── Slider.tsx   # Slider input component
│   │   └── index.ts     # Component exports
│   └── ui/              # Radix UI components and utilities
│       ├── FallbackVideoDisplay.tsx # Video fallback display
│       ├── LoadingIndicator.tsx # Loading spinner component
│       ├── SearchErrorDisplay.tsx # Error display for search failures
│       ├── youtube-integration.tsx # YouTube integration utilities
│       └── [various UI components] # Additional UI primitives
├── hooks/               # Custom React hooks
│   └── useDebounce.ts  # Debouncing utility hook
├── services/            # External service integrations
│   ├── spotify.ts      # Spotify Web API integration
│   ├── spotifyPlayer.ts # Spotify Web Playback SDK
│   ├── youtubeSearch.ts # YouTube video discovery service
│   ├── videoSearchOrchestrator.ts # Intelligent video matching
│   ├── contentFilter.ts # Video quality and relevance filtering
│   ├── videoQuality.ts  # Video resolution and quality assessment
│   ├── videoManagementService.ts # Video management utilities
│   ├── trackVideoAssociationService.ts # Track-video associations
│   ├── youtube.ts      # YouTube utilities and helpers
│   └── adminService.ts # Admin functionality service
├── styles/             # Styling system
│   ├── theme.ts        # Design tokens and theme configuration
│   └── utils.ts        # styled-components utility mixins
└── lib/                # Utilities
    └── utils.ts        # Helper functions

public/
├── sw.js               # Service worker for caching and offline support
└── vorbis_player_logo.jpg # Application logo

proxy-server/           # Node.js proxy server for YouTube search
├── server.js          # Express server for CORS bypass
├── package.json       # Proxy server dependencies
└── README.md          # Proxy server documentation
```

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: styled-components with custom theme system and Radix UI primitives
- **Audio**: Spotify Web Playback SDK
- **Video**: YouTube iframe embedding with intelligent discovery via proxy server
- **Authentication**: Spotify Web API with PKCE OAuth
- **Content Intelligence**: Advanced filtering and quality assessment algorithms
- **Storage**: localStorage for persistent blacklist and user preferences
- **UI Components**: Radix UI primitives with custom styled-components
- **Build Tool**: Vite with HMR and concurrent proxy server support

## Deployment

Build for production:

```bash
npm run build
```

The `dist/` folder contains static files that can be deployed to any web hosting service (Vercel, Netlify, GitHub Pages, etc.).

### Proxy Server Deployment

For full video functionality in production, the proxy server must also be deployed:

1. **Deploy the proxy server** to a Node.js hosting service (Railway, Render, Heroku, etc.)
2. **Update the YouTube search service** to use your production proxy URL
3. **Configure CORS** in the proxy server for your production domain

**Important**: 
- Update the Spotify redirect URI in your app settings to match your production domain
- The proxy server is required for YouTube video discovery due to CORS restrictions
- Without the proxy server, the app will function but videos won't load automatically

## Troubleshooting

### "No tracks found"

- Ensure you have a Spotify Premium subscription
- Create playlists with music or like some songs in Spotify
- Check that your Spotify account has music accessible
- Verify your Spotify app has the correct scopes and permissions

### Video Issues

- **"Video unavailable"**: Hover over the video and click "🔄 Try Another" to find alternative content
- **No videos loading**: The app automatically searches for alternatives; this is normal behavior
- **Persistent video failures**: The system learns and avoids problematic videos automatically

### Authentication Issues

- Double-check your Client ID in `.env.local`
- Ensure redirect URI matches exactly in both `.env.local` and Spotify app settings
- Use `127.0.0.1` instead of `localhost` for Spotify OAuth compatibility
- Try clearing browser storage and re-authenticating

### Proxy Server Issues

- **Check proxy server status**: Run `npm run proxy:test` to verify it's running
- **Proxy server not starting**: Ensure Node.js is installed and run `npm run proxy:install`
- **Videos not loading**: Verify proxy server is running on port 3001
- **Development setup**: Use `npm run dev:all` to start both proxy and client together

### Performance Issues

- Clear localStorage to reset video blacklist: `localStorage.clear()` in browser console
- Refresh the page if videos stop loading consistently
- The app is optimized for continuous playback; occasional video misses are expected
- If proxy server becomes unresponsive, restart it with `npm run proxy:start`
