import React from 'react';
import { Play, Eye, Image } from 'lucide-react';
import { type VideoInfo } from '../../types';
import { formatFileSize, formatDuration } from '../../utils/formatters';
import { Lens } from '../magicui/lens';
import './VideoDisplay.css';

interface VideoCardProps {
  video: VideoInfo;
  coverPath: string;
  viewMode: 'grid' | 'list';
  currentFolderPath?: string;
  onPlay: (videoPath: string) => void;
  onPreview: (video: VideoInfo) => void;
  onSetAsCover?: (videoPath: string, folderPath: string) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  coverPath,
  viewMode,
  currentFolderPath,
  onPlay,
  onPreview,
  onSetAsCover,
}) => {
  if (viewMode === 'grid') {
    return (
      <div className="video-card">
        <div className="video-cover">
          <Lens zoomFactor={2} lensSize={150}>
            <img
              src={coverPath}
              alt={video.name}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.log(`❌ 封面加载失败:`, coverPath, '，使用默认封面');
                target.src = '/placeholder-cover.jpg';
              }}
            />
          </Lens>
          <div className="video-button-group">
            <button
              className="video-action-btn play-action-btn"
              onClick={() => onPlay(video.path)}
              title="播放视频"
            >
              <Play size={16} />
              <span>播放</span>
            </button>
            <button
              className="video-action-btn preview-action-btn"
              onClick={() => onPreview(video)}
              title="预览视频"
            >
              <Eye size={16} />
              <span>预览</span>
            </button>
            {onSetAsCover && currentFolderPath && (
              <button
                className="video-action-btn set-cover-action-btn"
                onClick={() => onSetAsCover(video.path, currentFolderPath)}
                title="将此视频的封面设为文件夹封面"
              >
                <Image size={16} />
                <span>设为封面</span>
              </button>
            )}
          </div>
        </div>

        <div className="video-info">
          <h4 className="video-title" title={video.name}>
            {video.name.split('.')[0]}
          </h4>
          <div className="video-meta">
            <span className="video-size">{formatFileSize(video.size)}</span>
            {video.resolution && (
              <span className="video-resolution">{video.resolution[0]}x{video.resolution[1]}</span>
            )}
            {video.duration && (
              <span className="video-duration" title={`${video.duration.secs}秒 ${video.duration.nanos}纳秒`}>
                {formatDuration(video.duration)}
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
            {video.resolution && (
              <span className="folder-cover-count">{video.resolution[0]}x{video.resolution[1]}</span>
            )}
            {video.duration && (
              <span className="folder-cover-count" title={`${video.duration.secs}秒 ${video.duration.nanos}纳秒`}>
                {formatDuration(video.duration)}
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
