import { getApi } from './api';

export interface HREmployeeDto {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  positionId?: number | null;
  positionName?: string | null;
  employmentStatus?: number;
  photoPath?: string | null;
}

export interface HREmployeeListResponse {
  employees?: HREmployeeDto[];
  departmentList?: Array<{ value: string; text: string }>;
  positionList?: Array<{ value: string; text: string }>;
  statusList?: Array<{ value: string; text: string }>;
}

/**
 * Veritabanından tüm personel listesini çeker.
 * Endpoint: /api/HR/employee-list
 */
export async function getEmployeeList(): Promise<HREmployeeDto[]> {
  try {
    const api = await getApi();
    const response = await api.get<HREmployeeListResponse | HREmployeeDto[]>('/HR/employee-list');

    if (response.data) {
      if (Array.isArray(response.data)) {
        return response.data;
      }
      if (Array.isArray(response.data.employees)) {
        return response.data.employees;
      }
    }
    return [];
  } catch (error) {
    console.error('getEmployeeList error:', error);
    throw error;
  }
}

/**
 * HR_Employee tablosunda departmanı "DEPO" olan aktif personelleri çeker.
 */
export async function getWarehouseEmployees(onlyDepo = true): Promise<HREmployeeDto[]> {
  const all = await getEmployeeList();
  if (!onlyDepo) return all;

  const depoStaff = all.filter((e) => {
    const dept = (e.departmentName || '').trim().toUpperCase();
    return dept === 'DEPO' || dept.includes('DEPO') || dept.includes('WAREHOUSE');
  });

  return depoStaff.length > 0 ? depoStaff : all;
}
