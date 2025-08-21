import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { type DirectoryNode } from '../types';

export const useDirectoryScan = () => {
  const [currentDirectory, setCurrentDirectory] = useState<DirectoryNode | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<DirectoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootDirectoryCache, setRootDirectoryCache] = useState<DirectoryNode | null>(null);

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
      setCurrentDirectory(cached.data);
      setSelectedFolder(rootId);
      setRootDirectoryCache(cached.data);
      setBreadcrumb([]);
      return true;
    } catch {
      return false;
    }
  };

  // 扫描目录（支持 revalidate：默认 true；为 false 时命中缓存则不请求后端）
  const scanDirectory = async (rootId: string, revalidate: boolean = true) => {
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
              setSelectedFolder(rootId);
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
      setCurrentDirectory(directoryTree);
      setSelectedFolder(rootId);
      setRootDirectoryCache(directoryTree);
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
        setCurrentDirectory(updatedDirectory);
        setRootDirectoryCache(updatedDirectory);

        // 更新缓存
        try {
          const volumeKey = await invoke<string>('get_volume_key', { rootId: selectedFolder });
          const cacheKey = buildStorageKey(volumeKey, selectedFolder);
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ data: updatedDirectory, generatedAt: Date.now() })
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
  const navigateToDirectory = (directory: DirectoryNode) => {
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
  const goToRoot = (rootDirectory?: DirectoryNode) => {
    console.log('goToRoot', rootDirectory);
    if (selectedFolder) {
      if (rootDirectory) {
        // 如果提供了根目录数据，直接使用，不重新扫描
        setCurrentDirectory(rootDirectory);
        setBreadcrumb([]);
      } else {
        // 如果没有提供根目录数据，才重新扫描
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
  };

  // 获取根目录数据（用于快速切换，不重新扫描）
  const getRootDirectory = (): DirectoryNode | null => {
    // 优先返回缓存的根目录；如果缓存不存在且当前就在根目录，返回当前目录
    if (rootDirectoryCache) {
      return rootDirectoryCache;
    }
    if (currentDirectory && breadcrumb.length === 0) {
      return currentDirectory;
    }
    return null;
  };

  return {
    currentDirectory,
    selectedFolder,
    breadcrumb,
    isLoading,
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
  };
};
