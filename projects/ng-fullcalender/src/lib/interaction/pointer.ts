export interface PointerTrackHandlers {
  /** Called on every move once the pointer passed the threshold. */
  move(e: PointerEvent): void;
  /** `dragged` is false when the pointer never passed the threshold (a click). */
  end(e: PointerEvent, dragged: boolean): void;
  /** Escape pressed or pointer cancelled. */
  cancel(): void;
}

/**
 * Tracks one pointer gesture from `pointerdown` to `pointerup` using window
 * listeners. Returns a disposer. Escape cancels the gesture.
 */
export function trackPointer(down: PointerEvent, h: PointerTrackHandlers, threshold = 4): () => void {
  const x0 = down.clientX;
  const y0 = down.clientY;
  let dragged = false;
  let done = false;

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== down.pointerId) return;
    if (!dragged && Math.hypot(e.clientX - x0, e.clientY - y0) < threshold) return;
    if (!dragged) document.documentElement.classList.add('sch-dragging');
    dragged = true;
    e.preventDefault();
    h.move(e);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== down.pointerId) return;
    dispose();
    h.end(e, dragged);
  };
  const onCancel = () => {
    dispose();
    h.cancel();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  function dispose() {
    if (done) return;
    done = true;
    document.documentElement.classList.remove('sch-dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
  }

  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, true);
  return dispose;
}

/** Closest ancestor (of the element under the pointer) carrying `attr`. */
export function elementAtPoint(x: number, y: number, attr: string): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  return (el?.closest(`[${attr}]`) as HTMLElement | null) ?? null;
}
