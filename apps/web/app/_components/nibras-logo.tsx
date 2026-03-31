type LogoVariant = "surface" | "inverse" | "theme";

export default function NibrasLogo({
  variant = "theme",
  width = 120,
  className = "",
}: {
  variant?: LogoVariant;
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  const height = Math.round(width * (36 / 120));
  const isDark = variant === "inverse";

  const textColor = isDark ? "#ffffff" : "url(#nibras-grad)";
  const iconBg = isDark ? "rgba(255,255,255,0.1)" : "rgba(99,102,241,0.12)";
  const iconStroke = isDark ? "rgba(255,255,255,0.4)" : "#6366f1";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Nibras"
      role="img"
    >
      <defs>
        <linearGradient id="nibras-grad" x1="0" y1="0" x2="120" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="nibras-icon-grad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* Icon — rounded square with stylized N */}
      <rect x="1" y="1" width="34" height="34" rx="9" fill={iconBg} stroke={iconStroke} strokeWidth="1.2" />
      <path
        d="M11 25V11l13 14V11"
        stroke="url(#nibras-icon-grad)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Wordmark */}
      <text
        x="43"
        y="24"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        fontSize="17"
        fontWeight="700"
        letterSpacing="-0.5"
        fill={textColor}
      >
        nibras
      </text>

      {/* Accent dot */}
      <circle cx="112" cy="11" r="3" fill="#6366f1" opacity="0.9" />
    </svg>
  );
}
