import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoVariant = "full" | "compact" | "mark";

const logoAlt = "DAKOSTA — Dashboard Konten Kolaborasi Stakeholder";

const variantClass: Record<BrandLogoVariant, string> = {
  full: "w-[min(100%,19rem)]",
  compact: "w-[10.5rem]",
  mark: "size-10",
};

export function BrandLogo({
  variant = "full",
  className,
  priority = false,
  decorative = false,
}: {
  variant?: BrandLogoVariant;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  const isMark = variant === "mark";
  const src = isMark
    ? "/brand/dakosta-app-icon.svg"
    : "/brand/dakosta-logo-vector-transparent.svg";

  return (
    <Image
      src={src}
      alt={decorative ? "" : logoAlt}
      aria-hidden={decorative || undefined}
      width={isMark ? 512 : 3840}
      height={isMark ? 512 : 1280}
      priority={priority}
      unoptimized
      className={cn("h-auto object-contain", variantClass[variant], className)}
    />
  );
}
