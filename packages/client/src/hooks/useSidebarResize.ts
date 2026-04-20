import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  SIDEBAR_WIDTH_MAX_PX,
  SIDEBAR_WIDTH_MIN_PX,
  useUiStore,
} from '../store/uiStore';

/**
 * Drag the right edge of the sidebar to resize; commits width to ui store on release.
 */
export function useSidebarResize() {
  const committed = useUiStore((s) => s.sidebarWidthPx);
  const setCommitted = useUiStore((s) => s.setSidebarWidthPx);
  const [preview, setPreview] = useState<number | null>(null);
  const previewRef = useRef<number | null>(null);

  const widthPx = preview ?? committed;

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = committed;

      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.min(
          SIDEBAR_WIDTH_MAX_PX,
          Math.max(SIDEBAR_WIDTH_MIN_PX, Math.round(startW + delta)),
        );
        previewRef.current = next;
        setPreview(next);
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
        const w = previewRef.current;
        previewRef.current = null;
        setPreview(null);
        if (w != null) setCommitted(w);
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    },
    [committed, setCommitted],
  );

  return { widthPx, onResizePointerDown };
}
