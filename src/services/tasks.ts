import { getApi } from './api';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'InProgress' | 'Completed';
  createdAt: string;
  assignedTo?: string;
  relatedBarcode?: string; // Görevle ilgili bir barkod varsa
}

export async function getTasks(): Promise<Task[]> {
  const api = await getApi();
  const response = await api.get('/ToDo/list?startRow=0&endRow=100');
  
  if (response.data && response.data.data) {
    return response.data.data;
  }
  return response.data || [];
}

export async function updateTaskStatus(taskId: string, newStatus: 'InProgress' | 'Completed'): Promise<void> {
  const api = await getApi();
  await api.post(`/Task/updateStatus`, { taskId, status: newStatus });
}
