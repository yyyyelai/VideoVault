import { type Duration } from '../types';

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化时长
export const formatDuration = (duration: Duration | null): string => {
  if (!duration) return 'N/A';
  const secs = duration.secs;
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const secsPart = Math.floor(secs % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secsPart.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secsPart.toString().padStart(2, '0')}`;
  }
};

// 标准化路径（移除末尾斜杠，统一斜杠格式）
export const normalizePath = (path: string): string => {
  return path.replace(/[\\/]+$/, '').replace(/\\/g, '/');
};

// 从路径中提取文件夹名称
export const extractFolderName = (path: string): string => {
  return path.split('/').pop() || path.split('\\').pop() || '未命名文件夹';
};
