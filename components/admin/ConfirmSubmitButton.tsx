"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  confirmMessage: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">;

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  ...buttonProps
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      {...buttonProps}
      disabled={buttonProps.disabled || pending}
      aria-busy={pending}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
