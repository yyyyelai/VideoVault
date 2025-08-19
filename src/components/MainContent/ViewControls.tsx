import React from 'react';
import { Grid3X3, List } from 'lucide-react';
import { type ViewMode } from '../../types';
import './MainContent.css';

interface ViewControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewControls: React.FC<ViewControlsProps> = ({
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="view-controls">
      <button
        className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
        onClick={() => onViewModeChange('grid')}
        title="网格视图"
      >
        <Grid3X3 size={20} />
      </button>
      <button
        className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
        onClick={() => onViewModeChange('list')}
        title="列表视图"
      >
        <List size={20} />
      </button>
    </div>
  );
};
