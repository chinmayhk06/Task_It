import api from './api';

export const getProjectReport = () => api.get('/reports/projects');

export const getTeamReport = () => api.get('/reports/teams');

export const getMemberReport = () => api.get('/reports/members');

export const getMonthlyReport = (month) =>
  api.get('/reports/monthly', { params: month ? { month } : {} });

export const getCompletedTasksReport = () => api.get('/reports/completed-tasks');

export const getDelayedTasksReport = () => api.get('/reports/delayed-tasks');

const downloadBlob = async (url, filename) => {
  const response = await api.get(url, { responseType: 'blob' });
  const blob = response.data;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportReport = async (reportKey, exportType, month = null) => {
  const endpoints = {
    projects: '/reports/projects',
    teams: '/reports/teams',
    interns: '/reports/interns',
    monthly: '/reports/monthly',
    completedTasks: '/reports/completed-tasks',
    delayedTasks: '/reports/delayed-tasks',
  };

  const ext = exportType === 'pdf' ? 'pdf' : 'xlsx';
  let url = `${endpoints[reportKey]}?export=${exportType}`;
  if (reportKey === 'monthly' && month) url += `&month=${month}`;

  await downloadBlob(url, `${reportKey}_report.${ext}`);
};
