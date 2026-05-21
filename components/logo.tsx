import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
}

export function Logo({ className, variant = 'light' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Reemplazar con <Image src="/logo.png" alt="CIMAdera" width={32} height={32} /> cuando esté disponible */}
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#0EA5E9" />
        <path d="M6 8h20v4H6zM6 14h12v4H6zM6 20h16v4H6z" fill="white" />
      </svg>
      <span
        className={cn(
          'font-bold text-lg tracking-tight',
          variant === 'light' ? 'text-white' : 'text-slate-800'
        )}
      >
        CIM<span className={variant === 'light' ? 'text-sky-400' : 'text-sky-500'}>Adera</span>
      </span>
    </div>
  );
}
