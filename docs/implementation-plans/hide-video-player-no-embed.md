# Implementation Plan: Hide Video Player for Non-Embeddable Videos

**Branch**: `fix/hide-video-player-no-embed`  
**Date**: 2025-07-01  
**Status**: Approved

## Overview
Fix the video player to hide when no embeddable videos are available while maintaining consistent card size to preserve the album art background experience.

## Problem Statement
- VideoPlayer has existing `noEmbeddableVideos` state but never sets it to `true`
- Current `:empty { display: none }` CSS causes jarring card resize when video is hidden
- Users lose visual continuity when video fails to embed
- Album art background space is wasted when video area collapses

## Solution Architecture

### Phase 1: Core Logic Implementation
**Objective**: Connect embedding detection to video hiding logic
**Parallelization**: Single agent task - requires deep understanding of component state

**Tasks**:
1. **Update VideoPlayer.tsx**:
   - Modify `fetchVideoForTrack()` to use `findAlternativeVideosWithMetadata()`
   - Set `noEmbeddableVideos = true` when `allFilteredDueToEmbedding` is true
   - Add proper error handling for embedding failures

2. **Test Embedding Detection**:
   - Verify `batchCheckEmbeddability()` integration
   - Test with known non-embeddable videos
   - Validate state transitions

### Phase 2: Layout Preservation
**Objective**: Maintain card size when video is hidden
**Parallelization**: Can be done in parallel with Phase 3

**Tasks**:
1. **Update VideoPlayerContainer Styling**:
   - Replace `:empty { display: none }` with height-preserving placeholder
   - Calculate and set min-height for 16:9 aspect ratio
   - Add smooth transitions for state changes

2. **Create Video Placeholder Component**:
   - Design minimal placeholder that shows album art background
   - Maintain aspect ratio consistency
   - Optional: Add subtle "no video available" message

### Phase 3: Enhanced User Experience
**Objective**: Improve feedback and interaction
**Parallelization**: Can be done in parallel with Phase 2

**Tasks**:
1. **Add User Feedback**:
   - Create subtle indication when video is hidden due to embedding restrictions
   - Add retry mechanism for manual video search
   - Integrate with existing blacklist system

2. **Improve Transitions**:
   - Smooth fade in/out for video player visibility
   - Consistent loading states
   - Prevent layout shifts during state changes

### Phase 4: Testing & Documentation
**Objective**: Ensure reliability and maintain documentation
**Parallelization**: Testing can be done in parallel by separate agent

**Tasks**:
1. **Automated Testing**:
   - Unit tests for embedding detection logic
   - Component tests for video hiding behavior
   - Integration tests for layout preservation

2. **Documentation Updates**:
   - Update README.md with new behavior
   - Update CLAUDE.md with implementation details
   - Add troubleshooting guide for embedding issues

## Optimal Parallelization Strategy

### Sequential Dependencies:
- Phase 1 must complete before Phase 2 (layout depends on state logic)
- Phase 4 testing requires Phase 1-3 completion

### Parallel Opportunities:
- **Agent A**: Phase 1 (Core Logic) → Phase 2 (Layout)
- **Agent B**: Phase 3 (UX Enhancement) → Phase 4 (Documentation)
- **Agent C**: Phase 4 (Testing) - starts after Phase 1 completion

### Coordination Points:
1. After Phase 1: Sync on state management approach
2. After Phase 2+3: Integration testing
3. After all phases: Final documentation review

## Technical Implementation Details

### Key Files to Modify:
1. **VideoPlayer.tsx** - Core logic changes
2. **AudioPlayer.tsx** - Container styling updates  
3. **New Component**: VideoPlaceholder.tsx (if needed)
4. **Test Files**: VideoPlayer.test.tsx, AudioPlayer.test.tsx

### State Management Changes:
```typescript
// In VideoPlayer.tsx
const handleSearchComplete = (result: VideoSearchResult) => {
  if (result.allFilteredDueToEmbedding && result.mediaItems.length === 0) {
    setNoEmbeddableVideos(true);
    setMediaItems([]);
  } else {
    setNoEmbeddableVideos(false);
    setMediaItems(result.mediaItems);
  }
};
```

### CSS/Styling Changes:
```css
VideoPlayerContainer {
  /* Replace display: none with height preservation */
  min-height: var(--video-aspect-height); /* Calculate 16:9 ratio */
  transition: opacity 0.3s ease;
  
  &[data-hidden="true"] {
    opacity: 0;
    /* Keep height but hide content */
  }
}
```

## Success Criteria
1. **Functional**: Video player hides when no embeddable videos found
2. **Visual**: Card maintains consistent size and album art visibility
3. **Performance**: No layout thrashing or jarring transitions
4. **UX**: Clear feedback about video availability status
5. **Reliable**: Comprehensive test coverage for edge cases

## Risk Mitigation
- **Layout Shifts**: Careful CSS testing across screen sizes
- **State Races**: Proper cleanup and dependency management in useEffect
- **Performance**: Debounced search and efficient re-renders
- **Compatibility**: Test with various video embedding scenarios

**Estimated Implementation Time**: 4-6 hours across parallel agents
**Testing Time**: 2-3 hours  
**Documentation Time**: 1-2 hours