"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  confirmMessage: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">;

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  ...buttonProps
}: ConfirmSubmitButtonProps) {
  return (
    <button
      {...buttonProps}
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
