import React from 'react';
import { FolderNode } from './FolderNode';
import { type DirectoryNode } from '../../types';
import './FolderDisplay.css';

interface FolderGridProps {
  folders: DirectoryNode[];
  folderCoverPaths: Map<string, string>;
  viewMode: 'grid' | 'list';
  onNavigate: (directory: DirectoryNode) => void;
}

export const FolderGrid: React.FC<FolderGridProps> = ({
  folders,
  folderCoverPaths,
  viewMode,
  onNavigate,
}) => {
  if (folders.length === 0) {
    return null;
  }

  return (
    <div className={`folder-container ${viewMode}`}>
      {folders.map((folder) => {
        const coverPath = folderCoverPaths.get(folder.path);
        return (
          <FolderNode
            key={folder.path}
            folder={folder}
            coverPath={coverPath}
            viewMode={viewMode}
            onNavigate={onNavigate}
          />
        );
      })}
    </div>
  );
};
