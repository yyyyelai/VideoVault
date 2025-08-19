import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { RainbowButton } from '../magicui/rainbow-button';
import { open } from '@tauri-apps/plugin-dialog';
import { extractFolderName } from '../../utils/formatters';
import './Modals.css';

interface AddFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFolder: (path: string, name: string) => Promise<void>;
  error: string | null;
  isAdding: boolean;
  initialPath?: string; // 添加初始路径参数
}

export const AddFolderModal: React.FC<AddFolderModalProps> = ({
  isOpen,
  onClose,
  onAddFolder,
  error,
  isAdding,
  initialPath,
}) => {
  const [newFolderPath, setNewFolderPath] = useState('');
  const [newFolderName, setNewFolderName] = useState('');

  // 当初始路径变化时，自动填充路径和名称
  useEffect(() => {
    if (initialPath) {
      setNewFolderPath(initialPath);
      const folderName = extractFolderName(initialPath);
      setNewFolderName(folderName);
    }
  }, [initialPath]);

  // 选择文件夹
  const selectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected) {
        setNewFolderPath(selected);
        // 如果没有输入名称，使用文件夹名作为默认名称
        if (!newFolderName) {
          const folderName = extractFolderName(selected);
          setNewFolderName(folderName);
        }
      }
    } catch (error) {
      console.error('选择文件夹失败:', error);
    }
  };

  // 添加文件夹
  const handleAddFolder = async () => {
    if (!newFolderPath.trim() || !newFolderName.trim()) {
      return;
    }

    try {
      await onAddFolder(newFolderPath, newFolderName);
      // 成功后重置表单
      setNewFolderPath('');
      setNewFolderName('');
    } catch (error) {
      // 错误处理由父组件负责
    }
  };

  // 关闭弹窗时重置表单
  const handleClose = () => {
    setNewFolderPath('');
    setNewFolderName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-lg font-semibold">添加根文件夹</h3>
          <button
            className="modal-close"
            onClick={handleClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="folderPath">文件夹路径:</label>
            <div className="path-input-group">
              <input
                id="folderPath"
                type="text"
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                placeholder="选择文件夹路径"
                readOnly
              />
              <RainbowButton
                onClick={selectFolder}
                className="h-10 px-4"
                variant="outline"
              >
                选择
              </RainbowButton>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="folderName">文件夹名称:</label>
            <input
              id="folderName"
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="输入文件夹名称"
            />
          </div>
        </div>

        <div className="modal-footer">
          <RainbowButton
            variant="outline"
            onClick={handleClose}
          >
            取消
          </RainbowButton>
          <RainbowButton
            onClick={handleAddFolder}
            disabled={isAdding || !newFolderPath || !newFolderName}
          >
            {isAdding ? '添加中...' : '添加'}
          </RainbowButton>
        </div>
      </div>
    </div>
  );
};
