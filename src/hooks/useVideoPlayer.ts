import { invoke } from '@tauri-apps/api/core';

export const useVideoPlayer = () => {
  // 播放视频
  const playVideo = async (videoPath: string) => {
    try {
      // 使用系统默认播放器打开视频
      await invoke('open_video', { path: videoPath });
    } catch (error) {
      console.error('播放视频失败:', error);
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
        throw new Error('无法打开视频文件');
      }
    }
  };

  // 打开文件夹
  const openFolder = async (folderPath: string) => {
    try {
      await invoke('open_folder', { path: folderPath });
    } catch (error) {
      console.error('打开文件夹失败:', error);
      throw new Error('无法打开文件夹');
    }
  };

  return {
    playVideo,
    openFolder,
  };
};
