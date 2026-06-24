import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Stroke color override (defaults to currentColor so it inherits from parent). */
  stroke?: string;
}

/**
 * App brand mark — gray L-bracket hook icon.
 * Use `className` to size it (e.g. "w-7 h-7"). Color via parent's text color or `stroke` prop.
 */
export function Logo({ className, stroke }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <path
        d="M 22 26 H 68 a 8 8 0 0 1 8 8 V 70 a 8 8 0 0 1 -8 8 H 48"
        stroke={stroke ?? 'currentColor'}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
