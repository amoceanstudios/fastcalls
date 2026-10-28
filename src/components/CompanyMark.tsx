import type { Prospect } from "../lib/models";
export function CompanyMark({ p }: { p: Prospect }) {
  if (!p.logoDataUrl) return null;
  return (
    <span className="company-mark" aria-hidden="true">
      <img
        src={p.logoDataUrl}
        alt=""
        width="40"
        height="40"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
