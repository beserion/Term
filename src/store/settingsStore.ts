import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  activeWarehouseId: number | null;
  activeWarehouseName: string | null;
  setActiveWarehouse: (id: number, name: string) => void;
  clearActiveWarehouse: () => void;
  activePrinterId: number | null;
  activePrinterName: string | null;
  activePrinterIp: string | null;
  activePrinterPort: number | null;
  setActivePrinter: (id: number | null, name: string | null, ipAddress?: string | null, port?: number | null) => void;
  setCustomPrinterIpPort: (ipAddress: string, port: number) => void;
  clearActivePrinter: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeWarehouseId: null,
      activeWarehouseName: null,
      setActiveWarehouse: (id, name) => set({ activeWarehouseId: id, activeWarehouseName: name }),
      clearActiveWarehouse: () => set({ activeWarehouseId: null, activeWarehouseName: null }),
      activePrinterId: null,
      activePrinterName: null,
      activePrinterIp: null,
      activePrinterPort: null,
      setActivePrinter: (id, name, ipAddress = null, port = null) =>
        set({
          activePrinterId: id,
          activePrinterName: name,
          activePrinterIp: ipAddress,
          activePrinterPort: port,
        }),
      setCustomPrinterIpPort: (ipAddress, port) =>
        set((state) => ({
          activePrinterIp: ipAddress,
          activePrinterPort: port,
        })),
      clearActivePrinter: () =>
        set({
          activePrinterId: null,
          activePrinterName: null,
          activePrinterIp: null,
          activePrinterPort: null,
        }),
    }),
    {
      name: 'terminal-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
