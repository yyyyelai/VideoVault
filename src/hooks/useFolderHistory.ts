import { useState, useEffect } from 'react';

export const useFolderHistory = () => {
  const [folderHistory, setFolderHistory] = useState<string[]>([]);

  // 加载历史记录
  const loadFolderHistory = () => {
    try {
      const saved = localStorage.getItem('folderHistory');
      if (saved) {
        const history = JSON.parse(saved);
        const validHistory = Array.isArray(history) ? history : [];
        setFolderHistory(validHistory);
      } else {
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
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }
  };

  // 清理历史记录中可能存在的无效路径
  const cleanupInvalidHistory = (validPaths: string[]) => {
    // 简单的路径比较（移除末尾斜杠）
    const normalizePath = (p: string) => p.replace(/[\\/]+$/, '');
    const validPathsSet = new Set(validPaths.map(p => normalizePath(p)));

    const newHistory = folderHistory.filter(path => {
      const normalizedHistoryPath = normalizePath(path);
      return validPathsSet.has(normalizedHistoryPath);
    });

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
