import React from 'react';
import { X } from 'lucide-react';
import './Modals.css';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  title: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  title,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay preview-overlay" onClick={onClose}>
      <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3 className="preview-title">{title}</h3>
          <button
            className="preview-close"
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>
        <div className="preview-image-wrapper">
          <img
            src={imageSrc}
            alt={title}
            className="preview-image"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder-cover.jpg';
            }}
          />
        </div>
      </div>
    </div>
  );
};
