import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DotPattern } from './components/magicui/dot-pattern';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainContent } from './components/MainContent/MainContent';
import { AddFolderModal } from './components/Modals/AddFolderModal';
import { PreviewModal } from './components/Modals/PreviewModal';
import { useRootFolders } from './hooks/useRootFolders';
import { useFolderHistory } from './hooks/useFolderHistory';
import type { FolderHistoryItem, DirectoryNode } from './types';
import { useDirectoryScan } from './hooks/useDirectoryScan';
import { useCoverPaths } from './hooks/useCoverPaths';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import type { VideoInfo } from './types';
import './App.css';

function App() {
  // 使用自定义 hooks
  const {
    rootFolders,
    isLoading: rootFoldersLoading,
    error: rootFoldersError,
    addRootFolder,
    removeRootFolder,
    isPathExists,
    findFolderById,
  } = useRootFolders();

  const {
    folderHistory,
    saveFolderHistory,
    cleanupInvalidHistory,
    clearAllHistory,
  } = useFolderHistory();

  const {
    currentDirectory,
    selectedFolder,
    breadcrumb,
    isLoading: directoryLoading,
    error: directoryError,
    setError: setDirectoryError,
    scanDirectory,
    rescanCurrentFolder,
    navigateToDirectory,
    navigateToBreadcrumb,
    goToRoot,
    setSelectedFolder,
    clearAllStates,
    getRootDirectory,
    hydrateFromCache,
  } = useDirectoryScan();

  const {
    coverPaths,
    folderCoverPaths,
    loadCoverPaths,
    loadFolderCoverPaths,
    refreshCovers,
    clearAllCovers,
    invalidateCache,
  } = useCoverPaths();

  const { playVideo } = useVideoPlayer();

  // 本地状态
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [initialPath, setInitialPath] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [previewVideoList, setPreviewVideoList] = useState<VideoInfo[]>([]);
  const [previewCurrentIndex, setPreviewCurrentIndex] = useState<number>(0);
  const [showInfoToast, setShowInfoToast] = useState(false);
  const [infoToastContent, setInfoToastContent] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 计算加载状态 - 只在初始加载时显示，不在操作时显示
  const isLoading = rootFoldersLoading && rootFolders.length === 0;
  const error = rootFoldersError || directoryError;

  // 当视频列表更新时，加载封面路径
  useEffect(() => {
    if (currentDirectory) {
      loadCoverPaths(currentDirectory);
      loadFolderCoverPaths(currentDirectory);
    }
  }, [currentDirectory, loadCoverPaths, loadFolderCoverPaths]);

  // 处理浏览器前进后退
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!state || !state.rootId) return;

      console.log('浏览器后退/前进:', state);

      // 如果切换了根文件夹，需要重新加载
      if (state.rootId !== selectedFolder) {
        scanDirectory(state.rootId);
        return;
      }

      // 在同一个根文件夹内导航
      if (state.directoryPath && currentDirectory) {
        // 如果是返回根目录
        if (state.breadcrumb.length === 0) {
          const rootDir = getRootDirectory();
          if (rootDir) {
            goToRoot(rootDir, false);
          }
          return;
        }

        // 查找目标目录
        const findDirectoryByPath = (node: DirectoryNode, targetPath: string): DirectoryNode | null => {
          if (node.path === targetPath) return node;
          for (const child of node.children) {
            const found = findDirectoryByPath(child, targetPath);
            if (found) return found;
          }
          return null;
        };

        const rootDir = getRootDirectory();
        if (rootDir) {
          const targetDir = findDirectoryByPath(rootDir, state.directoryPath);
          if (targetDir) {
            navigateToDirectory(targetDir, false);
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedFolder, currentDirectory, getRootDirectory, goToRoot, navigateToDirectory, scanDirectory]);

  // 当根文件夹加载完成后，自动选择第一个并扫描（若尚未通过缓存 hydrate）
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    // 只在第一次加载时自动选择，避免在删除文件夹后重新选择
    if (hasAutoSelectedRef.current) return;
    
    if (rootFolders.length > 0 && !selectedFolder && !currentDirectory) {
      const firstFolder = rootFolders[0];
      setSelectedFolder(firstFolder.id);
      scanDirectory(firstFolder.id);
      hasAutoSelectedRef.current = true;
    }
  }, [rootFolders, selectedFolder, currentDirectory, scanDirectory, setSelectedFolder]);

  // 启动时：使用历史记录的最新项直接从缓存 hydrate（不请求后端）
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    // 只在第一次启动时执行，避免在删除文件夹后重新hydrate
    if (hasHydratedRef.current) return;
    
    if (!selectedFolder && !currentDirectory && folderHistory.length > 0) {
      const latest = folderHistory[0];
      if (latest.rootId && latest.volumeKey) {
        const ok = hydrateFromCache(latest.volumeKey, latest.rootId);
        if (ok) {
          // 已通过缓存恢复上次选中
          hasHydratedRef.current = true;
          return;
        }
      }
    }
    
    // 如果没有成功hydrate，也标记为已尝试过
    hasHydratedRef.current = true;
  }, [folderHistory, selectedFolder, currentDirectory, hydrateFromCache]);

  // 启动后：只同步选中与历史 rootId，不自动注册，避免重复项
  useEffect(() => {
    const syncSidebarLatest = async () => {
      if (folderHistory.length === 0) return;
      const latest = folderHistory[0];
      const normalizePath = (p: string) => p.replace(/[\\/]+$/, '').replace(/\\/g, '/');
      const normalizedLatest = normalizePath(latest.path);
      const existing = rootFolders.find(f => normalizePath(f.path) === normalizedLatest);

      if (existing) {
        if (!selectedFolder) {
          setSelectedFolder(existing.id);
        }
        if (latest.rootId !== existing.id) {
          try {
            const volumeKey = await invoke<string>('get_volume_key', { rootId: existing.id });
            saveFolderHistory({ path: latest.path, rootId: existing.id, volumeKey, addedAt: Date.now() });
          } catch {
            saveFolderHistory({ path: latest.path, rootId: existing.id, addedAt: Date.now() });
          }
        }
      }
    };

    // 等待 rootFolders 加载完成再同步
    if (!rootFoldersLoading) {
      syncSidebarLatest();
    }
  }, [folderHistory, rootFolders, rootFoldersLoading, selectedFolder, setSelectedFolder, saveFolderHistory]);

  // 启动后：若侧边栏缺少历史最新项，则自动注册一次（带幂等保护），以便两侧一致
  const ensuredFromHistoryRef = useRef(false);
  useEffect(() => {
    const ensureRegisterLatest = async () => {
      if (ensuredFromHistoryRef.current) return;
      if (rootFoldersLoading) return;
      if (folderHistory.length === 0) return;

      const latest = folderHistory[0];
      const normalizePath = (p: string) => p.replace(/[\\/]+$/, '').replace(/\\/g, '/');
      const normalizedLatest = normalizePath(latest.path);
      const existing = rootFolders.find(f => normalizePath(f.path) === normalizedLatest);

      if (!existing) {
        try {
          const name = latest.path.split('/').pop() || latest.path.split('\\').pop() || '未命名文件夹';
          const newId = await addRootFolder(latest.path, name);
          setSelectedFolder(newId);
          try {
            const volumeKey = await invoke<string>('get_volume_key', { rootId: newId });
            saveFolderHistory({ path: latest.path, rootId: newId, volumeKey, addedAt: Date.now() });
          } catch {
            saveFolderHistory({ path: latest.path, rootId: newId, addedAt: Date.now() });
          }
        } catch (e) {
          console.error('自动注册历史最新文件夹失败:', e);
        }
      }

      ensuredFromHistoryRef.current = true;
    };

    ensureRegisterLatest();
  }, [folderHistory, rootFolders, rootFoldersLoading, addRootFolder, setSelectedFolder, saveFolderHistory]);

  // 清理历史记录中可能存在的无效路径
  const handleCleanupInvalidHistory = () => {
    const validPaths = rootFolders.map(folder => folder.path);
    cleanupInvalidHistory(validPaths);
  };

  // 从历史记录中选择文件夹
  const selectFromHistory = async (item: FolderHistoryItem) => {
    try {
      setDirectoryError(null);

      // 若历史项包含有效 rootId，直接扫描
      if (item.rootId && rootFolders.some(f => f.id === item.rootId)) {
        setSelectedFolder(item.rootId);
        await scanDirectory(item.rootId, false);
        return;
      }

      // 回退：按路径匹配现有根目录
      const normalizePath = (p: string) => p.replace(/[\\/]+$/, '').replace(/\\/g, '/');
      const normalizedTarget = normalizePath(item.path);
      const existing = rootFolders.find(f => normalizePath(f.path) === normalizedTarget);
      if (existing) {
        setSelectedFolder(existing.id);
        await scanDirectory(existing.id, false);
        return;
      }

      // 否则打开添加文件夹弹窗并预填路径
      setInitialPath(item.path);
      setShowAddFolderModal(true);
    } catch (error) {
      console.error('从历史记录选择文件夹失败:', error);
      setDirectoryError('无法从历史记录选择文件夹');
    }
  };

  // 显示通用信息提示
  const showInfoMessage = (content: string) => {
    setInfoToastContent(content);
    setShowInfoToast(true);
  };

  // 隐藏通用信息提示
  const hideInfoMessage = () => {
    setShowInfoToast(false);
  };

  // 预览视频
  const previewVideo = (video: VideoInfo, videoList: VideoInfo[]) => {
    const index = videoList.findIndex(v => v.path === video.path);
    setPreviewVideoList(videoList);
    setPreviewCurrentIndex(index !== -1 ? index : 0);
    const coverPath = coverPaths.get(video.path) || '/placeholder-cover.jpg';
    setPreviewImage(coverPath);
    setPreviewTitle(video.name);
    setShowPreviewModal(true);
  };

  // 切换到上一个视频
  const handlePreviewPrevious = () => {
    if (previewCurrentIndex > 0) {
      const newIndex = previewCurrentIndex - 1;
      const video = previewVideoList[newIndex];
      setPreviewCurrentIndex(newIndex);
      const coverPath = coverPaths.get(video.path) || '/placeholder-cover.jpg';
      setPreviewImage(coverPath);
      setPreviewTitle(video.name);
    }
  };

  // 切换到下一个视频
  const handlePreviewNext = () => {
    if (previewCurrentIndex < previewVideoList.length - 1) {
      const newIndex = previewCurrentIndex + 1;
      const video = previewVideoList[newIndex];
      setPreviewCurrentIndex(newIndex);
      const coverPath = coverPaths.get(video.path) || '/placeholder-cover.jpg';
      setPreviewImage(coverPath);
      setPreviewTitle(video.name);
    }
  };

  // 添加文件夹处理
  const handleAddFolder = async (path: string, name: string) => {
    try {
      setIsAddingFolder(true);
      setDirectoryError(null);

      // 检查是否已存在相同路径的文件夹
      if (isPathExists(path)) {
        // 按路径查找已存在的根目录
        const normalizePath = (p: string) => p.replace(/[\\/]+$/, '').replace(/\\/g, '/');
        const normalizedTarget = normalizePath(path);
        const existingFolder = rootFolders.find(f => normalizePath(f.path) === normalizedTarget);

        if (existingFolder) {
          // 保存到历史记录
          try {
            const volumeKey = await invoke<string>('get_volume_key', { rootId: existingFolder.id });
            const historyItem: FolderHistoryItem = { path, rootId: existingFolder.id, volumeKey, addedAt: Date.now() };
            saveFolderHistory(historyItem);
          } catch {
            saveFolderHistory({ path, rootId: existingFolder.id, addedAt: Date.now() });
          }

          // 选择现有的文件夹并刷新（带缓存逻辑）
          setSelectedFolder(existingFolder.id);
          await scanDirectory(existingFolder.id, false);

          // 关闭模态框
          setShowAddFolderModal(false);
          setInitialPath('');

          // 成功提示
          setSuccessMessage(`文件夹 "${existingFolder.name}" 已存在，已自动刷新`);
        }
        return;
      }

      // 如果不存在，则添加新文件夹
      const folderId = await addRootFolder(path, name);

      // 保存到历史记录（写入 rootId/volumeKey）
      try {
        const volumeKey = await invoke<string>('get_volume_key', { rootId: folderId });
        const historyItem: FolderHistoryItem = { path, rootId: folderId, volumeKey, addedAt: Date.now() };
        saveFolderHistory(historyItem);
      } catch {
        saveFolderHistory({ path, rootId: folderId, addedAt: Date.now() });
      }

      // 自动选择新添加的文件夹
      setSelectedFolder(folderId);
      await scanDirectory(folderId);

      // 关闭模态框
      setShowAddFolderModal(false);
      setInitialPath(''); // 重置初始路径
    } catch (error) {
      console.error('添加根文件夹失败:', error);
      setDirectoryError(`添加根文件夹失败: ${error}`);
    } finally {
      setIsAddingFolder(false);
    }
  };

  // 删除文件夹处理
  const handleRemoveFolder = async (folderId: string) => {
    try {
      await removeRootFolder(folderId);
      // 如果删除的是当前选中的文件夹，清空所有相关状态
      if (selectedFolder === folderId) {
        // 在清空状态之前，先确定下一个要选择的文件夹
        let nextFolderId: string | null = null;
        if (rootFolders.length > 1) {
          const remainingFolders = rootFolders.filter(f => f.id !== folderId);
          if (remainingFolders.length > 0) {
            nextFolderId = remainingFolders[0].id;
          }
        }
        
        // 清空所有状态
        clearAllStates();
        clearAllCovers();
        
        // 如果有其他文件夹，直接设置新的选中状态，不触发useEffect
        if (nextFolderId) {
          // 直接设置状态，避免触发useEffect的自动选择逻辑
          setSelectedFolder(nextFolderId);
          // 直接调用scanDirectory，传入false避免设置selectedFolder，防止循环调用
          scanDirectory(nextFolderId, true, false);
        }
      }
    } catch (error) {
      console.error('删除根文件夹失败:', error);
      setDirectoryError(`删除根文件夹失败: ${error}`);
    }
  };

  // 选择文件夹选择处理
  const handleSelectFolder = async (folderId: string) => {
    await scanDirectory(folderId);
  };

  // 返回根目录处理（优化版本，避免重新扫描）
  const handleGoToRoot = () => {
    const rootDirectory = getRootDirectory();
    goToRoot(rootDirectory || undefined);
  };

  // 重新扫描当前文件夹
  const handleRescanCurrentFolder = async () => {
    if (currentDirectory && selectedFolder) {
      try {
        await rescanCurrentFolder();
        // 重新加载封面
        if (currentDirectory) {
          await refreshCovers(currentDirectory);
        }
        setDirectoryError(null);
      } catch (error) {
        console.error('重新扫描文件夹失败:', error);
        setDirectoryError('重新扫描文件夹失败');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="abrapp">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>正在加载...</p>
        </div>
      </div>
    );
  }
  console.log('currentDirectory', currentDirectory);
  return (
    <div className="app-container">
      {/* Dot Pattern 背景 */}
      <div className="background-pattern">
        <DotPattern
          width={20}
          height={20}
          cx={1}
          cy={1}
          cr={0.5}
          className="fill-muted/20"
        />
      </div>

      <div className="app-content">
        {/* 侧边栏 */}
        <Sidebar
          rootFolders={rootFolders}
          selectedFolder={selectedFolder}
          folderHistory={folderHistory}
          onShowAddFolderModal={() => setShowAddFolderModal(true)}
          onSelectFolder={handleSelectFolder}
          onRemoveFolder={handleRemoveFolder}
          onSelectFromHistory={selectFromHistory}
          onCleanupInvalidHistory={handleCleanupInvalidHistory}
          onClearAllHistory={clearAllHistory}
          onShowInfoMessage={showInfoMessage}
          onHideInfoMessage={hideInfoMessage}
        />

        {/* 主内容区域 */}
        <MainContent
          selectedFolder={selectedFolder}
          rootFolderName={selectedFolder ? findFolderById(selectedFolder)?.name || '未知文件夹' : '根目录'}
          currentDirectory={currentDirectory}
          breadcrumb={breadcrumb}
          isLoading={directoryLoading}
          coverPaths={coverPaths}
          folderCoverPaths={folderCoverPaths}
          onGoToRoot={handleGoToRoot}
          onNavigateToBreadcrumb={navigateToBreadcrumb}
          onNavigateToDirectory={navigateToDirectory}
          onRescanCurrentFolder={handleRescanCurrentFolder}
          onInvalidateCache={invalidateCache}
          onPlayVideo={playVideo}
          onPreviewVideo={previewVideo}
        />

        {/* 添加文件夹模态框 */}
        <AddFolderModal
          isOpen={showAddFolderModal}
          onClose={() => {
            setShowAddFolderModal(false);
            setInitialPath(''); // 关闭弹窗时重置初始路径
          }}
          onAddFolder={handleAddFolder}
          error={directoryError}
          isAdding={isAddingFolder}
          initialPath={initialPath}
        />

        {/* 预览弹窗 */}
        <PreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          imageSrc={previewImage}
          title={previewTitle}
          currentIndex={previewCurrentIndex}
          totalCount={previewVideoList.length}
          onPrevious={handlePreviewPrevious}
          onNext={handlePreviewNext}
        />

        {/* 错误提示 */}
        {error && (
          <div className="error-toast">
            <div className="error-content">
              <span className="error-message">{error}</span>
              <button
                className="error-close"
                onClick={() => setDirectoryError(null)}
              >
                <span>×</span>
              </button>
            </div>
          </div>
        )}

        {/* 成功提示 */}
        {successMessage && (
          <div className="success-toast">
            <div className="success-content">
              <span className="success-message">{successMessage}</span>
              <button
                className="success-close"
                onClick={() => setSuccessMessage(null)}
              >
                <span>×</span>
              </button>
            </div>
          </div>
        )}

        {/* 通用信息提示 */}
        {showInfoToast && (
          <div className="info-toast">
            <div className="info-content">
              <span className="info-message">{infoToastContent}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
