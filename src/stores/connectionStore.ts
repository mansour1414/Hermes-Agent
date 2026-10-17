import { create } from "zustand";
import type { ConnectionStatus } from "@/types";

interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
}

const initialStatus: ConnectionStatus = {
  state: "connecting",
  message: "Checking the Hermes connection…",
  lastCheckedAt: new Date(0).toISOString(),
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: initialStatus,
  setStatus: (status) => set({ status }),
}));
