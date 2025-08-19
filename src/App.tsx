import { useState, useEffect } from 'react';
import { DotPattern } from './components/magicui/dot-pattern';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainContent } from './components/MainContent/MainContent';
import { AddFolderModal } from './components/Modals/AddFolderModal';
import { PreviewModal } from './components/Modals/PreviewModal';
import { useRootFolders } from './hooks/useRootFolders';
import { useFolderHistory } from './hooks/useFolderHistory';
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
  } = useDirectoryScan();

  const {
    coverPaths,
    folderCoverPaths,
    loadCoverPaths,
    loadFolderCoverPaths,
    refreshCovers,
    clearAllCovers,
  } = useCoverPaths();

  const { playVideo } = useVideoPlayer();

  // 本地状态
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [initialPath, setInitialPath] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');
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

  // 当根文件夹加载完成后，自动选择第一个并扫描
  useEffect(() => {
    if (rootFolders.length > 0 && !selectedFolder) {
      const firstFolder = rootFolders[0];
      setSelectedFolder(firstFolder.id);
      scanDirectory(firstFolder.id);
    }
  }, [rootFolders, selectedFolder, scanDirectory, setSelectedFolder]);

  // 清理历史记录中可能存在的无效路径
  const handleCleanupInvalidHistory = () => {
    const validPaths = rootFolders.map(folder => folder.path);
    cleanupInvalidHistory(validPaths);
  };

  // 从历史记录中选择文件夹
  const selectFromHistory = async (path: string) => {
    try {
      // 设置初始路径并显示添加文件夹弹窗
      setInitialPath(path);
      setShowAddFolderModal(true);
      // 清除之前的错误信息
      setDirectoryError(null);
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
  const previewVideo = (video: VideoInfo) => {
    const coverPath = coverPaths.get(video.path) || '/placeholder-cover.jpg';
    setPreviewImage(coverPath);
    setPreviewTitle(video.name);
    setShowPreviewModal(true);
  };

  // 添加文件夹处理
  const handleAddFolder = async (path: string, name: string) => {
    try {
      setIsAddingFolder(true);
      setDirectoryError(null);

      // 检查是否已存在相同路径的文件夹
      if (isPathExists(path)) {
        const existingFolder = findFolderById(selectedFolder || '');
        if (existingFolder) {
          // 保存到历史记录
          saveFolderHistory(path);

          // 选择现有的文件夹并刷新
          setSelectedFolder(existingFolder.id);
          await scanDirectory(existingFolder.id);

          // 关闭模态框
          setShowAddFolderModal(false);
          setInitialPath(''); // 重置初始路径

          // 显示成功提示信息
          setSuccessMessage(`文件夹 "${existingFolder.name}" 已存在，已自动刷新`);
        }
        return;
      }

      // 如果不存在，则添加新文件夹
      const folderId = await addRootFolder(path, name);

      // 保存到历史记录
      saveFolderHistory(path);

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
        clearAllStates(); // 清理所有目录相关状态
        clearAllCovers(); // 清理所有封面状态
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
