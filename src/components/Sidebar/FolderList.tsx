import React from 'react';
import { Trash2, HardDrive } from 'lucide-react';
import { type RootFolder } from '../../types';
import './Sidebar.css';

interface FolderListProps {
  rootFolders: RootFolder[];
  selectedFolder: string | null;
  onSelectFolder: (folderId: string) => void;
  onRemoveFolder: (folderId: string) => void;
}

export const FolderList: React.FC<FolderListProps> = ({
  rootFolders,
  selectedFolder,
  onSelectFolder,
  onRemoveFolder,
}) => {
  return (
    <div className="folder-list">
      {rootFolders.map(folder => (
        <div
          key={folder.id}
          className={`folder-item ${selectedFolder === folder.id ? 'active' : ''}`}
        >
          <div
            className="folder-content"
            onClick={() => onSelectFolder(folder.id)}
          >
            <div className="folder-info-name">
              <HardDrive className="w-4 h-4 text-primary" />
              <span className="folder-name">{folder.name}</span>
            </div>
          </div>
          <button
            className="delete-folder-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFolder(folder.id);
            }}
            title="删除文件夹"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
