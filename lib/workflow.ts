import type { CeilingProject, ProjectClient } from './project';
import type { ProjectStatus } from './ceiling-model';

export const projectStatuses: Array<{ id: ProjectStatus; label: string }> = [
  { id: 'lead', label: 'Новая заявка' },
  { id: 'measurement', label: 'Замер' },
  { id: 'calculation', label: 'Расчёт' },
  { id: 'approved', label: 'Согласовано' },
  { id: 'production', label: 'Производство' },
  { id: 'installation', label: 'Монтаж' },
  { id: 'completed', label: 'Завершён' },
  { id: 'cancelled', label: 'Отменён' },
];

export function projectTotalIncome(project: CeilingProject) {
  return (project.transactions || [])
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
}

export function projectTotalExpense(project: CeilingProject) {
  return (project.transactions || [])
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);
}

export function projectProfit(project: CeilingProject) {
  return projectTotalIncome(project) - projectTotalExpense(project);
}

export function projectMarginPercent(project: CeilingProject) {
  const income = projectTotalIncome(project);
  if (!income) return 0;
  return (projectProfit(project) / income) * 100;
}

export function clientDisplayName(client: ProjectClient) {
  return client.name.trim() || 'Без имени';
}
