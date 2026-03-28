import Image from "next/image";
import styles from "./nibras-logo.module.css";

type LogoVariant = "surface" | "inverse" | "theme";

export default function NibrasLogo({
  variant = "theme",
  width,
  className = "",
  priority = false
}: {
  variant?: LogoVariant;
  width: number;
  className?: string;
  priority?: boolean;
}) {
  const imageStyle = {
    width: `${width}px`,
    height: "auto"
  } as const;

  if (variant === "surface") {
    return (
      <span className={`${styles.logoWrap} ${className}`}>
        <Image
          src="/branding/logo-light.png"
          alt="Nibras"
          width={143}
          height={43}
          priority={priority}
          suppressHydrationWarning
          className={`${styles.image} ${styles.variantSurface}`}
          style={imageStyle}
        />
      </span>
    );
  }

  if (variant === "inverse") {
    return (
      <span className={`${styles.logoWrap} ${className}`}>
        <Image
          src="/branding/logo-dark.png"
          alt="Nibras"
          width={160}
          height={48}
          priority={priority}
          suppressHydrationWarning
          className={`${styles.image} ${styles.variantInverse}`}
          style={imageStyle}
        />
      </span>
    );
  }

  return (
    <span className={`${styles.logoWrap} ${className}`}>
      <Image
        src="/branding/logo-light.png"
        alt="Nibras"
        width={143}
        height={43}
        priority={priority}
        suppressHydrationWarning
        className={`${styles.image} ${styles.themeLight}`}
        style={imageStyle}
      />
      <Image
        src="/branding/logo-dark.png"
        alt="Nibras"
        width={160}
        height={48}
        priority={priority}
        suppressHydrationWarning
        className={`${styles.image} ${styles.themeDark}`}
        style={imageStyle}
      />
    </span>
  );
}
