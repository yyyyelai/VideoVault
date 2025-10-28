import React from 'react';
import { Play, Eye, Loader2 } from 'lucide-react';
import { ShimmerButton } from '../magicui/shimmer-button';
import { type VideoInfo } from '../../types';
import { formatFileSize, formatDuration } from '../../utils/formatters';
import './VideoDisplay.css';

interface VideoCardProps {
  video: VideoInfo;
  coverPath: string;
  viewMode: 'grid' | 'list';
  onPlay: (videoPath: string) => void;
  onPreview: (video: VideoInfo) => void;
  isLoadingMetadata?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  coverPath,
  viewMode,
  onPlay,
  onPreview,
  isLoadingMetadata = false,
}) => {
  // 从metadata字段获取视频元数据
  const metadata = video.metadata;
  const hasMetadata = metadata !== null && metadata !== undefined;

  if (viewMode === 'grid') {
    return (
      <div className="video-card">
        <div className="video-cover">
          <img
            src={coverPath}
            alt={video.name}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              console.log(`❌ 封面加载失败:`, coverPath, '，使用默认封面');
              target.src = '/placeholder-cover.jpg';
            }}
          />
          <div className="video-overlay">
            <div className="video-actions">
              <ShimmerButton
                onClick={() => onPlay(video.path)}
                className="h-10 px-4"
                shimmerColor="#fbbf24"
                background="rgba(0, 0, 0, 0.8)"
              >
                <Play size={20} />
                播放
              </ShimmerButton>
              <ShimmerButton
                onClick={() => onPreview(video)}
                className="h-10 px-4"
                shimmerColor="#ffffff"
                background="rgba(255, 255, 255, 0.15)"
                borderRadius="100px"
              >
                <Eye size={20} />
                预览
              </ShimmerButton>
            </div>
          </div>
        </div>

        <div className="video-info">
          <h4 className="video-title" title={video.name}>
            {video.name.split('.')[0]}
          </h4>
          <div className="video-meta">
            <span className="video-size">{formatFileSize(video.size)}</span>
            {hasMetadata && metadata.resolution && (
              <span className="video-resolution">{metadata.resolution[0]}x{metadata.resolution[1]}</span>
            )}
            {hasMetadata && metadata.duration && (
              <span className="video-duration" title={`${metadata.duration.secs}秒 ${metadata.duration.nanos}纳秒`}>
                {formatDuration(metadata.duration)}
              </span>
            )}
            {video.container_format && (
              <span className="video-container-format">{video.container_format}</span>
            )}
            {video?.modified_time?.secs_since_epoch && (
              <span className="video-size">
                {new Date(video.modified_time.secs_since_epoch * 1000).toLocaleString()}
              </span>
            )}
            {!hasMetadata && isLoadingMetadata && (
              <span className="video-loading">
                <Loader2 size={12} className="animate-spin" />
                加载中...
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 列表模式
  return (
    <div className="video-card list-mode">
      <div
        className="folder-node clickable"
        onClick={() => onPlay(video.path)}
        title={`播放 ${video.name}`}
      >
        <div className="folder-info">
          <div className="folder-icon-name">
            <div className="video-icon">🎬</div>
            <div className="folder-name">{video.name.split('.')[0]}</div>
          </div>
          <div className="folder-stats">
            <span className="folder-video-count">{formatFileSize(video.size)}</span>
            {hasMetadata && metadata.resolution && (
              <span className="folder-cover-count">{metadata.resolution[0]}x{metadata.resolution[1]}</span>
            )}
            {hasMetadata && metadata.duration && (
              <span className="folder-cover-count" title={`${metadata.duration.secs}秒 ${metadata.duration.nanos}纳秒`}>
                {formatDuration(metadata.duration)}
              </span>
            )}
            {video.container_format && (
              <span className="folder-cover-count">{video.container_format}</span>
            )}
            {/* 最新修改时间, 格式化成YYYY-MM-DD HH:MM:SS */}
            {video?.modified_time?.secs_since_epoch && (
              <span className="folder-cover-count">
                {new Date(video.modified_time.secs_since_epoch * 1000).toLocaleString()}
              </span>
            )}
            {!hasMetadata && isLoadingMetadata && (
              <span className="folder-cover-count">
                <Loader2 size={12} className="animate-spin" />
                加载中...
              </span>
            )}
          </div>
        </div>
        <div className="folder-arrow">
          <div className="video-actions-list">
            <button
              className="action-btn preview-btn"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(video);
              }}
              title="预览视频"
            >
              <Eye size={16} />
            </button>
            <button
              className="action-btn play-btn"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(video.path);
              }}
              title="播放视频"
            >
              <Play size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
