import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { type DirectoryNode } from '../types';

export const useCoverPaths = () => {
  const [coverPaths, setCoverPaths] = useState<Map<string, string>>(new Map());
  const [folderCoverPaths, setFolderCoverPaths] = useState<Map<string, string>>(new Map());
  const [lastDirectoryPath, setLastDirectoryPath] = useState<string>('');

  // 加载封面路径
  const loadCoverPaths = useCallback(async (directory: DirectoryNode) => {
    // 避免重复加载相同目录的封面
    if (lastDirectoryPath === directory.path) {
      return;
    }

    const newCoverPaths = new Map<string, string>();

    // 只加载当前目录的视频封面，不递归加载子目录
    for (const video of directory.videos) {
      try {
        const coverPath = await invoke<string>('find_cover_for_video', { videoPath: video.path });

        if (coverPath) {
          // 使用新的 read_image_as_base64 命令获取图片数据
          try {
            const imageData = await invoke<string>('read_image_as_base64', { imagePath: coverPath });
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
    setLastDirectoryPath(directory.path);
  }, [lastDirectoryPath]);

  // 加载文件夹封面路径
  const loadFolderCoverPaths = useCallback(async (directory: DirectoryNode) => {
    // 避免重复加载相同目录的文件夹封面
    if (lastDirectoryPath === directory.path) {
      return;
    }

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
    // 注意：这里不需要再次设置 lastDirectoryPath，因为 loadCoverPaths 已经设置了
  }, [lastDirectoryPath]);

  // 当目录更新时，重新加载封面
  const refreshCovers = useCallback(async (directory: DirectoryNode) => {
    await loadCoverPaths(directory);
    await loadFolderCoverPaths(directory);
  }, [loadCoverPaths, loadFolderCoverPaths]);

  // 清理所有封面状态
  const clearAllCovers = useCallback(() => {
    setCoverPaths(new Map());
    setFolderCoverPaths(new Map());
    setLastDirectoryPath('');
  }, []);

  return {
    coverPaths,
    folderCoverPaths,
    loadCoverPaths,
    loadFolderCoverPaths,
    refreshCovers,
    clearAllCovers,
  };
};
