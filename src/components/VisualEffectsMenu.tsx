import React from 'react';
import styled from 'styled-components';

interface VisualEffectsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  filters: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    blur: number;
    sepia: number;
    grayscale: number;
    invert: number;
    opacity: number;
  };
  onFilterChange: (filterName: string, value: number) => void;
  onResetFilters: () => void;
}

const MenuContainer = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 1.25rem 1.25rem 0 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: none;
  transform: translateY(${({ $isOpen }) => ($isOpen ? '0' : '100%')});
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
  max-height: 400px;
  overflow-y: auto;
  
  /* Ensure the menu doesn't break the card's border radius */
  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    right: -1px;
    height: 2px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 1.25rem 1.25rem 0 0;
  }
`;

const MenuHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const MenuTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  
  &:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
  }
  
  svg {
    width: 1rem;
    height: 1rem;
  }
`;

const MenuContent = styled.div`
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ControlLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
`;

const ControlValue = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 400;
`;

const Slider = styled.input<{ $accentColor: string }>`
  appearance: none;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: ${({ $accentColor }) => $accentColor};
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }
  
  &::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px ${({ $accentColor }) => $accentColor}33;
  }
  
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: ${({ $accentColor }) => $accentColor};
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }
  
  &::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px ${({ $accentColor }) => $accentColor}33;
  }
`;

const FilterSection = styled.div`
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 1rem;
  margin-top: 1rem;
`;

const SectionTitle = styled.h4`
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const FilterGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const ResetButton = styled.button<{ $accentColor: string }>`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  width: 100%;
  margin-top: 1rem;
  
  &:hover {
    background: ${({ $accentColor }) => $accentColor}22;
    border-color: ${({ $accentColor }) => $accentColor}44;
    color: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
  }
`;

export const VisualEffectsMenu: React.FC<VisualEffectsMenuProps> = ({
  isOpen,
  onClose,
  accentColor,
  filters,
  onFilterChange,
  onResetFilters
}) => {
  const filterConfig = [
    { key: 'brightness', label: 'Brightness', min: 0, max: 200, unit: '%' },
    { key: 'contrast', label: 'Contrast', min: 0, max: 200, unit: '%' },
    { key: 'saturation', label: 'Saturation', min: 0, max: 300, unit: '%' },
    { key: 'hue', label: 'Hue Rotate', min: 0, max: 360, unit: '°' },
    { key: 'blur', label: 'Blur', min: 0, max: 10, unit: 'px' },
    { key: 'sepia', label: 'Sepia', min: 0, max: 100, unit: '%' },
    { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, unit: '%' },
    { key: 'invert', label: 'Invert', min: 0, max: 100, unit: '%' },
    { key: 'opacity', label: 'Opacity', min: 0, max: 100, unit: '%' }
  ];

  return (
    <MenuContainer $isOpen={isOpen}>
      <MenuHeader>
        <MenuTitle>Visual Effects</MenuTitle>
        <CloseButton onClick={onClose} aria-label="Close visual effects menu">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </CloseButton>
      </MenuHeader>
      
      <MenuContent>
        <FilterSection>
          <SectionTitle>Album Art Filters</SectionTitle>
          <FilterGrid>
            {filterConfig.map(({ key, label, min, max, unit }) => (
              <ControlGroup key={key}>
                <ControlLabel>
                  {label}
                  <ControlValue>{filters[key as keyof typeof filters]}{unit}</ControlValue>
                </ControlLabel>
                <Slider
                  type="range"
                  min={min}
                  max={max}
                  value={filters[key as keyof typeof filters]}
                  onChange={(e) => onFilterChange(key, parseInt(e.target.value))}
                  $accentColor={accentColor}
                />
              </ControlGroup>
            ))}
          </FilterGrid>
          <ResetButton onClick={onResetFilters} $accentColor={accentColor}>
            Reset All Filters
          </ResetButton>
        </FilterSection>
      </MenuContent>
    </MenuContainer>
  );
};

export default VisualEffectsMenu;