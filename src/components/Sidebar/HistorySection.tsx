import React from 'react';
import { RefreshCw, X, FolderOpen } from 'lucide-react';
import { extractFolderName } from '../../utils/formatters';
import type { FolderHistoryItem } from '../../types';
import './Sidebar.css';

interface HistorySectionProps {
  folderHistory: FolderHistoryItem[];
  onSelectFromHistory: (item: FolderHistoryItem) => void;
  onCleanupInvalidHistory: () => void;
  onClearAllHistory: () => void;
  onShowInfoMessage: (content: string) => void;
  onHideInfoMessage: () => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  folderHistory,
  onSelectFromHistory,
  onCleanupInvalidHistory,
  onClearAllHistory,
  onShowInfoMessage,
  onHideInfoMessage,
}) => {
  return (
    <div className="history-section">
      <div className="section-header">
        <h3 className="section-title">最近添加</h3>
        {folderHistory.length > 0 && (
          <div className="history-controls">
            <button
              className="cleanup-history-btn"
              onClick={onCleanupInvalidHistory}
              title="清理无效路径"
            >
              <RefreshCw size={14} />
            </button>
            <button
              className="clear-history-btn"
              onClick={onClearAllHistory}
              title="清除所有历史记录"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      {folderHistory.length > 0 ? (
        <div className="history-list">
          {folderHistory.map((item, index) => {
            const folderName = extractFolderName(item.path);
            return (
              <div
                key={`${item.path}-${index}`}
                className="history-item"
                onClick={() => onSelectFromHistory(item)}
                title={`点击选择: ${item.path}`}
                onMouseEnter={() => onShowInfoMessage(item.path)}
                onMouseLeave={() => onHideInfoMessage()}
              >
                <div className="history-content">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="history-name">{folderName}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="history-empty">
          <p>暂无历史记录</p>
          <p className="history-hint">添加文件夹后会自动保存</p>
        </div>
      )}
    </div>
  );
};
