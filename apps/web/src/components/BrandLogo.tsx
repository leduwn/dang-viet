import React from 'react';

export interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
  showSubtitle?: boolean;
  monochrome?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 32,
  showWordmark = true,
  showSubtitle = false,
  monochrome = false,
  className = '',
}) => {
  const primaryColor = monochrome ? 'currentColor' : 'var(--accent-red, #9E2A2B)';
  const secondaryColor = monochrome ? 'currentColor' : '#D4A373';
  const secondaryOpacity = monochrome ? 0.75 : 1;

  return (
    <div
      className={`brand-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.65rem',
        userSelect: 'none',
        textDecoration: 'none',
      }}
    >
      {/* Vector Icon: Cách điệu hai tà áo dài hòa quyện nét D/V */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          flexShrink: 0,
          display: 'block',
        }}
        aria-hidden={showWordmark ? 'true' : undefined}
        aria-label={!showWordmark ? 'Logo Dáng Việt' : undefined}
        role={!showWordmark ? 'img' : undefined}
      >
        {/* Nền badge bo góc mềm */}
        <rect width="32" height="32" rx="8" fill="var(--bg-subtle, #F5ECE9)" />

        {/* Tà trước áo dài — đường nét chữ D uốn lượn */}
        <path
          d="M8 5C14.5 5 21 8.5 21 16C21 23.5 14.5 27 8 27C9.8 20 9.8 12 8 5Z"
          fill={primaryColor}
        />

        {/* Tà sau & nét vạt áo — đường nét chữ V thanh thoát */}
        <path
          d="M15 9.5L19.2 22.5C19.7 24 20.8 24 21.3 22.5L25.5 11.5C23.8 13 22.2 14.5 20.6 17.5L18.2 10.5C17.5 9 16 9 15 9.5Z"
          fill={secondaryColor}
          fillOpacity={secondaryOpacity}
        />

        {/* Nét khuy cổ áo truyền thống tinh tế */}
        <circle cx="8.5" cy="5.5" r="1.5" fill={secondaryColor} />
      </svg>

      {/* Wordmark Dáng Việt */}
      {showWordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: size >= 32 ? '1.35rem' : '1.15rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            Dáng Việt
          </span>
          {showSubtitle && (
            <span
              className="brand-subtitle"
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.02em',
                marginTop: '0.15rem',
                whiteSpace: 'nowrap',
              }}
            >
              Việt phục Remix — Phong cách Gen Z
            </span>
          )}
        </div>
      )}
    </div>
  );
};
