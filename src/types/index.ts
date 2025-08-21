// 根文件夹接口
export interface RootFolder {
  id: string;
  path: string;
  name: string;
  enabled: boolean;
  max_depth: number;
  last_scan: string | null;
}

// 视频信息接口
export interface VideoInfo {
  path: string;
  name: string;
  size: number;
  duration: Duration | null;
  resolution: [number, number] | null;
  codec: string | null;
  audio_codec: string | null;
  created_time: string | null;
  modified_time: {
    secs_since_epoch: number;
    nanos_since_epoch: number;
  } | null;
  container_format?: string | null;
  frame_rate?: number | null;
  bit_rate?: number | null;
}

// 时长接口
export interface Duration {
  secs: number;
  nanos: number;
}

// 目录节点接口
export interface DirectoryNode {
  name: string;
  path: string;
  is_directory: boolean;
  children: DirectoryNode[];
  videos: VideoInfo[];
  cover_count: number;
  video_count: number;
  cover_path?: string;
  modified_time: {
    secs_since_epoch: number;
    nanos_since_epoch: number;
  } | null;
}

// 视图模式类型
export type ViewMode = 'grid' | 'list';

// 历史记录项（对象化）
export interface FolderHistoryItem {
  path: string;
  rootId?: string;
  volumeKey?: string;
  addedAt: number;
}
