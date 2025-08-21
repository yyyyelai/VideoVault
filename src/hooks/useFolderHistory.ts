import { useState, useEffect } from 'react';
import type { FolderHistoryItem } from '../types';
import { normalizePath } from '../utils/formatters';

export const useFolderHistory = () => {
  const [folderHistory, setFolderHistory] = useState<FolderHistoryItem[]>([]);

  // 加载历史记录
  const loadFolderHistory = () => {
    try {
      const saved = localStorage.getItem('folderHistory');
      if (saved) {
        const parsed = JSON.parse(saved);
        let items: FolderHistoryItem[] = [];
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && typeof parsed[0] === 'string') {
            // 兼容旧格式：string[]
            items = (parsed as string[]).map((p) => ({ path: p, addedAt: Date.now() }));
          } else {
            items = parsed as FolderHistoryItem[];
          }
        }
        setFolderHistory(items);
      } else {
        setFolderHistory([]);
      }
    } catch (error) {
      console.error('❌ 加载历史记录失败:', error);
      setFolderHistory([]);
    }
  };

  // 保存历史记录
  const saveFolderHistory = (item: FolderHistoryItem | string) => {
    try {
      // 从localStorage读取最新的历史记录
      const saved = localStorage.getItem('folderHistory');
      let currentHistory = folderHistory;

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && typeof parsed[0] === 'string') {
              currentHistory = (parsed as string[]).map((p) => ({ path: p, addedAt: Date.now() }));
            } else {
              currentHistory = parsed as FolderHistoryItem[];
            }
          }
        } catch (e) {
          console.error('解析历史记录失败:', e);
        }
      }
      const incomingRaw: FolderHistoryItem = typeof item === 'string' ? { path: item, addedAt: Date.now() } : item;
      const incoming: FolderHistoryItem = { ...incomingRaw, path: normalizePath(incomingRaw.path) };

      // 去重：按标准化路径去重
      const filteredHistory = currentHistory.filter(h => normalizePath(h.path) !== incoming.path);

      // 添加到开头（最新的在前面）
      const newHistory: FolderHistoryItem[] = [incoming, ...filteredHistory];

      // 限制最多保存3条记录
      const limitedHistory = newHistory.slice(0, 3);

      // 保存到本地存储
      localStorage.setItem('folderHistory', JSON.stringify(limitedHistory));
      setFolderHistory(limitedHistory);
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }
  };

  // 清理历史记录中可能存在的无效路径
  const cleanupInvalidHistory = (validPaths: string[]) => {
    // 简单的路径比较（移除末尾斜杠）
    const validPathsSet = new Set(validPaths.map(p => normalizePath(p)));

    const newHistory = folderHistory.filter(item => validPathsSet.has(normalizePath(item.path)));

    if (newHistory.length !== folderHistory.length) {
      localStorage.setItem('folderHistory', JSON.stringify(newHistory));
      setFolderHistory(newHistory);
    } else {
      console.log('✅ 无需清理，所有历史记录都有效');
    }
  };

  // 清除所有历史记录
  const clearAllHistory = () => {
    setFolderHistory([]);
    localStorage.removeItem('folderHistory');
  };

  useEffect(() => {
    loadFolderHistory();
  }, []);

  return {
    folderHistory,
    saveFolderHistory,
    cleanupInvalidHistory,
    clearAllHistory,
  };
};
