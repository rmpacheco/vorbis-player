import React, { Suspense, lazy, useEffect } from 'react';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));

interface AlbumArtFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
}

interface VisualEffectsContainerProps {
  enabled: boolean;
  isMenuOpen: boolean;
  accentColor: string;
  filters: AlbumArtFilters;
  onMenuClose: () => void;
  onFilterChange: (filter: string, value: number) => void;
  onResetFilters: () => void;
  onToggleEffects: () => void;
  // Glow controls from parent
  glowIntensity: number;
  setGlowIntensity: (intensity: number) => void;
  glowRate: number;
  setGlowRate: (rate: number) => void;
  effectiveGlow: { intensity: number; rate: number };
}

const EffectsLoadingFallback: React.FC = () => (
  <div style={{
    position: 'fixed',
    top: 0,
    right: 0,
    width: '350px',
    height: '100vh',
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px'
  }}>
    Loading effects...
  </div>
);

const VisualEffectsContainer: React.FC<VisualEffectsContainerProps> = ({
  enabled,
  isMenuOpen,
  accentColor,
  filters,
  onMenuClose,
  onFilterChange,
  onResetFilters,
  onToggleEffects,
  glowIntensity,
  setGlowIntensity,
  glowRate,
  setGlowRate,
  effectiveGlow
}) => {



  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      switch (event.code) {
        case 'KeyV':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onToggleEffects();
          }
          break;
        case 'KeyE':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onMenuClose();
          }
          break;
        case 'KeyR':
          if (event.ctrlKey || event.metaKey && enabled) {
            event.preventDefault();
            onResetFilters();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onToggleEffects, onMenuClose, onResetFilters]);

  // Wrapper function to handle type mismatch between onFilterChange signatures
  const handleFilterChangeWrapper = (filterName: string, value: number | boolean) => {
    if (typeof value === 'number') {
      onFilterChange(filterName, value);
    }
    // Ignore boolean values for now as they're not used in the current implementation
  };

  return enabled ? (
    <Suspense fallback={<EffectsLoadingFallback />}>
      <VisualEffectsMenu
        isOpen={isMenuOpen}
        onClose={onMenuClose}
        accentColor={accentColor}
        filters={filters}
        onFilterChange={handleFilterChangeWrapper}
        onResetFilters={onResetFilters}
        glowIntensity={glowIntensity}
        setGlowIntensity={setGlowIntensity}
        glowRate={glowRate}
        setGlowRate={setGlowRate}
        effectiveGlow={effectiveGlow}
      />
    </Suspense>
  ) : null;
};

export default VisualEffectsContainer;