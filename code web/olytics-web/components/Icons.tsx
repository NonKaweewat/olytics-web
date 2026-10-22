import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IconGrid = (p: P) => (<svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
export const IconChart = (p: P) => (<svg {...base(p)}><path d="M4 20V14M10 20V9M16 20v-6M22 20H2" /><path d="m4 9 6-4 6 4 5-4" /></svg>);
export const IconTruck = (p: P) => (<svg {...base(p)}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>);
export const IconGear = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>);
export const IconTerminal = (p: P) => (<svg {...base(p)}><path d="m4 17 6-5-6-5M12 19h8" /></svg>);
export const IconLogout = (p: P) => (<svg {...base(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>);
export const IconDollar = (p: P) => (<svg {...base(p)}><path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>);
export const IconBag = (p: P) => (<svg {...base(p)}><path d="M6 7h12l1 14H5z" /><path d="M9 10V6a3 3 0 0 1 6 0v4" /></svg>);
export const IconStar = (p: P) => (<svg {...base(p)}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" /></svg>);
export const IconClock = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)}><path d="m5 12 5 5 9-10" /></svg>);
export const IconCard = (p: P) => (<svg {...base(p)}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>);
export const IconBulb = (p: P) => (<svg {...base(p)}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>);

/** Ring logo from the prototype: navy ring with a blue arc. */
export function Logo({ size = 40 }: { size?: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="#1d2b52" strokeWidth="7" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke="#4f8de0" strokeWidth="7"
        strokeDasharray={`${c * 0.22} ${c}`} transform="rotate(-80 20 20)"
      />
    </svg>
  );
}
