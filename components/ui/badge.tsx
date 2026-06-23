import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200',
        destructive: 'border-transparent bg-red-100 text-red-700 hover:bg-red-200',
        outline: 'border-slate-200 text-slate-600 bg-white',
        success: 'border-transparent bg-emerald-50 text-emerald-700 border border-emerald-200',
        warning: 'border-transparent bg-amber-50 text-amber-700 border border-amber-200',
        info: 'border-transparent bg-[#CCF0FC] text-[#0089C7] border border-[#00ADEF]/30',
        purple: 'border-transparent bg-violet-50 text-violet-700 border border-violet-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
