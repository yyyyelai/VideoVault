import React from 'react';
import { HardDrive } from 'lucide-react';
import { type DirectoryNode } from '../../types';
import './FolderDisplay.css';

interface FolderNodeProps {
  folder: DirectoryNode;
  coverPath?: string;
  viewMode: 'grid' | 'list';
  onNavigate: (directory: DirectoryNode) => void;
}

export const FolderNode: React.FC<FolderNodeProps> = ({
  folder,
  coverPath,
  viewMode,
  onNavigate,
}) => {
  if (viewMode === 'grid') {
    return (
      <div className="directory-node">
        <div
          className="folder-node clickable"
          onClick={() => onNavigate(folder)}
          title={`进入 ${folder.name} 文件夹`}
        >
          {/* 文件夹封面 */}
          <div className="folder-cover">
            {coverPath ? (
              <img
                src={coverPath}
                alt={`${folder.name} 封面`}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder-cover.jpg';
                }}
              />
            ) : (
              <img
                src="/placeholder-cover.jpg"
                alt={`${folder.name} 封面`}
              />
            )}
          </div>

          {/* 文件夹信息区域 */}
          <div className="folder-info">
            <div className="folder-icon-name">
              <HardDrive className="w-4 h-4 text-primary" />
              <h4 className="folder-name">{folder.name}</h4>
            </div>
            {folder.videos.length ? <div className="folder-stats">
              <span className="folder-video-count">{folder.videos.length} 视频</span>
            </div> : null}
          </div>
        </div>
      </div>
    );
  }

  // 列表模式
  return (
    <div className="directory-node list-mode">
      <div
        className="folder-node clickable"
        onClick={() => onNavigate(folder)}
        title={`进入 ${folder.name} 文件夹`}
      >
        <div className="folder-info">
          <div className="folder-icon-name">
            <HardDrive className="w-4 h-4 text-primary" />
            <h4 className="folder-name">{folder.name}</h4>
          </div>
          <div className="folder-stats">
            {folder.videos.length ? <span className="folder-video-count">{folder.videos.length} 视频</span> : null}
            {folder.children.length > 0 && (
              <span className="folder-cover-count">{folder.children.length} 子文件夹</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
