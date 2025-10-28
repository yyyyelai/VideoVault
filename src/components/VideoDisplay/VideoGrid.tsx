import React from 'react';
import { VideoCard } from './VideoCard';
import { type VideoInfo } from '../../types';
import './VideoDisplay.css';

interface VideoGridProps {
  videos: VideoInfo[];
  coverPaths: Map<string, string>;
  viewMode: 'grid' | 'list';
  onPlay: (videoPath: string) => void;
  onPreview: (video: VideoInfo) => void;
  isLoadingMetadata?: boolean;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  coverPaths,
  viewMode,
  onPlay,
  onPreview,
  isLoadingMetadata = false,
}) => {
  if (videos.length === 0) {
    return null;
  }

  return (
    <div className={`folder-container ${viewMode}`}>
      {videos.map((video, index) => {
        const coverPath = coverPaths.get(video.path) || '/placeholder-cover.jpg';
        return (
          <VideoCard
            key={`${video.path}-${index}`}
            video={video}
            coverPath={coverPath}
            viewMode={viewMode}
            onPlay={onPlay}
            onPreview={onPreview}
            isLoadingMetadata={isLoadingMetadata}
          />
        );
      })}
    </div>
  );
};
