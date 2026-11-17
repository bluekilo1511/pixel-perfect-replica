import { useCallback, useRef, useState } from "react";

export interface PetHoldTriggerOptions {
  onHoldComplete: () => void;
  onClick?: () => void;
  holdDurationMs?: number;
}

export function usePetHoldTrigger({
  onHoldComplete,
  onClick,
  holdDurationMs = 3000,
}: PetHoldTriggerOptions) {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 1
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false);

  const clearHold = useCallback(() => {
    if (timerRef.current !== null) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(
    (e: React.SyntheticEvent) => {
      // Don't start on right clicks
      if ("button" in e && (e as React.MouseEvent).button !== 0) return;

      completedRef.current = false;
      startTimeRef.current = Date.now();
      setIsHolding(true);
      setHoldProgress(0);

      const loop = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(1, elapsed / holdDurationMs);
        setHoldProgress(progress);

        if (progress >= 1) {
          completedRef.current = true;
          clearHold();
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([40, 60, 80]);
            } catch {
              // ignore
            }
          }
          onHoldComplete();
          return;
        }

        timerRef.current = requestAnimationFrame(loop);
      };

      timerRef.current = requestAnimationFrame(loop);
    },
    [holdDurationMs, onHoldComplete, clearHold],
  );

  const endHold = useCallback(
    (e: React.SyntheticEvent) => {
      if (completedRef.current) {
        clearHold();
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      clearHold();

      // If released before threshold, trigger normal click
      if (elapsed < holdDurationMs) {
        onClick?.();
      }
    },
    [clearHold, holdDurationMs, onClick],
  );

  const cancelHold = useCallback(() => {
    clearHold();
  }, [clearHold]);

  return {
    isHolding,
    holdProgress,
    handlers: {
      onMouseDown: startHold,
      onMouseUp: endHold,
      onMouseLeave: cancelHold,
      onTouchStart: startHold,
      onTouchEnd: endHold,
      onTouchCancel: cancelHold,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
