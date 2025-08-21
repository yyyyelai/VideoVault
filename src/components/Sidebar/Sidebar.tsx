import React from 'react';
import { FolderPlus } from 'lucide-react';
import { RainbowButton } from '../magicui/rainbow-button';
import { FolderList } from './FolderList';
import { HistorySection } from './HistorySection';
import { type RootFolder, type FolderHistoryItem } from '../../types';
import './Sidebar.css';

interface SidebarProps {
  rootFolders: RootFolder[];
  selectedFolder: string | null;
  folderHistory: FolderHistoryItem[];
  onShowAddFolderModal: () => void;
  onSelectFolder: (folderId: string) => void;
  onRemoveFolder: (folderId: string) => void;
  onSelectFromHistory: (item: FolderHistoryItem) => void;
  onCleanupInvalidHistory: () => void;
  onClearAllHistory: () => void;
  onShowInfoMessage: (content: string) => void;
  onHideInfoMessage: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rootFolders,
  selectedFolder,
  folderHistory,
  onShowAddFolderModal,
  onSelectFolder,
  onRemoveFolder,
  onSelectFromHistory,
  onCleanupInvalidHistory,
  onClearAllHistory,
  onShowInfoMessage,
  onHideInfoMessage,
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">VideoVault</h1>
      </div>

      <div className="folder-section">
        <div className="section-header">
          <RainbowButton
            onClick={onShowAddFolderModal}
          >
            <FolderPlus size={16} />
            添加文件夹
          </RainbowButton>
        </div>

        <FolderList
          rootFolders={rootFolders}
          selectedFolder={selectedFolder}
          onSelectFolder={onSelectFolder}
          onRemoveFolder={onRemoveFolder}
        />
      </div>

      <HistorySection
        folderHistory={folderHistory}
        onSelectFromHistory={onSelectFromHistory}
        onCleanupInvalidHistory={onCleanupInvalidHistory}
        onClearAllHistory={onClearAllHistory}
        onShowInfoMessage={onShowInfoMessage}
        onHideInfoMessage={onHideInfoMessage}
      />
    </aside>
  );
};
