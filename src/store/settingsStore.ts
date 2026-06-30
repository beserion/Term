import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  activeWarehouseId: number | null;
  activeWarehouseName: string | null;
  setActiveWarehouse: (id: number, name: string) => void;
  clearActiveWarehouse: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeWarehouseId: null,
      activeWarehouseName: null,
      setActiveWarehouse: (id, name) => set({ activeWarehouseId: id, activeWarehouseName: name }),
      clearActiveWarehouse: () => set({ activeWarehouseId: null, activeWarehouseName: null }),
    }),
    {
      name: 'terminal-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
