import type { ReactNode } from "react";

export function NotificationReadContent({
  children,
  softened,
}: {
  children: ReactNode;
  softened: boolean;
}) {
  return (
    <div
      style={{
        filter: softened ? "blur(0.6px)" : "none",
        opacity: softened ? 0.6 : 1,
      }}
    >
      {children}
    </div>
  );
}
