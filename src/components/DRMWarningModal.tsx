import React from 'react';
import styled from 'styled-components';
import { AlertTriangle, ExternalLink } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const Modal = styled.div`
  background: rgba(30, 30, 30, 0.95);
  border-radius: 16px;
  padding: 32px;
  max-width: 500px;
  margin: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const Icon = styled.div`
  color: #f59e0b;
  flex-shrink: 0;
`;

const Title = styled.h2`
  color: white;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
`;

const Content = styled.div`
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
  margin-bottom: 24px;
`;

const Paragraph = styled.p`
  margin: 0 0 16px 0;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  ${({ variant = 'secondary' }) => variant === 'primary' ? `
    background: #1db954;
    color: white;
    
    &:hover {
      background: #1ed760;
    }
  ` : `
    background: rgba(255, 255, 255, 0.1);
    color: white;
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  `}
`;

interface DRMWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInBrowser: () => void;
}

export const DRMWarningModal: React.FC<DRMWarningModalProps> = ({
  isOpen,
  onClose,
  onOpenInBrowser
}) => {
  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Icon>
            <AlertTriangle size={24} />
          </Icon>
          <Title>DRM Support Required</Title>
        </Header>
        
        <Content>
          <Paragraph>
            Spotify requires <strong>Widevine DRM</strong> (Digital Rights Management) 
            to play encrypted music content. This Electron app doesn't include Widevine 
            due to licensing restrictions.
          </Paragraph>
          
          <Paragraph>
            <strong>Solutions:</strong>
          </Paragraph>
          
          <Paragraph>
            • <strong>Use your web browser:</strong> Chrome, Firefox, and Safari 
            include Widevine DRM by default
          </Paragraph>
          
          <Paragraph>
            • <strong>Continue in desktop mode:</strong> You can still browse 
            playlists and see track information, but playback won't work
          </Paragraph>
        </Content>
        
        <ButtonGroup>
          <Button onClick={onClose}>
            Continue Anyway
          </Button>
          <Button variant="primary" onClick={onOpenInBrowser}>
            <ExternalLink size={16} />
            Open in Browser
          </Button>
        </ButtonGroup>
      </Modal>
    </Overlay>
  );
};