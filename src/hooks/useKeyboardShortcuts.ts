import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface KeyboardShortcutOptions {
  onSave?: () => void;
  onClose?: () => void;
}

export const useKeyboardShortcuts = ({ onSave, onClose }: KeyboardShortcutOptions = {}) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+N: New quote
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        navigate('/quotes/new');
      }

      // Ctrl+S: Save quote
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (onSave) {
          onSave();
        }
      }

      // Escape: Close quote
      if (e.key === 'Escape') {
        if (onClose) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, onSave, onClose]);
};
