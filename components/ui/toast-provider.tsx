"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, Clock3, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "scheduled";

type Toast = {
  id: number;
  title: string;
  message?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (input: Omit<Toast, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, { icon: typeof CheckCircle2; className: string }> = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  },
  error: {
    icon: CircleAlert,
    className: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
  },
  scheduled: {
    icon: Clock3,
    className: "border-orange-500/35 bg-orange-500/10 text-orange-900 dark:text-orange-200",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(0);

  const toast = React.useCallback((input: Omit<Toast, "id">) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { ...input, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5000);
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-3 sm:left-auto sm:w-[min(420px,calc(100vw-2rem))]"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((item) => {
          const config = variantStyles[item.variant];
          const Icon = config.icon;
          return (
            <div
              key={item.id}
              role={item.variant === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto w-full rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md",
                "animate-in fade-in slide-in-from-bottom-2 duration-200",
                config.className,
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.message && <p className="mt-1 text-xs leading-5 opacity-85">{item.message}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                  aria-label="Dismiss notification"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export function ToastMessage({
  title,
  message,
  variant = "success",
}: {
  title: string;
  message?: string;
  variant?: ToastVariant;
}) {
  const { toast } = useToast();
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    toast({ title, message, variant });
  }, [message, title, toast, variant]);

  return null;
}
