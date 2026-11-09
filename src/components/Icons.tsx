type P = { size?: number; className?: string };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const BackIcon = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className}><path d="M15 6l-6 6 6 6" /></svg>
);
export const HomeIcon = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
);
export const ChatIcon = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
);
export const PeopleIcon = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2" />
  </svg>
);
export const MicIcon = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);
export const ImageIcon = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
);
export const SendIcon = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>
);
export const CakeIcon = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 21V12a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v9" />
    <path d="M4 16c1.5 1 3 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0" />
    <path d="M12 7V4M3 21h18" />
  </svg>
);
export const CheckIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} strokeWidth={3} className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const XIcon = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const PlusIcon = ({ size = 20, className }: P) => (
  <svg {...base(size)} strokeWidth={2} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const SpeakerIcon = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>
);
export const LockIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
