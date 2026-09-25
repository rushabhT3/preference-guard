import type { ComponentPropsWithRef } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  isCompact?: boolean;
}

export function Button({
  variant = "secondary",
  isCompact = false,
  className,
  type = "button",
  ...buttonProps
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    isCompact && styles.compact,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...buttonProps} />;
}
