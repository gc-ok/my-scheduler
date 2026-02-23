import React, { ReactNode } from 'react';
import { COLORS } from '../../utils/theme';

interface PanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export const ContextualSidePanel: React.FC<PanelProps> = ({ isOpen, onClose, title, children }) => {
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '400px',
    height: '100%',
    background: COLORS.white,
    boxShadow: '-2px 0 15px rgba(0,0,0,0.15)',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s ease-in-out',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: `1px solid ${COLORS.lightGray}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.primary,
  };

  const contentStyle: React.CSSProperties = {
    padding: '20px',
    flex: 1,
    overflowY: 'auto',
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: COLORS.midGray,
  };

  return (
    <aside style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="panel-title">
      <div style={headerStyle}>
        <h2 id="panel-title" style={titleStyle}>{title}</h2>
        <button onClick={onClose} style={closeButtonStyle} aria-label="Close panel">&times;</button>
      </div>
      <div style={contentStyle}>
        {children}
      </div>
    </aside>
  );
};
