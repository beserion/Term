import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  activeWarehouseId: number | null;
  activeWarehouseName: string | null;
  setActiveWarehouse: (id: number, name: string) => void;
  clearActiveWarehouse: () => void;
  activePrinterId: string | null;
  activePrinterName: string | null;
  setActivePrinter: (id: string | null, name: string | null) => void;
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
      setActivePrinter: (id, name) => set({ activePrinterId: id, activePrinterName: name }),
      clearActivePrinter: () => set({ activePrinterId: null, activePrinterName: null }),
    }),
    {
      name: 'terminal-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
