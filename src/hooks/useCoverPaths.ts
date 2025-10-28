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
      console.debug('[useCoverPaths] 跳过重复加载封面', { path: directory.path });
      return;
    }

    console.debug('[useCoverPaths] 开始加载封面', { 
      from: lastDirectoryPath, 
      to: directory.path,
      videoCount: directory.videos.length,
      hasCoverPath: !!directory.cover_path
    });

    const newCoverPaths = new Map<string, string>();

    // 优先使用扫描时返回的封面图信息
    if (directory.cover_path) {
      try {
        // 使用新的 read_image_as_base64 命令获取图片数据
        const imageData = await invoke<string>('read_image_as_base64', { imagePath: directory.cover_path });
        // 为当前目录下的所有视频设置相同的封面
        for (const video of directory.videos) {
          newCoverPaths.set(video.path, imageData);
        }
        console.debug('[useCoverPaths] 使用扫描时的封面图', { 
          path: directory.path, 
          coverPath: directory.cover_path,
          videoCount: directory.videos.length 
        });
      } catch (imageError) {
        console.log(`❌ 读取扫描时的封面图失败:`, imageError);
        // 回退到查找封面
        await loadCoversBySearching(directory, newCoverPaths);
      }
    } else {
      // 如果没有扫描时的封面图，回退到查找封面
      await loadCoversBySearching(directory, newCoverPaths);
    }

    console.debug('[useCoverPaths] 准备设置封面状态', {
      path: directory.path,
      coverCount: newCoverPaths.size,
      videosWithMetadata: directory.videos.filter(v => v.metadata).length
    });

    setCoverPaths(newCoverPaths);
    setLastDirectoryPath(directory.path);
    
    console.debug('[useCoverPaths] 封面加载完成', { 
      path: directory.path, 
      coverCount: newCoverPaths.size 
    });
  }, [lastDirectoryPath]);

  // 通过查找获取封面（回退方案）
  const loadCoversBySearching = async (directory: DirectoryNode, newCoverPaths: Map<string, string>) => {
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
  };

  // 递归查找文件夹的封面（回退方案）
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

  // 加载文件夹封面路径
  const loadFolderCoverPaths = useCallback(async (directory: DirectoryNode) => {
    // 避免重复加载相同目录的文件夹封面
    if (lastDirectoryPath === directory.path) {
      return;
    }

    const newFolderCoverPaths = new Map<string, string>();

    // 优先使用扫描时返回的封面图信息
    for (const child of directory.children) {
      if (child.cover_path) {
        try {
          const imageData = await invoke<string>('read_image_as_base64', { imagePath: child.cover_path });
          newFolderCoverPaths.set(child.path, imageData);
          console.debug('[useCoverPaths] 使用扫描时的文件夹封面', { 
            folderPath: child.path, 
            coverPath: child.cover_path 
          });
        } catch (imageError) {
          console.log(`❌ 读取文件夹封面图片失败:`, imageError);
          // 回退到查找封面
          const coverPath = await findFolderCover(child);
          if (coverPath) {
            newFolderCoverPaths.set(child.path, coverPath);
          }
        }
      } else {
        // 如果没有扫描时的封面图，回退到查找封面
        const coverPath = await findFolderCover(child);
        if (coverPath) {
          newFolderCoverPaths.set(child.path, coverPath);
        }
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
