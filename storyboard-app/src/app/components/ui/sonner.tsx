"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "!z-[9999] !border !border-gray-700 !bg-[#121212] !text-gray-100 !shadow-2xl !shadow-black/50",
          title: "!text-gray-100 !font-medium",
          description: "!text-gray-400",
          success: "!border-emerald-700/60",
          error: "!border-red-700/60 !bg-[#1a1111] !text-red-50",
          warning: "!border-amber-700/60 !bg-[#1a1610] !text-amber-50",
          info: "!border-blue-700/60 !bg-[#10141a] !text-blue-50",
          closeButton: "!border-gray-700 !bg-[#1a1a1a] !text-gray-300 hover:!bg-[#222]",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
