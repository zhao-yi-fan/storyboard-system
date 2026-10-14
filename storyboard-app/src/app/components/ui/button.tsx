import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import styles from "./button.module.scss";
import { cn } from "./utils";

const buttonVariants = cva(
  `${styles.button} inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 aria-invalid:ring-destructive/20 aria-invalid:border-destructive`,
  {
    variants: {
      variant: {
        default: styles.primary,
        destructive: styles.danger,
        outline: styles.secondary,
        secondary: styles.secondary,
        ghost: styles.ghost,
        link: styles.link,
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  disabled,
  onClick,
  onClickCapture,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  const unavailable =
    (disabled ?? false) || props["aria-disabled"] === true || props["aria-disabled"] === "true";

  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      className={cn(styles.button, buttonVariants({ variant, size, className }))}
      {...props}
      disabled={disabled}
      aria-disabled={unavailable ? true : props["aria-disabled"]}
      onClickCapture={(event) => {
        if (unavailable) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClickCapture?.(event);
      }}
      onClick={(event) => {
        if (unavailable) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}

export { Button, buttonVariants };
