import React, { useState } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { AnimatedGridPattern } from '../magicui/animated-grid-pattern';
import { FolderGrid } from '../FolderDisplay/FolderGrid';
import { VideoGrid } from '../VideoDisplay/VideoGrid';
import { Breadcrumb } from './Breadcrumb';
import { ViewControls } from './ViewControls';
import { type DirectoryNode, type ViewMode, type VideoInfo } from '../../types';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import './MainContent.css';

interface MainContentProps {
  selectedFolder: string | null;
  rootFolderName: string;
  currentDirectory: DirectoryNode | null;
  breadcrumb: DirectoryNode[];
  isLoading: boolean;
  coverPaths: Map<string, string>;
  folderCoverPaths: Map<string, string>;
  onGoToRoot: () => void;
  onNavigateToBreadcrumb: (index: number) => void;
  onNavigateToDirectory: (directory: DirectoryNode) => void;
  onRescanCurrentFolder: () => void;
  onPlayVideo: (videoPath: string) => void;
  onPreviewVideo: (video: VideoInfo) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
  selectedFolder,
  rootFolderName,
  currentDirectory,
  breadcrumb,
  isLoading,
  coverPaths,
  folderCoverPaths,
  onGoToRoot,
  onNavigateToBreadcrumb,
  onNavigateToDirectory,
  onRescanCurrentFolder,
  onPlayVideo,
  onPreviewVideo,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { openFolder } = useVideoPlayer();

  // 打开当前文件夹
  const handleOpenCurrentFolder = async () => {
    if (currentDirectory) {
      try {
        await openFolder(currentDirectory.path);
      } catch (error) {
        console.error('无法打开文件夹:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <main className="main-content">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      {/* 主内容背景 */}
      <div className="absolute inset-0 -z-10">
        <AnimatedGridPattern
          numSquares={20}
          maxOpacity={0.05}
          duration={4}
          repeatDelay={1}
          className="opacity-30"
        />
      </div>

      <div className="content-header">
        <div className="header-left">
          <Breadcrumb
            selectedFolder={selectedFolder}
            rootFolderName={rootFolderName}
            breadcrumb={breadcrumb}
            onGoToRoot={onGoToRoot}
            onNavigateToBreadcrumb={onNavigateToBreadcrumb}
          />
        </div>
        <ViewControls
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      <div className="content-body">
        {currentDirectory === null ? (
          <div className="empty-state">
            <h3>文件夹为空</h3>
            <p>该文件夹中没有找到视频文件</p>
            <button
              className="scan-btn"
              onClick={onRescanCurrentFolder}
            >
              重新扫描
            </button>
          </div>
        ) : (
          <>
            {/* 当前目录信息 */}
            <div className="current-directory-info">
              <div className="directory-info-content">
                <p>包含 {currentDirectory.videos.length || 0} 个视频文件，{currentDirectory.children.length || 0} 个文件夹</p>
              </div>
              <div className="action-buttons">
                <button
                  className="open-folder-btn"
                  onClick={handleOpenCurrentFolder}
                  title="在系统文件管理器中打开此文件夹"
                >
                  <FolderOpen size={16} />
                  <span>打开文件夹</span>
                </button>
                <button
                  className="rescan-btn"
                  onClick={onRescanCurrentFolder}
                  title="重新扫描当前文件夹"
                >
                  <RefreshCw size={16} />
                  <span>重新扫描</span>
                </button>
              </div>
            </div>

            {/* 文件夹展示 */}
            <FolderGrid
              folders={currentDirectory.children}
              folderCoverPaths={folderCoverPaths}
              viewMode={viewMode}
              onNavigate={onNavigateToDirectory}
            />

            {/* 视频展示 */}
            <VideoGrid
              videos={currentDirectory.videos}
              coverPaths={coverPaths}
              viewMode={viewMode}
              onPlay={onPlayVideo}
              onPreview={onPreviewVideo}
            />
          </>
        )}
      </div>
    </main>
  );
};
