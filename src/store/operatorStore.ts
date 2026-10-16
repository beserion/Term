import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWarehouseEmployees, HREmployeeDto } from '../services/hr';

export interface WarehouseOperator {
  id: number;
  fullName: string;
  employeeCode?: string;
  departmentName?: string;
  positionName?: string;
}

interface OperatorState {
  activeOperator: WarehouseOperator | null;
  operators: WarehouseOperator[];
  isLoading: boolean;
  lastLoaded: number | null;
  setActiveOperator: (op: WarehouseOperator | null) => void;
  loadOperators: (forceRefresh?: boolean) => Promise<void>;
  findOperatorByCodeOrId: (code: string) => WarehouseOperator | undefined;
}

export const useOperatorStore = create<OperatorState>()(
  persist(
    (set, get) => ({
      activeOperator: null,
      operators: [],
      isLoading: false,
      lastLoaded: null,

      setActiveOperator: (op) => {
        set({ activeOperator: op });
      },

      loadOperators: async (forceRefresh = false) => {
        const state = get();
        // 5 dakika içinde çekilmişse ve force değilse cache'ten kullan
        if (!forceRefresh && state.operators.length > 0 && state.lastLoaded && Date.now() - state.lastLoaded < 5 * 60 * 1000) {
          return;
        }

        try {
          set({ isLoading: true });
          const employees = await getWarehouseEmployees(true);

          const mapped: WarehouseOperator[] = employees.map((e: HREmployeeDto) => ({
            id: e.id,
            fullName: e.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim() || `Personel #${e.id}`,
            employeeCode: e.employeeCode || '',
            departmentName: e.departmentName || '',
            positionName: e.positionName || '',
          }));

          set({
            operators: mapped,
            lastLoaded: Date.now(),
            isLoading: false,
          });

          // Eğer henüz seçili operatör yoksa ve listede personel varsa, ilkini veya kaydedilmişi koru
          const currentActive = get().activeOperator;
          if (currentActive) {
            const stillExists = mapped.find((m) => m.id === currentActive.id);
            if (stillExists) {
              set({ activeOperator: stillExists });
            }
          }
        } catch (err) {
          console.error('loadOperators error:', err);
          set({ isLoading: false });
        }
      },

      findOperatorByCodeOrId: (code: string) => {
        if (!code) return undefined;
        const trimmed = code.trim().toLowerCase();
        const list = get().operators;
        return list.find(
          (op) =>
            op.employeeCode?.toLowerCase() === trimmed ||
            String(op.id) === trimmed ||
            op.fullName.toLowerCase() === trimmed
        );
      },
    }),
    {
      name: 'wms-operator-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
