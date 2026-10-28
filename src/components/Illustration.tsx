import { useId } from "react";
export type IllustrationKind =
  "onboarding" | "empty" | "search" | "error" | "success";

/** Original decorative vectors. All meaningful labels remain real HTML text. */
export function Illustration({
  kind = "empty",
  compact = false,
}: {
  kind?: IllustrationKind;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  if (compact)
    return (
      <svg
        className="state-illustration"
        width="34"
        height="34"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="21" stroke="currentColor" opacity=".2" />
        <circle cx="24" cy="24" r="16" stroke="currentColor" opacity=".5" />
        {kind === "error" ? (
          <>
            <path
              d="M24 14v13m0 6v1"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="39" cy="12" r="3" fill="currentColor" />
          </>
        ) : (
          <>
            <path
              d="m15 24 6 6 12-13"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="39" cy="12" r="3" fill="currentColor" />
          </>
        )}
      </svg>
    );
  return (
    <svg
      className={`illustration illustration-${kind}`}
      width="320"
      height="190"
      viewBox="0 0 320 190"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`surface-${id}`}
          x1="92"
          y1="29"
          x2="225"
          y2="166"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--illustration-top)" />
          <stop offset="1" stopColor="var(--illustration-bottom)" />
        </linearGradient>
        <linearGradient
          id={`signal-${id}`}
          x1="83"
          y1="69"
          x2="242"
          y2="132"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity=".08" />
        </linearGradient>
      </defs>
      <ellipse
        cx="161"
        cy="105"
        rx="122"
        ry="61"
        stroke="var(--accent)"
        opacity=".12"
      />
      <ellipse
        cx="161"
        cy="105"
        rx="92"
        ry="44"
        stroke="var(--accent)"
        opacity=".17"
        strokeDasharray="3 7"
      />
      <path
        d="M44 105h17m198 0h17M161 23v12m0 127v12"
        stroke="var(--accent)"
        opacity=".35"
        strokeLinecap="round"
      />
      {kind === "onboarding" ? (
        <>
          <rect
            x="61"
            y="68"
            width="74"
            height="89"
            rx="14"
            fill="var(--panel)"
            stroke="var(--border)"
            transform="rotate(-10 61 68)"
          />
          <rect
            x="105"
            y="30"
            width="116"
            height="131"
            rx="18"
            fill={`url(#surface-${id})`}
            stroke="var(--illustration-edge)"
          />
          <path d="M105 61h116" stroke="var(--illustration-edge)" />
          <circle cx="121" cy="46" r="2" fill="var(--accent)" />
          <circle cx="130" cy="46" r="2" fill="var(--accent)" opacity=".4" />
          <circle cx="139" cy="46" r="2" fill="var(--accent)" opacity=".2" />
          <rect
            x="122"
            y="78"
            width="27"
            height="27"
            rx="8"
            fill="var(--accent)"
            fillOpacity=".13"
          />
          <path
            d="M131 93h10m-5-5v10"
            stroke="var(--accent)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M160 83h39m-39 9h27m-65 29h77m-77 11h53"
            stroke="var(--muted)"
            strokeOpacity=".65"
            strokeLinecap="round"
          />
          <rect
            x="201"
            y="98"
            width="62"
            height="47"
            rx="13"
            fill="var(--illustration-bottom)"
            stroke="var(--illustration-edge)"
          />
          <path
            d="m220 121 8 8 13-17"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : kind === "success" ? (
        <>
          <circle
            cx="161"
            cy="101"
            r="48"
            fill={`url(#surface-${id})`}
            stroke="var(--illustration-edge)"
          />
          <circle
            cx="161"
            cy="101"
            r="32"
            fill="var(--accent)"
            fillOpacity=".08"
          />
          <path
            d="m141 102 14 14 26-30"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m223 53 3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"
            fill="var(--accent)"
            opacity=".7"
          />
        </>
      ) : kind === "error" ? (
        <>
          <rect
            x="103"
            y="47"
            width="116"
            height="108"
            rx="18"
            fill={`url(#surface-${id})`}
            stroke="var(--illustration-edge)"
          />
          <path
            d="m161 72 28 48h-56l28-48Z"
            fill="var(--danger)"
            fillOpacity=".08"
            stroke="var(--danger)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M161 89v14m0 7v1"
            stroke="var(--danger)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="m76 79 10 10m0-10L76 89m165 42h13"
            stroke="var(--accent)"
            opacity=".6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <rect
            x="100"
            y="44"
            width="120"
            height="111"
            rx="18"
            fill={`url(#surface-${id})`}
            stroke="var(--illustration-edge)"
          />
          <path d="M100 75h120" stroke="var(--illustration-edge)" />
          <circle cx="116" cy="60" r="2" fill="var(--accent)" />
          <path
            d="M126 60h27"
            stroke="var(--accent)"
            opacity=".4"
            strokeLinecap="round"
          />
          <rect
            x="117"
            y="92"
            width="66"
            height="8"
            rx="4"
            fill={`url(#signal-${id})`}
          />
          <path
            d="M117 115h83m-83 13h52"
            stroke="var(--muted)"
            strokeOpacity=".5"
            strokeLinecap="round"
          />
          {kind === "search" ? (
            <>
              <circle
                cx="211"
                cy="123"
                r="24"
                fill="var(--illustration-bottom)"
                stroke="var(--illustration-edge)"
              />
              <circle
                cx="209"
                cy="120"
                r="9"
                stroke="var(--accent)"
                strokeWidth="1.7"
              />
              <path
                d="m216 127 7 7"
                stroke="var(--accent)"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <circle
                cx="219"
                cy="125"
                r="22"
                fill="var(--illustration-bottom)"
                stroke="var(--illustration-edge)"
              />
              <path
                d="M211 125h16m-8-8v16"
                stroke="var(--accent)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </>
          )}
        </>
      )}
      <circle cx="70" cy="116" r="4" fill="var(--accent)" opacity=".7" />
      <circle cx="249" cy="67" r="3" fill="var(--accent)" opacity=".5" />
      <path
        d="m80 47 2-6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"
        fill="var(--accent)"
        opacity=".6"
      />
    </svg>
  );
}
