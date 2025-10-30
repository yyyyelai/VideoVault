import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const CUSTOM_COVERS_KEY = 'video_vault_custom_folder_covers';

interface CustomFolderCovers {
  [folderPath: string]: string; // folderPath -> coverImagePath
}

export const useCustomFolderCovers = () => {
  const [customCovers, setCustomCovers] = useState<CustomFolderCovers>({});

  // 从localStorage加载自定义封面
  useEffect(() => {
    const loadCustomCovers = () => {
      try {
        const stored = localStorage.getItem(CUSTOM_COVERS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setCustomCovers(parsed);
        }
      } catch (error) {
        console.error('加载自定义封面失败:', error);
      }
    };

    loadCustomCovers();
  }, []);


  // 获取文件夹的自定义封面（验证后）
  // 直接从 localStorage 读取，而不是从 state 读取，避免多个 hook 实例的 state 不同步问题
  const getCustomCover = useCallback(async (folderPath: string): Promise<string | null> => {
    try {
      const stored = localStorage.getItem(CUSTOM_COVERS_KEY);
      if (!stored) {
        return null;
      }
      
      const allCovers = JSON.parse(stored);
      const coverPath = allCovers[folderPath];
      
      if (!coverPath) {
        return null;
      }

      // 验证文件是否存在
      try {
        const exists = await invoke<boolean>('check_file_exists', { path: coverPath });
        if (exists) {
          return coverPath;
        } else {
          // 文件不存在，清理这个记录（不在这里调用 removeCustomCover，避免循环依赖）
          const updated = { ...allCovers };
          delete updated[folderPath];
          localStorage.setItem(CUSTOM_COVERS_KEY, JSON.stringify(updated));
          return null;
        }
      } catch (error) {
        console.error('验证封面路径失败:', error);
        return coverPath; // 验证失败时仍然返回路径，让用户决定
      }
    } catch (error) {
      console.error('读取自定义封面失败:', error);
      return null;
    }
  }, []);

  // 设置文件夹的自定义封面
  const setCustomCover = useCallback((folderPath: string, coverPath: string) => {
    setCustomCovers((prev) => {
      const updated = { ...prev, [folderPath]: coverPath };
      // 保存到localStorage
      try {
        localStorage.setItem(CUSTOM_COVERS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('保存自定义封面失败:', error);
      }
      return updated;
    });
  }, []);

  // 移除文件夹的自定义封面
  const removeCustomCover = useCallback((folderPath: string) => {
    setCustomCovers((prev) => {
      const updated = { ...prev };
      delete updated[folderPath];
      // 保存到localStorage
      try {
        localStorage.setItem(CUSTOM_COVERS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('保存自定义封面失败:', error);
      }
      return updated;
    });
  }, []);

  // 检查文件夹是否有自定义封面
  const hasCustomCover = useCallback((folderPath: string): boolean => {
    return !!customCovers[folderPath];
  }, [customCovers]);

  return {
    customCovers,
    getCustomCover,
    setCustomCover,
    removeCustomCover,
    hasCustomCover,
  };
};

