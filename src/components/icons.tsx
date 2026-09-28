import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="1em"
      height="1em"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13 13l4 4" />
  </Icon>
);
export const SortIcon = ({ dir, ...p }: IconProps & { dir: 'asc' | 'desc' | null }) => (
  <Icon {...p}>
    <path d="M7 8l3-3 3 3" opacity={dir === 'desc' ? 0.25 : 1} />
    <path d="M7 12l3 3 3-3" opacity={dir === 'asc' ? 0.25 : 1} />
  </Icon>
);
export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 13V3M6 7l4-4 4 4M3.5 13v3.5h13V13" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4v12M4 10h12" />
  </Icon>
);
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10h7.4l.8-10" />
  </Icon>
);
export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 3.5l3 3L7 16H4v-3z" />
  </Icon>
);
export const WarningIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3l7.5 13h-15z" />
    <path d="M10 8v3.5M10 14v.01" />
  </Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10.5l4 4 8-9" />
  </Icon>
);
export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 9v4.5M10 6.5v.01" />
  </Icon>
);
export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="14" height="11" rx="1.5" />
    <path d="M3.5 5.5 10 10.5l6.5-5" />
  </Icon>
);
export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3v10M6 9l4 4 4-4M3.5 13v3.5h13V13" />
  </Icon>
);
export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.5h-3.5" />
  </Icon>
);
export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.5 5l5 5-5 5" />
  </Icon>
);
export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="7" width="9.5" height="9.5" rx="1.5" />
    <path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7" />
  </Icon>
);
export const KeyboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="5" width="15" height="10" rx="1.5" />
    <path d="M6 8.5h.01M9 8.5h.01M12 8.5h.01M15 8.5h.01M6.5 12h7" />
  </Icon>
);
