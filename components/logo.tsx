import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
}

export function Logo({ className, variant = 'light' }: LogoProps) {
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/logo.png"
        alt="CIMAdera"
        width={200}
        height={56}
        className="h-12 w-auto object-contain"
        style={variant === 'light' ? { filter: 'brightness(0) invert(1)' } : undefined}
        priority
        unoptimized
      />
    </div>
  );
}
