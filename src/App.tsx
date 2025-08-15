import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  FolderPlus, 
  Grid3X3, 
  List, 
  Play, 
  X, 
  Trash2,
  Video,
  HardDrive,
  FolderOpen,
  RefreshCw,
  Eye
} from 'lucide-react';
import { ShimmerButton } from './components/magicui/shimmer-button';
import { RainbowButton } from './components/magicui/rainbow-button';
import { DotPattern } from './components/magicui/dot-pattern';
import { AnimatedGridPattern } from './components/magicui/animated-grid-pattern';
import './App.css';

// 接口定义
interface RootFolder {
  id: string;
  path: string;
  name: string;
  enabled: boolean;
  max_depth: number;
  last_scan: string | null;
}

interface VideoInfo {
  path: string;
  name: string;
  size: number;
  duration: number | null;
  resolution: [number, number] | null;
  codec: string | null;
  audio_codec: string | null;
  created_time: string | null;
  modified_time: string | null;
}

interface DirectoryNode {
  name: string;
  path: string;
  is_directory: boolean;
  children: DirectoryNode[];
  videos: VideoInfo[];
  cover_count: number;
  video_count: number;
  cover_path?: string;
}

function App() {
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([]);
  const [currentDirectory, setCurrentDirectory] = useState<DirectoryNode | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<DirectoryNode[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverPaths, setCoverPaths] = useState<Map<string, string>>(new Map());
  const [folderCoverPaths, setFolderCoverPaths] = useState<Map<string, string>>(new Map());
  
  // 预览弹窗状态
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');
  
  // 历史记录状态
  const [folderHistory, setFolderHistory] = useState<string[]>([]);
  
  // 通用信息提示状态
  const [showInfoToast, setShowInfoToast] = useState(false);
  const [infoToastContent, setInfoToastContent] = useState('');
  
  // 成功提示状态
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // 加载根文件夹
  useEffect(() => {
    loadRootFolders();
    loadFolderHistory();
  }, []);

  // 当视频列表更新时，加载封面路径
  useEffect(() => {
    if (currentDirectory) {
      loadCoverPaths(currentDirectory);
      loadFolderCoverPaths(currentDirectory);
    }
  }, [currentDirectory]);

  // 加载历史记录
  const loadFolderHistory = () => {
    try {
      const saved = localStorage.getItem('folderHistory');
      console.log('📂 从localStorage读取历史记录:', saved);
      
      if (saved) {
        const history = JSON.parse(saved);
        const validHistory = Array.isArray(history) ? history : [];
        setFolderHistory(validHistory);
        console.log('✅ 历史记录加载成功:', validHistory);
      } else {
        console.log('📝 没有找到保存的历史记录');
        setFolderHistory([]);
      }
    } catch (error) {
      console.error('❌ 加载历史记录失败:', error);
      setFolderHistory([]);
    }
  };

  // 保存历史记录
  const saveFolderHistory = (newPath: string) => {
    try {
      // 从localStorage读取最新的历史记录
      const saved = localStorage.getItem('folderHistory');
      let currentHistory = folderHistory;
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            currentHistory = parsed;
          }
        } catch (e) {
          console.error('解析历史记录失败:', e);
        }
      }
      
      // 去重：移除已存在的相同路径
      const filteredHistory = currentHistory.filter(path => path !== newPath);
      
      // 添加到开头（最新的在前面）
      const newHistory = [newPath, ...filteredHistory];
      
      // 限制最多保存3条记录
      const limitedHistory = newHistory.slice(0, 3);
      
      // 保存到本地存储
      localStorage.setItem('folderHistory', JSON.stringify(limitedHistory));
      setFolderHistory(limitedHistory);
      
      console.log('💾 历史记录已保存:', limitedHistory);
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }
  };

  // 清理历史记录中可能存在的无效路径
  const cleanupInvalidHistory = () => {
    console.log('🧹 开始清理无效历史记录');
    console.log('📁 当前根文件夹:', rootFolders.map(f => f.path));
    console.log('📜 当前历史记录:', folderHistory);
    
    // 简单的路径比较（移除末尾斜杠）
    const normalizePath = (p: string) => p.replace(/[\\/]+$/, '');
    const validPaths = new Set<string>();
    
    rootFolders.forEach(folder => {
      const normalizedPath = normalizePath(folder.path);
      validPaths.add(normalizedPath);
      console.log(`✅ 有效路径: "${normalizedPath}"`);
    });

    const newHistory = folderHistory.filter(path => {
      const normalizedHistoryPath = normalizePath(path);
      const isValid = validPaths.has(normalizedHistoryPath);
      console.log(`🔍 检查历史路径: "${normalizedHistoryPath}" = ${isValid ? '有效' : '无效'}`);
      return isValid;
    });
    
    console.log('🧹 清理后的历史记录:', newHistory);
    
    if (newHistory.length !== folderHistory.length) {
      localStorage.setItem('folderHistory', JSON.stringify(newHistory));
      setFolderHistory(newHistory);
      console.log('✅ 历史记录已清理');
    } else {
      console.log('✅ 无需清理，所有历史记录都有效');
    }
  };

  // 从历史记录中选择文件夹
  const selectFromHistory = async (path: string) => {
    try {
      console.log('🔍 从历史记录选择文件夹:', path);
      
      // 直接填充到添加文件夹弹窗
      setNewFolderPath(path);
      setNewFolderName(path.split('/').pop() || path.split('\\').pop() || '未命名文件夹');
      setShowAddFolderModal(true);
      
      // 清除之前的错误信息
      setError(null);
      
    } catch (error) {
      console.error('从历史记录选择文件夹失败:', error);
      setError('无法从历史记录选择文件夹');
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

  // 加载封面路径
  const loadCoverPaths = async (directory: DirectoryNode) => {
    const newCoverPaths = new Map<string, string>();
    
    // 只加载当前目录的视频封面，不递归加载子目录
    for (const video of directory.videos) {
      try {
        console.log(`🔍 开始查找封面，视频路径: ${video.path}`);
        const coverPath = await invoke<string>('find_cover_for_video', { videoPath: video.path });
        console.log(`📁 后端返回的封面路径: ${coverPath}`);
        
        if (coverPath) {
          // 使用新的 read_image_as_base64 命令获取图片数据
          try {
            const imageData = await invoke<string>('read_image_as_base64', { imagePath: coverPath });
            console.log(`✅ 使用后端找到的封面，转换为 base64 数据`);
            newCoverPaths.set(video.path, imageData);
          } catch (imageError) {
            console.log(`❌ 读取图片失败:`, imageError);
            newCoverPaths.set(video.path, '/placeholder-cover.jpg');
          }
        } else {
          console.log(`❌ 未找到封面，使用默认封面`);
          newCoverPaths.set(video.path, '/placeholder-cover.jpg');
        }
      } catch (error) {
        console.log(`❌ 查找封面失败:`, error);
        newCoverPaths.set(video.path, '/placeholder-cover.jpg');
      }
    }
    
    setCoverPaths(newCoverPaths);
  };

  // 加载文件夹封面路径
  const loadFolderCoverPaths = async (directory: DirectoryNode) => {
    const newFolderCoverPaths = new Map<string, string>();
    
    // 递归查找文件夹的封面
    const findFolderCover = async (node: DirectoryNode): Promise<string | null> => {
      // 如果当前节点有视频，查找第一个视频的封面
      if (node.videos.length > 0) {
        try {
          const coverPath = await invoke<string>('find_cover_for_video', { videoPath: node.videos[0].path });
          if (coverPath) {
            try {
              const imageData = await invoke<string>('read_image_as_base64', { imagePath: coverPath });
              return imageData;
            } catch (imageError) {
              console.log(`❌ 读取文件夹封面图片失败:`, imageError);
              return null;
            }
          }
        } catch (error) {
          console.log(`❌ 查找文件夹封面失败:`, error);
        }
        return null;
      } else if (node.children.length > 0) {
        // 如果有子目录，递归查找第一个子目录
        for (const child of node.children) {
          const cover = await findFolderCover(child);
          if (cover) return cover;
        }
      }
      return null;
    };
    
    // 为每个子文件夹查找封面
    for (const child of directory.children) {
      const coverPath = await findFolderCover(child);
      if (coverPath) {
        newFolderCoverPaths.set(child.path, coverPath);
      }
    }
    
    setFolderCoverPaths(newFolderCoverPaths);
  };

  // 加载根文件夹列表
  const loadRootFolders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const folders = await invoke<RootFolder[]>('get_root_folders');
      setRootFolders(folders);
      
      // 如果有文件夹，自动选择第一个并扫描
      if (folders.length > 0 && !selectedFolder) {
        setSelectedFolder(folders[0].id);
        await scanDirectory(folders[0].id);
      }
    } catch (error) {
      console.error('加载根文件夹失败:', error);
      setError('加载根文件夹失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 删除根文件夹
  const removeRootFolder = async (folderId: string) => {
    try {
      await invoke('remove_root_folder', { id: folderId });
      
      // 重新加载文件夹列表
      await loadRootFolders();
      
      // 如果删除的是当前选中的文件夹，清空选择
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
        setCurrentDirectory(null);
        setBreadcrumb([]);
      }
    } catch (error) {
      console.error('删除根文件夹失败:', error);
      setError(`删除根文件夹失败: ${error}`);
    }
  };

  // 选择文件夹
  const selectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      
      if (selected) {
        setNewFolderPath(selected);
        // 如果没有输入名称，使用文件夹名作为默认名称
        if (!newFolderName) {
          const folderName = selected.split('/').pop() || selected.split('\\').pop() || '未命名文件夹';
          setNewFolderName(folderName);
        }
      }
    } catch (error) {
      console.error('选择文件夹失败:', error);
      setError('选择文件夹失败');
    }
  };

  // 打开文件夹选择器
  const openFolderSelector = () => {
    selectFolder();
  };

  // 添加根文件夹
  const addRootFolder = async () => {
    if (!newFolderPath.trim()) {
      setError('请选择文件夹路径');
      return;
    }

    try {
      setIsAddingFolder(true);
      setError(null);
      
      // 检查是否已存在相同路径的文件夹
      const existingFolder = rootFolders.find(folder => {
        // 标准化路径进行比较（移除末尾斜杠，统一斜杠格式）
        const normalizePath = (p: string) => p.replace(/[\\/]+$/, '').replace(/\\/g, '/');
        const normalizedNewPath = normalizePath(newFolderPath);
        const normalizedExistingPath = normalizePath(folder.path);
        return normalizedNewPath === normalizedExistingPath;
      });

      if (existingFolder) {
        console.log('📁 文件夹已存在，刷新现有文件夹:', existingFolder);
        
        // 保存到历史记录
        saveFolderHistory(newFolderPath);
        
        // 选择现有的文件夹并刷新
        setSelectedFolder(existingFolder.id);
        await scanDirectory(existingFolder.id);
        
        // 关闭模态框并重置状态
        setShowAddFolderModal(false);
        setNewFolderPath('');
        setNewFolderName('');
        
        // 显示成功提示信息
        setSuccessMessage(`文件夹 "${existingFolder.name}" 已存在，已自动刷新`);
        
        return;
      }
      
      // 如果不存在，则添加新文件夹
      const folderId = await invoke<string>('add_root_folder', {
        path: newFolderPath,
        name: newFolderName || '未命名文件夹'
      });
      
      console.log('文件夹添加成功，ID:', folderId);
      
      // 保存到历史记录
      saveFolderHistory(newFolderPath);
      
      // 重新加载文件夹列表
      await loadRootFolders();
      
      // 自动选择新添加的文件夹
      setSelectedFolder(folderId);
      await scanDirectory(folderId);
      
      // 关闭模态框并重置状态
      setShowAddFolderModal(false);
      setNewFolderPath('');
      setNewFolderName('');
    } catch (error) {
      console.error('添加根文件夹失败:', error);
      setError(`添加根文件夹失败: ${error}`);
    } finally {
      setIsAddingFolder(false);
    }
  };

  // 扫描目录
  const scanDirectory = async (rootId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const directoryTree = await invoke<DirectoryNode>('scan_directory', { rootId });
      console.log('directoryTree', directoryTree);
      setCurrentDirectory(directoryTree);
      setSelectedFolder(rootId);
      // 重置面包屑，因为现在在根目录
      setBreadcrumb([]);
    } catch (error) {
      console.error('扫描目录失败:', error);
      setError('扫描目录失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 播放视频
  const playVideo = async (videoPath: string) => {
    try {
      setError(null);
      // 使用系统默认播放器打开视频
      await invoke('open_video', { path: videoPath });
    } catch (error) {
      console.error('播放视频失败:', error);
      setError('播放视频失败');
      // 如果后端命令不存在，使用系统命令
      try {
        if (navigator.platform.includes('Mac')) {
          // macOS
          await invoke('execute_command', { 
            command: 'open', 
            args: [videoPath] 
          });
        } else if (navigator.platform.includes('Win')) {
          // Windows
          await invoke('execute_command', { 
            command: 'start', 
            args: [videoPath] 
          });
        } else {
          // Linux
          await invoke('execute_command', { 
            command: 'xdg-open', 
            args: [videoPath] 
          });
        }
      } catch (cmdError) {
        console.error('执行系统命令失败:', cmdError);
        setError('无法打开视频文件');
      }
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时长
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // 导航到指定目录
  const navigateToDirectory = (directory: DirectoryNode) => {
    console.log(`🔍 导航到目录: ${directory.name}`);
    setCurrentDirectory(directory);
    
    // 更新面包屑
    const newBreadcrumb = [...breadcrumb];
    // 如果当前目录不在面包屑中，添加它
    if (!newBreadcrumb.find(item => item.path === directory.path)) {
      newBreadcrumb.push(directory);
    }
    setBreadcrumb(newBreadcrumb);
  };

  // 导航到面包屑中的目录
  const navigateToBreadcrumb = (index: number) => {
    const targetDirectory = breadcrumb[index];
    setCurrentDirectory(targetDirectory);
    // 截断面包屑到目标位置
    setBreadcrumb(breadcrumb.slice(0, index + 1));
  };



  // 返回根目录
  const goToRoot = () => {
    if (selectedFolder) {
      scanDirectory(selectedFolder);
      setBreadcrumb([]);
    }
  };

  // 打开当前文件夹
  const openCurrentFolder = async () => {
    if (currentDirectory) {
      try {
        await invoke('open_folder', { path: currentDirectory.path });
        console.log(`👉 已打开文件夹: ${currentDirectory.path}`);
      } catch (error) {
        console.error('打开文件夹失败:', error);
        setError('无法打开文件夹');
      }
    }
  };

  // 重新扫描当前文件夹
  const rescanCurrentFolder = async () => {
    if (currentDirectory && selectedFolder) {
      try {
        await invoke('rescan_directory', { rootId: selectedFolder });
        console.log(`🔄 重新扫描文件夹: ${currentDirectory.path}`);
        
        // 重新扫描完成后，刷新当前目录的统计信息
        const updatedDirectory = await invoke<DirectoryNode>('scan_directory', { rootId: selectedFolder });
        setCurrentDirectory(updatedDirectory);
        
        // 重新加载封面和文件夹封面
        loadCoverPaths(updatedDirectory);
        loadFolderCoverPaths(updatedDirectory);
        
        // 重置面包屑到根目录
        setBreadcrumb([]);
        
        setError(null);
      } catch (error) {
        console.error('重新扫描文件夹失败:', error);
        setError('重新扫描文件夹失败');
      }
    }
  };

  // 预览视频
  const previewVideo = (video: VideoInfo) => {
    const coverPath = coverPaths.get(video.path) || '/placeholder-cover.jpg';
    setPreviewImage(coverPath);
    setPreviewTitle(video.name);
    setShowPreviewModal(true);
  };

  if (isLoading) {
    return (
      <div className="app">
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
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="app-title">VideoVault</h1>
          </div>

          <div className="folder-section">
            <div className="section-header">
              <RainbowButton
                onClick={() => setShowAddFolderModal(true)}
                className="h-8 px-3 text-xs my-2"
              >
                <FolderPlus size={16} />
                添加文件夹
              </RainbowButton>
            </div>

            <div className="folder-list">
              {rootFolders.map(folder => (
                <div
                  key={folder.id}
                  className={`folder-item ${selectedFolder === folder.id ? 'active' : ''}`}
                >
                  <div 
                    className="folder-content"
                    onClick={() => scanDirectory(folder.id)}
                  >
                    <div className="folder-info">
                      <HardDrive className="w-4 h-4 text-primary" />
                      <span className="folder-name">{folder.name}</span>
                    </div>
                  </div>
                  <button
                    className="delete-folder-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRootFolder(folder.id);
                    }}
                    title="删除文件夹"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 历史记录区域 */}
          <div className="history-section">
            <div className="section-header">
              <h3 className="section-title">最近添加</h3>
              {folderHistory.length > 0 && (
                <div className="history-controls">
                  <button
                    className="cleanup-history-btn"
                    onClick={cleanupInvalidHistory}
                    title="清理无效路径"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="clear-history-btn"
                    onClick={() => {
                      setFolderHistory([]);
                      localStorage.removeItem('folderHistory');
                    }}
                    title="清除所有历史记录"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            {folderHistory.length > 0 ? (
              <div className="history-list">
                {folderHistory.map((path, index) => {
                  const folderName = path.split('/').pop() || path.split('\\').pop() || '未命名文件夹';
                  return (
                    <div
                      key={`${path}-${index}`}
                      className="history-item"
                      onClick={() => selectFromHistory(path)}
                      title={`点击选择: ${path}`}
                      onMouseEnter={() => showInfoMessage(path)}
                      onMouseLeave={() => hideInfoMessage()}
                    >
                      <div className="history-content">
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                        <span className="history-name">{folderName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="history-empty">
                <p>暂无历史记录</p>
                <p className="history-hint">添加文件夹后会自动保存</p>
              </div>
            )}
          </div>
        </aside>

        {/* 主内容区域 */}
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
              {/* 面包屑导航 */}
              <nav className="breadcrumb" aria-label="面包屑导航">
                <button 
                  className="breadcrumb-item home"
                  onClick={goToRoot}
                  title="返回根目录"
                  aria-label="返回根目录"
                >
                  <span className="breadcrumb-text">
                    {selectedFolder 
                      ? rootFolders.find(f => f.id === selectedFolder)?.name || '未知文件夹'
                      : '根目录'
                    }
                  </span>
                </button>
                {breadcrumb.map((item, index) => (
                  <React.Fragment key={item.path}>
                    <span className="breadcrumb-separator" aria-hidden="true">/</span>
                    <button 
                      className="breadcrumb-item"
                      onClick={() => navigateToBreadcrumb(index)}
                      title={`进入 ${item.name}`}
                      aria-label={`进入 ${item.name} 文件夹`}
                    >
                      <span className="breadcrumb-text">{item.name}</span>
                    </button>
                  </React.Fragment>
                ))}
              </nav>
            </div>
            <div className="view-controls">
              <button 
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="网格视图"
              >
                <Grid3X3 size={20} />
              </button>
              <button 
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="列表视图"
              >
                <List size={20} />
              </button>
            </div>
          </div>

          <div className="content-body">
            {isLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>加载中...</p>
              </div>
            ) : currentDirectory === null ? (
              <div className="empty-state">
                <h3>文件夹为空</h3>
                <p>该文件夹中没有找到视频文件</p>
                <button 
                  className="scan-btn"
                  onClick={() => scanDirectory(selectedFolder || '')}
                >
                  重新扫描
                </button>
              </div>
            ) : (
              <>
                {/* 当前目录信息 */}
                <div className="current-directory-info">
                  <div className="directory-info-content">
                    <p>包含 {currentDirectory.video_count} 个视频文件，{currentDirectory.cover_count} 个封面文件</p>
                  </div>
                  <div className="action-buttons">
                    <button 
                      className="open-folder-btn"
                      onClick={() => openCurrentFolder()}
                      title="在系统文件管理器中打开此文件夹"
                    >
                      <FolderOpen size={16} />
                      <span>打开文件夹</span>
                    </button>
                    <button 
                      className="rescan-btn"
                      onClick={() => rescanCurrentFolder()}
                      title="重新扫描当前文件夹"
                    >
                      <RefreshCw size={16} />
                      <span>重新扫描</span>
                    </button>
                  </div>
                </div>

                {/* 内容区域 */}
                <div className={`video-container ${viewMode}`}>
                  {/* 文件夹节点 */}
                  {currentDirectory.children.map((child) => (
                    <div key={child.path} className="directory-node">
                      {/* 文件夹节点 */}
                      <div 
                        className="folder-node clickable"
                        onClick={() => navigateToDirectory(child)}
                        title={`进入 ${child.name} 文件夹`}
                      >
                        {/* 文件夹封面 - 只在网格模式下显示 */}
                        {viewMode === 'grid' && (() => {
                          // 查找第一个叶子节点
                          const findFirstLeafNode = (node: DirectoryNode): DirectoryNode | null => {
                            if (node.videos.length > 0) {
                              // 找到叶子节点（有视频的节点）
                              return node;
                            } else if (node.children.length > 0) {
                              // 递归查找第一个子目录
                              for (const child of node.children) {
                                const leaf = findFirstLeafNode(child);
                                if (leaf) return leaf;
                              }
                            }
                            return null;
                          };
                          
                          // 查找第一个叶子节点
                          const firstLeaf = findFirstLeafNode(child);
                          
                          if (firstLeaf && firstLeaf.videos.length > 0) {
                            // 如果找到叶子节点且有视频，显示封面
                            const coverPath = folderCoverPaths.get(child.path);
                            
                            if (coverPath) {
                              return (
                                <div className="folder-cover">
                                  <img 
                                    src={coverPath}
                                    alt={`${child.name} 封面`}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = '/placeholder-cover.jpg';
                                    }}
                                  />
                                </div>
                              );
                            } else {
                              // 如果还没有加载到封面，显示默认封面
                              return (
                                <div className="folder-cover">
                                  <img 
                                    src="/placeholder-cover.jpg"
                                    alt={`${child.name} 封面`}
                                  />
                                </div>
                              );
                            }
                          } else {
                            // 如果没有找到封面，显示默认封面
                            return (
                              <div className="folder-cover">
                                <img 
                                  src="/placeholder-cover.jpg"
                                  alt={`${child.name} 封面`}
                                />
                              </div>
                            );
                          }
                        })()}
                        
                        {/* 文件夹信息区域 */}
                        <div className="folder-info">
                          <div className="folder-icon-name">
                            <HardDrive className="w-4 h-4 text-primary" />
                            <h4 className="folder-name">{child.name}</h4>
                          </div>
                          <div className="folder-stats">
                            <span className="folder-video-count">{child.video_count} 视频</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* 当前目录的视频 - 列表视图和网格视图都显示 */}
                  {currentDirectory.videos.map((video, index) => (
                    <div key={`${currentDirectory.path}-${index}`} className="video-card">
                      {viewMode === 'grid' ? (
                        // 网格模式：显示封面和悬停效果
                        <>
                          <div className="video-cover">
                            {(() => {
                              const coverPath = coverPaths.get(video.path) || '/placeholder-cover.jpg';
                              console.log(`🎬 视频 "${video.name}" 使用封面:`, coverPath);
                              return (
                                <img 
                                  src={coverPath} 
                                  alt={video.name}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    console.log(`❌ 封面加载失败:`, coverPath, '，使用默认封面');
                                    target.src = '/placeholder-cover.jpg';
                                  }}
                                />
                              );
                            })()}
                            <div className="video-overlay">
                              <div className="video-actions">
                                <ShimmerButton
                                  onClick={() => playVideo(video.path)}
                                  className="h-10 px-4"
                                  shimmerColor="#fbbf24"
                                  background="rgba(0, 0, 0, 0.8)"
                                >
                                  <Play size={20} />
                                  播放
                                </ShimmerButton>
                                <ShimmerButton
                                  onClick={() => previewVideo(video)}
                                  className="h-10 px-4"
                                  shimmerColor="#ffffff"
                                  background="rgba(255, 255, 255, 0.15)"
                                  borderRadius="100px"
                                >
                                  <Eye size={20} />
                                  预览
                                </ShimmerButton>
                              </div>
                            </div>
                          </div>
                          
                          <div className="video-info">
                            <h4 className="video-title" title={video.name}>
                              {video.name}
                            </h4>
                            <div className="video-meta">
                              <span className="video-size">{formatFileSize(video.size)}</span>
                              {video.resolution && (
                                <span className="video-resolution">{video.resolution[0]}x{video.resolution[1]}</span>
                              )}
                              {video.duration && (
                                <span className="video-duration">{formatDuration(video.duration)}</span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        // 列表模式：使用与文件夹一致的样式
                        <div 
                          className="folder-node clickable"
                          onClick={() => playVideo(video.path)}
                          title={`播放 ${video.name}`}
                        >
                          <div className="folder-info">
                            <div className="folder-icon-name">
                              <Video className="w-4 h-4 text-primary" />
                              <div className="folder-name">{video.name}</div>
                            </div>
                            <div className="folder-stats">
                              <span className="folder-video-count">{formatFileSize(video.size)}</span>
                              {video.resolution && (
                                <span className="folder-cover-count">{video.resolution[0]}x{video.resolution[1]}</span>
                              )}
                              {video.duration && (
                                <span className="folder-cover-count">{formatDuration(video.duration)}</span>
                              )}
                            </div>
                          </div>
                          <div className="folder-arrow">
                            <div className="video-actions-list">
                              <button
                                className="action-btn preview-btn"
                                onClick={() => previewVideo(video)}
                                title="预览视频"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                className="action-btn play-btn"
                                onClick={() => playVideo(video.path)}
                                title="播放视频"
                              >
                                <Play size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
        </div>
              </>
            )}
          </div>
        </main>

        {/* 添加文件夹模态框 */}
        {showAddFolderModal && (
          <div className="modal-overlay" onClick={() => setShowAddFolderModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="text-lg font-semibold">添加根文件夹</h3>
                <button 
                  className="modal-close"
                  onClick={() => setShowAddFolderModal(false)}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="modal-body">
                {error && (
                  <div className="error-message">
                    <p>{error}</p>
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="folderPath">文件夹路径:</label>
                  <div className="path-input-group">
                    <input
                      id="folderPath"
                      type="text"
                      value={newFolderPath}
                      onChange={(e) => setNewFolderPath(e.target.value)}
                      placeholder="选择文件夹路径"
                      readOnly
                    />
                    <RainbowButton
                      onClick={openFolderSelector}
                      className="h-10 px-4"
                      variant="outline"
                    >
                      选择
                    </RainbowButton>
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="folderName">文件夹名称:</label>
                  <input
                    id="folderName"
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="输入文件夹名称"
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <RainbowButton
                  variant="outline"
                  onClick={() => setShowAddFolderModal(false)}
                >
                  取消
                </RainbowButton>
                <RainbowButton
                  onClick={addRootFolder}
                  disabled={isAddingFolder || !newFolderPath || !newFolderName}
                >
                  {isAddingFolder ? '添加中...' : '添加'}
                </RainbowButton>
              </div>
            </div>
          </div>
        )}

        {/* 预览弹窗 */}
        {showPreviewModal && (
          <div className="modal-overlay preview-overlay" onClick={() => setShowPreviewModal(false)}>
            <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="preview-header">
                <h3 className="preview-title">{previewTitle}</h3>
                <button
                  className="preview-close"
                  onClick={() => setShowPreviewModal(false)}
                >
                  <X size={24} />
                </button>
              </div>
              <div className="preview-image-wrapper">
                <img 
                  src={previewImage} 
                  alt={previewTitle}
                  className="preview-image"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-cover.jpg';
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="error-toast">
            <div className="error-content">
              <span className="error-message">{error}</span>
              <button
                className="error-close"
                onClick={() => setError(null)}
              >
                <X size={16} />
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
                <X size={16} />
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
