import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

// One-shot, native scroll reveal. No scroll handler, animation library or layout loop.
export function Reveal({
  children,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches || !("IntersectionObserver" in window)) {
      element.dataset.reveal = "visible";
      return;
    }
    const bounds = element.getBoundingClientRect();
    if (bounds.top < innerHeight && bounds.bottom > 0) {
      element.dataset.reveal = "visible";
      return;
    }
    element.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.dataset.reveal = "visible";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px 40px 0px", threshold: 0.01 },
    );
    observer.observe(element);
    const respectPreference = () => {
      if (reduced.matches) {
        element.dataset.reveal = "visible";
        observer.disconnect();
      }
    };
    reduced.addEventListener("change", respectPreference);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", respectPreference);
    };
  }, []);
  return (
    <section ref={ref} {...props}>
      {children}
    </section>
  );
}
