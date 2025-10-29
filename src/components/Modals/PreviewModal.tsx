import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './Modals.css';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  title: string;
  currentIndex: number;
  totalCount: number;
  onPrevious?: () => void;
  onNext?: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  title,
  currentIndex,
  totalCount,
  onPrevious,
  onNext,
}) => {
  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onPrevious, onNext]);

  if (!isOpen) return null;

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < totalCount - 1;

  return (
    <div className="modal-overlay preview-overlay" onClick={onClose}>
      <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header" onClick={(e) => e.stopPropagation()}>
          <h3 className="preview-title">{title}</h3>
          <div className="preview-counter">
            {currentIndex + 1} / {totalCount}
          </div>
          <button
            className="preview-close"
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>
        <div className="preview-image-wrapper" onClick={onClose}>
          {/* 左箭头 */}
          {hasPrevious && onPrevious && (
            <button
              className="preview-nav-btn preview-nav-left"
              onClick={(e) => {
                e.stopPropagation();
                onPrevious();
              }}
              title="上一个 (←)"
            >
              <ChevronLeft size={32} />
            </button>
          )}
          
          <img
            src={imageSrc}
            alt={title}
            className="preview-image"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder-cover.jpg';
            }}
          />
          
          {/* 右箭头 */}
          {hasNext && onNext && (
            <button
              className="preview-nav-btn preview-nav-right"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              title="下一个 (→)"
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
