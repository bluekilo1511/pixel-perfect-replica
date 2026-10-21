import { useEffect, useState } from "react";

/** Floating "back to top" button, appears after scrolling past the first screens. */
export function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
