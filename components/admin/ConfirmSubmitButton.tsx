"use client";

import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  className?: string;
  confirmMessage: string;
};

export function ConfirmSubmitButton({
  children,
  className,
  confirmMessage
}: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
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
