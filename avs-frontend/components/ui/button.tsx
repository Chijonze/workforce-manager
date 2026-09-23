import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-blue text-white shadow-cta hover:bg-brand-blue-dark focus-visible:outline-brand-blue",
        secondary: "border border-slate-200 bg-white text-navy hover:border-brand-blue/40 hover:bg-blue-50",
        dark: "bg-navy text-white hover:bg-navy-soft focus-visible:outline-navy",
        green: "bg-brand-green text-white shadow-[0_18px_40px_rgba(16,185,129,0.28)] hover:bg-brand-green-dark focus-visible:outline-brand-green",
        ghost: "text-slate-700 hover:bg-slate-100",
      },
      size: {
        default: "min-h-11 px-5",
        lg: "min-h-12 px-6 text-base",
        sm: "min-h-9 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
