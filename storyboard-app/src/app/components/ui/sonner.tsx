"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      richColors
      closeButton
      toastOptions={{
        style: {
          background: "#121212",
          color: "#f3f4f6",
          border: "1px solid #374151",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
        },
        classNames: {
          toast: "!z-[9999] !rounded-xl !px-4 !py-3",
          title: "!text-gray-100 !font-medium !leading-6",
          description: "!text-gray-300 !leading-5",
          error: "!border-red-800/70 !bg-[#1a1111] !text-red-50",
          success: "!border-emerald-800/70 !bg-[#0f1914] !text-emerald-50",
          warning: "!border-amber-800/70 !bg-[#1a1610] !text-amber-50",
          info: "!border-blue-800/70 !bg-[#10141a] !text-blue-50",
          closeButton: "!border-gray-700 !bg-[#181818] !text-gray-300 hover:!bg-[#222]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
