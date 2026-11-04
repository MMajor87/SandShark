import type { NodeViewProps } from '@tiptap/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';

type TCommandChipControl = HTMLInputElement | HTMLSelectElement;

type TUseCommandChipOptions = Pick<
  NodeViewProps,
  'node' | 'editor' | 'getPos'
> & {
  onSubmit?: () => void;
};

// the keyboard behaviour every command chip shares: tab and enter move between its fields,
// enter on the last one sends, and the first field is focused when the chip is inserted
export const useCommandChip = ({
  node,
  editor,
  getPos,
  onSubmit
}: TUseCommandChipOptions) => {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  const focusEditorAfterNode = useCallback(() => {
    const pos = typeof getPos === 'function' ? getPos() : null;

    if (typeof pos === 'number') {
      editor
        .chain()
        .setTextSelection(pos + node.nodeSize)
        .focus()
        .run();
      return;
    }

    editor.chain().focus().run();
  }, [editor, getPos, node.nodeSize]);

  const handleKeyNavigation = useCallback(
    (event: ReactKeyboardEvent<TCommandChipControl>) => {
      const isEnter =
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing;

      if (event.key !== 'Tab' && !isEnter) return false;

      const wrapper = wrapperRef.current;

      if (!wrapper) return false;

      const controls = Array.from(
        wrapper.querySelectorAll<TCommandChipControl>('input, select')
      );
      const currentIndex = controls.indexOf(event.currentTarget);

      if (currentIndex === -1) return false;

      event.preventDefault();

      const isLast = currentIndex === controls.length - 1;

      if (isEnter) {
        if (!isLast) {
          controls[currentIndex + 1]?.focus();

          return true;
        }

        if (onSubmit) {
          onSubmit();
        } else {
          focusEditorAfterNode();
        }

        return true;
      }

      if (event.shiftKey) {
        if (currentIndex > 0) {
          controls[currentIndex - 1]?.focus();
        } else {
          focusEditorAfterNode();
        }

        return true;
      }

      if (isLast) {
        focusEditorAfterNode();
      } else {
        controls[currentIndex + 1]?.focus();
      }

      return true;
    },
    [focusEditorAfterNode, onSubmit]
  );

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const firstControl =
        wrapperRef.current?.querySelector<TCommandChipControl>('input, select');

      if (!firstControl) return;

      firstControl.focus();

      if (firstControl instanceof HTMLInputElement) {
        firstControl.select();
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return { wrapperRef, handleKeyNavigation };
};
