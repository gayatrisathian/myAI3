// components/messages/CitationLink.tsx
import React from "react";

type Props = {
  url?: string | null;
  label?: string | null;
  className?: string;
  download?: boolean;
};

export default function CitationLink({ url, label, className, download }: Props) {
  if (!url) return null;

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    // Prevent parent containers (message card) from hijacking the click
    e.stopPropagation();
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onAuxClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      download={download}
      className={className ?? "inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"}
      aria-label={label ?? "Open source"}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
        <polyline points="17 3 21 3 21 7" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      <span>{label ?? "Download"}</span>
    </a>
  );
}
