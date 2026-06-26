import { type CSSProperties, type ElementType, type ReactNode, useId } from "react";

type GlassVariant = "dock" | "panel" | "bar" | "button";
type GlassIntensity = "subtle" | "medium" | "strong";

interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
  variant?: GlassVariant;
  intensity?: GlassIntensity;
  radius?: number;
  as?: ElementType;
  "aria-label"?: string;
  role?: string;
}

export function GlassSurface({
  children,
  className = "",
  variant = "panel",
  intensity = "medium",
  radius = 18,
  as: Element = "div",
  ...rest
}: GlassSurfaceProps) {
  const rawId = useId();
  const filterId = `glass-${rawId.replace(/:/g, "")}`;
  const style = { "--glass-radius": `${radius}px` } as CSSProperties;

  return (
    <Element className={`glass-surface glass-${variant} glass-${intensity} ${className}`.trim()} style={style} {...rest}>
      <svg className="glass-filter" aria-hidden="true" focusable="false">
        <filter id={filterId} x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.025" numOctaves="2" seed="13" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feColorMatrix
            in="displaced"
            type="matrix"
            values="1.05 0 0 0 0  0 1.02 0 0 0  0 0 1.12 0 0  0 0 0 1 0"
            result="tinted"
          />
          <feGaussianBlur in="tinted" stdDeviation="0.18" />
        </filter>
      </svg>
      <span className="glass-surface__warp" style={{ filter: `url(#${filterId})` }} />
      <span className="glass-surface__edge" />
      <span className="glass-surface__glow" />
      <div className="glass-surface__content">{children}</div>
    </Element>
  );
}
