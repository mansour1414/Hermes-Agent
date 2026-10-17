import { create } from "zustand";

interface UiState {
  commandPaletteOpen: boolean;
  mobileSidebarOpen: boolean;
  toasts: Toast[];
  setCommandPaletteOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: "success" | "error" | "info" | "warning";
  duration?: number;
}

let toastCounter = 0;

export const useUiStore = create<UiState>((set) => ({
  commandPaletteOpen: false,
  mobileSidebarOpen: false,
  toasts: [],
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  pushToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: `toast-${++toastCounter}` }],
    })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
