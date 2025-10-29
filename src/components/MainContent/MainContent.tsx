import React, { useState } from 'react';
import { FolderOpen, RefreshCw, Search } from 'lucide-react';
import { AnimatedGridPattern } from '../magicui/animated-grid-pattern';
import { FolderGrid } from '../FolderDisplay/FolderGrid';
import { VideoGrid } from '../VideoDisplay/VideoGrid';
import { Breadcrumb } from './Breadcrumb';
import { ViewControls } from './ViewControls';
import { type DirectoryNode, type ViewMode, type VideoInfo } from '../../types';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import './MainContent.css';
import { sortData } from '../../hooks/useSortData';
import { RainbowButton } from '../magicui/rainbow-button';
import { Input } from '../shadcn/input';
import PinyinMatch from 'pinyin-match';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shadcn/select';
import { useCustomFolderCovers } from '../../hooks/useCustomFolderCovers';
import { invoke } from '@tauri-apps/api/core';

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
  onInvalidateCache: () => void;
  onPlayVideo: (videoPath: string) => void;
  onPreviewVideo: (video: VideoInfo, videoList: VideoInfo[]) => void;
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
  onInvalidateCache,
  onPlayVideo,
  onPreviewVideo,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { openFolder } = useVideoPlayer();
  const [sortKeyList, setSortKeyList] = useState<string[]>(['name']);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { setCustomCover } = useCustomFolderCovers();
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

  // 设置视频封面为文件夹封面
  const handleSetAsCover = async (videoPath: string, folderPath: string) => {
    try {
      // 查找该视频的封面路径
      const coverPath = await invoke<string>('find_cover_for_video', { videoPath });
      if (coverPath) {
        // 保存到localStorage
        setCustomCover(folderPath, coverPath);
        console.log(`✅ 已设置文件夹封面: ${folderPath} -> ${coverPath}`);
        
        // 只清除缓存标记，不清除已加载的封面数据（避免页面闪烁）
        onInvalidateCache();
        
        console.log('✅ 封面设置成功，下次进入目录将显示新封面');
        
        // TODO: 可以添加一个toast提示
        // showSuccessToast('封面设置成功');
      } else {
        console.error('❌ 未找到视频封面');
        alert('未找到该视频的封面文件');
      }
    } catch (error) {
      console.error('设置封面失败:', error);
      alert('设置封面失败: ' + error);
    }
  };

  // 过滤、搜索视频和文件夹
  const filterVideosAndFolders = <T extends DirectoryNode | VideoInfo>(data: T[]) => {
    let filteredData = data;
    
    // 如果有搜索查询，先进行搜索过滤
    if (searchQuery.trim()) {
      filteredData = data.filter(item => {
        return PinyinMatch.match(item.name, searchQuery) !== false;
      });
    }
    
    // 然后进行排序
    return sortData(filteredData, sortKeyList);
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
            <div className="filter-container">
              {/* 搜索框 */}
              <div className="search-container">
                <div className="search-input-wrapper">
                  <Search size={16} className="search-icon" />
                  <Input
                    type="text"
                    placeholder="搜索文件夹或视频名称..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>
              {/* 排序器 */}
              <div className="sort-container">
                <Select value={sortKeyList.join(',')} onValueChange={(value) => setSortKeyList(value.split(','))}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="选择排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">按名称排序</SelectItem>
                    <SelectItem value="modified_time,secs_since_epoch">按修改时间排序</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* 按钮操作区 */}
              <div className="action-buttons">
                <RainbowButton
                  className="open-folder-btn"
                  onClick={handleOpenCurrentFolder}
                  title="在系统文件管理器中打开此文件夹"
                >
                  <FolderOpen size={16} />
                  <span>打开文件夹</span>
                </RainbowButton>
                <RainbowButton
                  className="rescan-btn"
                  onClick={onRescanCurrentFolder}
                  title="重新扫描当前文件夹"
                >
                  <RefreshCw size={16} />
                  <span>重新扫描</span>
                </RainbowButton>
              </div>
            </div>
            <div className="current-directory-info">
              <div className="directory-info-content">
                <p>包含 {currentDirectory.videos.length || 0} 个视频文件，{currentDirectory.children.length || 0} 个文件夹</p>
              </div>
            </div>

            {/* 文件夹展示 */}
            <FolderGrid
              folders={filterVideosAndFolders(currentDirectory.children)}
              folderCoverPaths={folderCoverPaths}
              viewMode={viewMode}
              onNavigate={onNavigateToDirectory}
            />

            {/* 视频展示 */}
            <VideoGrid
              videos={filterVideosAndFolders(currentDirectory.videos)}
              coverPaths={coverPaths}
              viewMode={viewMode}
              currentFolderPath={currentDirectory.path}
              onPlay={onPlayVideo}
              onPreview={(video) => onPreviewVideo(video, filterVideosAndFolders(currentDirectory.videos))}
              onSetAsCover={handleSetAsCover}
            />
          </>
        )}
      </div>
    </main>
  );
};
