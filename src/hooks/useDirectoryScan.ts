import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { type DirectoryNode, type VideoMetadata } from '../types';

export const useDirectoryScan = () => {
  const [currentDirectory, setCurrentDirectory] = useState<DirectoryNode | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<DirectoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootDirectoryCache, setRootDirectoryCache] = useState<DirectoryNode | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // 根据卷标识生成缓存 key
  const buildStorageKey = (volumeKey: string, rootId: string) => `vv:dirTree:${volumeKey}:${rootId}`;

  // 仅根据缓存直接 hydrate（不请求后端）。成功返回 true。
  const hydrateFromCache = (volumeKey: string, rootId: string): boolean => {
    try {
      const cacheKey = buildStorageKey(volumeKey, rootId);
      const cachedRaw = localStorage.getItem(cacheKey);
      if (!cachedRaw) return false;
      const cached = JSON.parse(cachedRaw) as { data: DirectoryNode; generatedAt: number };
      if (!cached || !cached.data) return false;
      
      // 从缓存恢复数据
      setCurrentDirectory(cached.data);
      setSelectedFolder(rootId);
      setRootDirectoryCache(cached.data);
      setBreadcrumb([]);
      
      return true;
    } catch {
      return false;
    }
  };

  // 加载指定目录的视频元数据
  const loadVideoMetadata = async (directoryPath: string) => {
    if (!selectedFolder) return;
    
    // 根据路径找到要更新的目录节点
    let targetDirectory: DirectoryNode | null = null;
    
    // 如果当前目录就是目标目录
    if (currentDirectory && currentDirectory.path === directoryPath) {
      targetDirectory = currentDirectory;
    } else {
      // 否则需要从目录树中找到目标目录
      const findDirectoryByPath = (node: DirectoryNode, targetPath: string): DirectoryNode | null => {
        if (node.path === targetPath) {
          return node;
        }
        for (const child of node.children) {
          const found = findDirectoryByPath(child, targetPath);
          if (found) return found;
        }
        return null;
      };
      
      // 从根目录缓存开始查找
      if (rootDirectoryCache) {
        targetDirectory = findDirectoryByPath(rootDirectoryCache, directoryPath);
      }
    }
    
    if (!targetDirectory) {
      console.warn('[VideoVault] 未找到目标目录', { directoryPath });
      return;
    }
    
    // 检查目标目录是否已经有元数据
    if (targetDirectory.videos.some(v => v.metadata)) {
      console.debug('[VideoVault] 目录已有元数据，跳过加载', { directoryPath });
      return;
    }

    try {
      setIsLoadingMetadata(true);
      console.debug('[VideoVault] 开始加载视频元数据', { 
        directoryPath, 
        videoCount: targetDirectory.videos.length,
        hasMetadata: targetDirectory.videos.some(v => v.metadata)
      });
      
      const metadataResults = await invoke<Array<[string, VideoMetadata]>>('get_video_metadata_for_directory', {
        rootId: selectedFolder,
        directoryPath
      });

      console.debug('[VideoVault] 后端返回元数据', { 
        directoryPath, 
        resultsCount: metadataResults.length,
        results: metadataResults.map(([path, meta]) => ({ path, hasDuration: !!meta.duration, hasResolution: !!meta.resolution }))
      });

      // 更新目标目录中的视频信息
      console.log('targetDirectory', targetDirectory, metadataResults);
      const updatedVideos = targetDirectory.videos.map(video => {
        const metadata = metadataResults.find(([path]) => path === video.path);
        if (metadata) {
          console.debug('[VideoVault] 更新视频元数据', { 
            videoPath: video.path, 
            hasDuration: !!metadata[1].duration,
            hasResolution: !!metadata[1].resolution
          });
          return {
            ...video,
            metadata: metadata[1]
          };
        }
        return video;
      });

      // 检查是否真的有变化
      const hasChanges = updatedVideos.some((video, index) => {
        const original = targetDirectory!.videos[index];
        return video.metadata !== original.metadata;
      });

      if (hasChanges) {
        console.debug('[VideoVault] 检测到元数据变化，更新状态', { 
          directoryPath, 
          changesCount: updatedVideos.filter(v => v.metadata).length
        });
        
        // 创建新的目录对象，保持不可变性
        const updatedDirectory = {
          ...targetDirectory,
          videos: updatedVideos
        };
        
        // 更新当前目录状态（如果当前目录就是目标目录）
        if (currentDirectory && currentDirectory.path === directoryPath) {
          console.debug('[VideoVault] 准备更新currentDirectory', { 
            directoryPath,
            beforeUpdate: {
              path: currentDirectory.path,
              videoCount: currentDirectory.videos.length,
              videosWithMetadata: currentDirectory.videos.filter(v => v.metadata).length
            },
            afterUpdate: {
              path: updatedDirectory.path,
              videoCount: updatedDirectory.videos.length,
              videosWithMetadata: updatedDirectory.videos.filter(v => v.metadata).length
            }
          });
          
          setCurrentDirectory(updatedDirectory);
          
          console.debug('[VideoVault] currentDirectory已更新', { 
            directoryPath,
            newState: {
              path: updatedDirectory.path,
              videoCount: updatedDirectory.videos.length,
              videosWithMetadata: updatedDirectory.videos.filter(v => v.metadata).length
            }
          });
        }
        
        // 更新根目录缓存
        if (breadcrumb.length === 0) {
          console.debug('[VideoVault] 更新根目录缓存', { directoryPath });
          setRootDirectoryCache(updatedDirectory);
        }

        // 同步更新localStorage缓存，包含元数据
        try {
          const volumeKey = await invoke<string>('get_volume_key', { rootId: selectedFolder });
          if (volumeKey) {
            const cacheKey = buildStorageKey(volumeKey, selectedFolder);
            const cachedRaw = localStorage.getItem(cacheKey);
            if (cachedRaw) {
              const cached = JSON.parse(cachedRaw) as { data: DirectoryNode; generatedAt: number };
              // 递归更新目录树中的元数据
              const updatedTree = updateDirectoryTreeWithMetadata(cached.data, directoryPath, metadataResults);
              localStorage.setItem(
                cacheKey,
                JSON.stringify({ data: updatedTree, generatedAt: Date.now() })
              );
              console.debug('[VideoVault] 元数据已同步到localStorage缓存', { 
                cacheKey, 
                updatedVideosCount: updatedVideos.filter(v => v.metadata).length 
              });
            }
          }
        } catch (error) {
          console.warn('同步元数据到localStorage失败:', error);
        }
      } else {
        console.debug('[VideoVault] 未检测到元数据变化，跳过状态更新', { directoryPath });
      }

      console.debug('[VideoVault] 视频元数据加载完成', { 
        directoryPath, 
        count: metadataResults.length,
        updatedVideosCount: updatedVideos.filter(v => v.metadata).length
      });
    } catch (error) {
      console.error('加载视频元数据失败:', error);
      setError('加载视频元数据失败');
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  // 递归更新目录树中的元数据
  const updateDirectoryTreeWithMetadata = (
    directory: DirectoryNode, 
    targetPath: string, 
    metadataResults: Array<[string, VideoMetadata]>
  ): DirectoryNode => {
    console.debug('[VideoVault] 递归更新目录树', { 
      currentPath: directory.path, 
      targetPath, 
      isTarget: directory.path === targetPath,
      videosCount: directory.videos.length
    });

    // 如果这是目标目录，更新其中的视频元数据
    if (directory.path === targetPath) {
      const updatedVideos = directory.videos.map(video => {
        const metadata = metadataResults.find(([path]) => path === video.path);
        if (metadata) {
          return {
            ...video,
            metadata: metadata[1]
          };
        }
        return video;
      });

      console.debug('[VideoVault] 更新目标目录元数据', { 
        targetPath, 
        originalVideosCount: directory.videos.length,
        updatedVideosCount: updatedVideos.length,
        videosWithMetadata: updatedVideos.filter(v => v.metadata).length
      });

      return {
        ...directory,
        videos: updatedVideos
      };
    }

    // 递归更新子目录
    const updatedChildren = directory.children.map(child => 
      updateDirectoryTreeWithMetadata(child, targetPath, metadataResults)
    );

    return {
      ...directory,
      children: updatedChildren
    };
  };

  // 扫描目录（支持 revalidate：默认 true；为 false 时命中缓存则不请求后端）
  const scanDirectory = async (rootId: string, revalidate: boolean = true, setSelected: boolean = true) => {
    try {
      setIsLoading(true);
      setError(null);
      // 先获取卷标识
      let volumeKey: string | null = null;
      try {
        volumeKey = await invoke<string>('get_volume_key', { rootId });
      } catch {
        volumeKey = null;
      }

      // 如果有缓存，先展示缓存（stale-while-revalidate）
      let cacheHit = false;
      if (volumeKey) {
        try {
          const cacheKey = buildStorageKey(volumeKey, rootId);
          const cachedRaw = localStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as { data: DirectoryNode; generatedAt: number };
            if (cached && cached.data) {
              console.debug('[VideoVault] 缓存命中', { cacheKey });
              setCurrentDirectory(cached.data);
              if (setSelected) {
                setSelectedFolder(rootId);
              }
              setRootDirectoryCache(cached.data);
              setBreadcrumb([]);
              cacheHit = true;
            }
          }
        } catch {
          // 忽略缓存解析错误
        }
      }

      // 若已命中缓存且不需要刷新，直接返回
      if (cacheHit && !revalidate) {
        return;
      }

      // 后台刷新（或无缓存/需要刷新时拉取）
      const directoryTree = await invoke<DirectoryNode>('scan_directory', { rootId });

      // 写入缓存
      if (volumeKey) {
        try {
          const cacheKey = buildStorageKey(volumeKey, rootId);
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ data: directoryTree, generatedAt: Date.now() })
          );
          console.debug('[VideoVault] 缓存写入', { cacheKey });
        } catch {
          // 忽略缓存写入错误
        }
      }

      // 更新 UI 状态
      // 如果当前目录已经有元数据，需要保留元数据信息
      let finalDirectoryTree = directoryTree;
      if (currentDirectory && currentDirectory.path === directoryTree.path) {
        // 合并元数据信息
        const mergeMetadata = (newNode: DirectoryNode, oldNode: DirectoryNode): DirectoryNode => {
          // 更新当前节点的视频元数据
          const updatedVideos = newNode.videos.map(newVideo => {
            const oldVideo = oldNode.videos.find(v => v.path === newVideo.path);
            if (oldVideo && oldVideo.metadata) {
              return { ...newVideo, metadata: oldVideo.metadata };
            }
            return newVideo;
          });

          // 递归更新子目录
          const updatedChildren = newNode.children.map(newChild => {
            const oldChild = oldNode.children.find(c => c.path === newChild.path);
            if (oldChild) {
              return mergeMetadata(newChild, oldChild);
            }
            return newChild;
          });

          return {
            ...newNode,
            videos: updatedVideos,
            children: updatedChildren
          };
        };

        finalDirectoryTree = mergeMetadata(directoryTree, currentDirectory);
        console.debug('[VideoVault] 合并元数据信息', {
          originalVideosCount: directoryTree.videos.length,
          mergedVideosWithMetadata: finalDirectoryTree.videos.filter(v => v.metadata).length
        });
      }

      setCurrentDirectory(finalDirectoryTree);
      if (setSelected) {
        setSelectedFolder(rootId);
      }
      setRootDirectoryCache(finalDirectoryTree);
      setBreadcrumb([]);
    } catch (error) {
      console.error('扫描目录失败:', error);
      setError('扫描目录失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 重新扫描当前文件夹
  const rescanCurrentFolder = async () => {
    if (currentDirectory && selectedFolder) {
      try {
        await invoke('rescan_directory', { rootId: selectedFolder });

        // 重新扫描完成后，刷新当前目录的统计信息
        const updatedDirectory = await invoke<DirectoryNode>('scan_directory', { rootId: selectedFolder });
        console.log('updatedDirectory', updatedDirectory);
        
        // 保留已有的元数据信息
        let finalUpdatedDirectory = updatedDirectory;
        if (currentDirectory.path === updatedDirectory.path) {
          // 合并元数据信息
          const mergeMetadata = (newNode: DirectoryNode, oldNode: DirectoryNode): DirectoryNode => {
            // 更新当前节点的视频元数据
            const updatedVideos = newNode.videos.map(newVideo => {
              const oldVideo = oldNode.videos.find(v => v.path === newVideo.path);
              if (oldVideo && oldVideo.metadata) {
                return { ...newVideo, metadata: oldVideo.metadata };
              }
              return newVideo;
            });

            // 递归更新子目录
            const updatedChildren = newNode.children.map(newChild => {
              const oldChild = oldNode.children.find(c => c.path === newChild.path);
              if (oldChild) {
                return mergeMetadata(newChild, oldChild);
              }
              return newChild;
            });

            return {
              ...newNode,
              videos: updatedVideos,
              children: updatedChildren
            };
          };

          finalUpdatedDirectory = mergeMetadata(updatedDirectory, currentDirectory);
          console.debug('[VideoVault] 重新扫描时合并元数据信息', {
            originalVideosCount: updatedDirectory.videos.length,
            mergedVideosWithMetadata: finalUpdatedDirectory.videos.filter(v => v.metadata).length
          });
        }
        
        setCurrentDirectory(finalUpdatedDirectory);
        // 注意：这里不应该更新rootDirectoryCache，因为rescanCurrentFolder可能不是根目录
        // setRootDirectoryCache(finalUpdatedDirectory);

        // 更新缓存
        try {
          const volumeKey = await invoke<string>('get_volume_key', { rootId: selectedFolder });
          const cacheKey = buildStorageKey(volumeKey, selectedFolder);
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ data: finalUpdatedDirectory, generatedAt: Date.now() })
          );
        } catch {
          // 忽略缓存失败
        }

        // 重置面包屑到根目录
        setBreadcrumb([]);

        setError(null);
      } catch (error) {
        console.error('重新扫描文件夹失败:', error);
        setError('重新扫描文件夹失败');
      }
    }
  };

  // 导航到指定目录
  const navigateToDirectory = async (directory: DirectoryNode) => {
    console.debug('[VideoVault] 导航到目录', { 
      from: currentDirectory?.path, 
      to: directory.path,
      breadcrumbLength: breadcrumb.length 
    });

    // 先更新面包屑，再更新当前目录
    // 构建正确的面包屑层级
    let newBreadcrumb: DirectoryNode[] = [];
    
    if (breadcrumb.length === 0) {
      // 如果面包屑为空，说明这是从根目录开始的导航
      newBreadcrumb = [directory];
    } else {
      // 检查新目录是否在现有面包屑的路径上
      const existingIndex = breadcrumb.findIndex(item => item.path === directory.path);
      if (existingIndex >= 0) {
        // 如果目录已在面包屑中，截断到该位置
        newBreadcrumb = breadcrumb.slice(0, existingIndex + 1);
      } else {
        // 检查新目录是否是现有面包屑中某个目录的子目录
        let shouldAdd = true;
        for (let i = breadcrumb.length - 1; i >= 0; i--) {
          const breadcrumbItem = breadcrumb[i];
          if (directory.path.startsWith(breadcrumbItem.path + '/') || 
              directory.path.startsWith(breadcrumbItem.path + '\\')) {
            // 新目录是面包屑中某个目录的子目录，保留到该位置并添加新目录
            newBreadcrumb = [...breadcrumb.slice(0, i + 1), directory];
            shouldAdd = false;
            break;
          }
        }
        
        if (shouldAdd) {
          // 如果新目录不是任何现有目录的子目录，直接添加到末尾
          newBreadcrumb = [...breadcrumb, directory];
        }
      }
    }
    
    console.debug('[VideoVault] 面包屑更新', {
      oldBreadcrumb: breadcrumb.map(b => b.path),
      newBreadcrumb: newBreadcrumb.map(b => b.path),
      targetPath: directory.path
    });
    
    setBreadcrumb(newBreadcrumb);
    setCurrentDirectory(directory);

    // 如果目录包含视频文件且没有元数据，则立即加载元数据
    if (directory.videos.length > 0 && !directory.videos.some(v => v.metadata)) {
      console.debug('[VideoVault] 目录需要加载元数据', { 
        directoryPath: directory.path, 
        videoCount: directory.videos.length 
      });
      // 立即加载，不延迟
      loadVideoMetadata(directory.path);
    } else {
      console.debug('[VideoVault] 目录无需加载元数据', { 
        directoryPath: directory.path, 
        videoCount: directory.videos.length,
        hasMetadata: directory.videos.some(v => v.metadata)
      });
    }
  };

  // 导航到面包屑中的目录
  const navigateToBreadcrumb = async (index: number) => {
    const targetBreadcrumbItem = breadcrumb[index];
    console.debug('[VideoVault] 导航到面包屑目录', { 
      from: currentDirectory?.path, 
      to: targetBreadcrumbItem.path,
      breadcrumbIndex: index,
      breadcrumbLength: breadcrumb.length 
    });

    // 从最新的目录树中找到目标目录的完整信息
    let targetDirectory: DirectoryNode | null = null;
    
    if (rootDirectoryCache) {
      const findDirectoryByPath = (node: DirectoryNode, targetPath: string): DirectoryNode | null => {
        if (node.path === targetPath) {
          return node;
        }
        for (const child of node.children) {
          const found = findDirectoryByPath(child, targetPath);
          if (found) return found;
        }
        return null;
      };
      
      targetDirectory = findDirectoryByPath(rootDirectoryCache, targetBreadcrumbItem.path);
    }
    
    // 如果找不到，使用面包屑中的对象（回退方案）
    if (!targetDirectory) {
      console.warn('[VideoVault] 在目录树中未找到目标目录，使用面包屑对象', { 
        path: targetBreadcrumbItem.path 
      });
      targetDirectory = targetBreadcrumbItem;
    } else {
      console.debug('[VideoVault] 在目录树中找到目标目录', { 
        path: targetDirectory.path,
        videoCount: targetDirectory.videos.length,
        childrenCount: targetDirectory.children.length
      });
    }

    // 先截断面包屑，再更新当前目录
    const newBreadcrumb = breadcrumb.slice(0, index + 1);
    
    // 批量更新状态，避免中间状态不一致
    setBreadcrumb(newBreadcrumb);
    setCurrentDirectory(targetDirectory);

    // 如果目录包含视频文件且没有元数据，则立即加载元数据
    if (targetDirectory.videos.length > 0 && !targetDirectory.videos.some(v => v.metadata)) {
      console.debug('[VideoVault] 面包屑目录需要加载元数据', { 
        directoryPath: targetDirectory.path, 
        videoCount: targetDirectory.videos.length 
      });
      // 立即加载，不延迟
      loadVideoMetadata(targetDirectory.path);
    } else {
      console.debug('[VideoVault] 面包屑目录无需加载元数据', { 
        directoryPath: targetDirectory.path, 
        videoCount: targetDirectory.videos.length,
        hasMetadata: targetDirectory.videos.some(v => v.metadata)
      });
    }
  };

  // 返回根目录
  const goToRoot = (rootDirectory?: DirectoryNode) => {
    console.debug('[VideoVault] goToRoot被调用', { 
      hasRootDirectory: !!rootDirectory,
      rootDirectoryPath: rootDirectory?.path,
      selectedFolder,
      hasRootDirectoryCache: !!rootDirectoryCache
    });
    
    if (selectedFolder) {
      if (rootDirectory) {
        // 如果提供了根目录数据，直接使用
        console.debug('[VideoVault] 使用提供的根目录数据');
        setCurrentDirectory(rootDirectory);
        setBreadcrumb([]);
      } else {
        // 如果没有提供根目录数据，重新扫描
        console.debug('[VideoVault] 没有根目录数据，重新扫描');
        scanDirectory(selectedFolder);
        setBreadcrumb([]);
      }
    }
  };

  // 清理所有状态
  const clearAllStates = () => {
    setCurrentDirectory(null);
    setSelectedFolder(null);
    setBreadcrumb([]);
    setError(null);
    setIsLoading(false);
    setRootDirectoryCache(null);
    setIsLoadingMetadata(false);
  };

  // 获取根目录数据（用于快速切换，不重新扫描）
  const getRootDirectory = (): DirectoryNode | null => {
    // 只返回缓存的根目录，确保这是真正的根目录
    if (rootDirectoryCache) {
      console.debug('[VideoVault] getRootDirectory: 返回缓存的根目录', {
        path: rootDirectoryCache.path,
        videoCount: rootDirectoryCache.videos.length,
        childrenCount: rootDirectoryCache.children.length
      });
      return rootDirectoryCache;
    }
    
    // 如果没有缓存的根目录，返回null，让goToRoot重新扫描
    console.debug('[VideoVault] getRootDirectory: 没有缓存的根目录，返回null');
    return null;
  };

  return {
    currentDirectory,
    selectedFolder,
    breadcrumb,
    isLoading,
    isLoadingMetadata,
    error,
    setError,
    scanDirectory,
    rescanCurrentFolder,
    navigateToDirectory,
    navigateToBreadcrumb,
    goToRoot,
    setSelectedFolder,
    clearAllStates,
    getRootDirectory,
    hydrateFromCache,
    loadVideoMetadata,
  };
};
