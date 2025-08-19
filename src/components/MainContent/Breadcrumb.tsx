import React from 'react';
import { type DirectoryNode } from '../../types';
import './MainContent.css';

interface BreadcrumbProps {
  selectedFolder: string | null;
  rootFolderName: string;
  breadcrumb: DirectoryNode[];
  onGoToRoot: () => void;
  onNavigateToBreadcrumb: (index: number) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  selectedFolder,
  rootFolderName,
  breadcrumb,
  onGoToRoot,
  onNavigateToBreadcrumb,
}) => {
  return (
    <nav className="breadcrumb" aria-label="面包屑导航">
      <button
        className="breadcrumb-item home"
        onClick={onGoToRoot}
        title="返回根目录"
        aria-label="返回根目录"
      >
        <span className="breadcrumb-text">
          {selectedFolder ? rootFolderName : '根目录'}
        </span>
      </button>
      {breadcrumb.map((item, index) => (
        <React.Fragment key={item.path}>
          <span className="breadcrumb-separator" aria-hidden="true">/</span>
          <button
            className="breadcrumb-item"
            onClick={() => onNavigateToBreadcrumb(index)}
            title={`进入 ${item.name}`}
            aria-label={`进入 ${item.name} 文件夹`}
          >
            <span className="breadcrumb-text">{item.name}</span>
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};
