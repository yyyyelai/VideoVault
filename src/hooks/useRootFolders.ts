import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { type RootFolder } from '../types';

export const useRootFolders = () => {
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载根文件夹列表
  const loadRootFolders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const folders = await invoke<RootFolder[]>('get_root_folders');
      setRootFolders(folders);
    } catch (error) {
      console.error('加载根文件夹失败:', error);
      setError('加载根文件夹失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 添加根文件夹
  const addRootFolder = async (path: string, name: string): Promise<string> => {
    try {
      setError(null);
      const folderId = await invoke<string>('add_root_folder', { path, name });
      // 不重新加载整个列表，而是直接添加到当前状态
      // 这样可以避免不必要的加载状态
      setRootFolders(prev => [...prev, { id: folderId, path, name, enabled: true, max_depth: 0, last_scan: null }]);
      return folderId;
    } catch (error) {
      console.error('添加根文件夹失败:', error);
      throw new Error(`添加根文件夹失败: ${error}`);
    }
  };

  // 删除根文件夹
  const removeRootFolder = async (folderId: string) => {
    try {
      await invoke('remove_root_folder', { id: folderId });
      // 不重新加载整个列表，而是直接从当前状态中移除
      // 这样可以避免不必要的加载状态
      setRootFolders(prev => prev.filter(folder => folder.id !== folderId));
    } catch (error) {
      console.error('删除根文件夹失败:', error);
      throw new Error(`删除根文件夹失败: ${error}`);
    }
  };

  // 检查路径是否已存在
  const isPathExists = (path: string): boolean => {
    return rootFolders.some(folder => {
      const normalizePath = (p: string) => p.replace(/[\\/]+$/, '').replace(/\\/g, '/');
      const normalizedNewPath = normalizePath(path);
      const normalizedExistingPath = normalizePath(folder.path);
      return normalizedNewPath === normalizedExistingPath;
    });
  };

  // 根据ID查找文件夹
  const findFolderById = (id: string): RootFolder | undefined => {
    return rootFolders.find(folder => folder.id === id);
  };

  useEffect(() => {
    loadRootFolders();
  }, []);

  return {
    rootFolders,
    isLoading,
    error,
    loadRootFolders,
    addRootFolder,
    removeRootFolder,
    isPathExists,
    findFolderById,
  };
};
