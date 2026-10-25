'use client'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '../../../lib/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-muted focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 shadow-none',
  {
    variants: {
      variant: {
        default: 'bg-[#17181A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-medium rounded-full',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full',
        outline: 'border border-control bg-background hover:bg-surface-200 hover:text-foreground rounded-full',
        secondary: 'bg-surface-200 text-foreground hover:bg-surface-300 rounded-full',
        ghost: 'hover:bg-surface-200 hover:text-foreground rounded-full',
        link: 'text-primary underline-offset-4 hover:underline',
        brand:
          'bg-[#17181A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-medium rounded-full whitespace-nowrap',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 rounded-full px-4 text-xs',
        lg: 'h-11 rounded-full px-8',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    compoundVariants: [
      { variant: 'brand', size: 'default', class: 'rounded-full px-5 py-2' },
      { variant: 'brand', size: 'sm', class: 'rounded-full px-4 py-2' },
      { variant: 'brand', size: 'lg', class: 'rounded-full px-8 py-2' },
      { variant: 'brand', size: 'icon', class: 'rounded-full p-2' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
