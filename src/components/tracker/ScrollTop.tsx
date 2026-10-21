import { useEffect, useRef, useState } from "react";

/** Floating "back to top" button, appears after scrolling past the first screens. */
export function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return; // throttle: at most one scroll-state update per frame
      raf = requestAnimationFrame(() => {
        raf = 0;
        setShow(window.scrollY > 600);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Cuộn lên đầu trang"
      className="glass glass-glow fixed bottom-5 right-5 z-40 grid size-11 place-items-center rounded-full text-lg"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      ⬆️
    </button>
  );
}
