import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = {
  // Empresas
  getEmpresas: () => axios.get(`${API}/empresas`).then(r => r.data),
  createEmpresa: (data) => axios.post(`${API}/empresas`, data).then(r => r.data),
  updateEmpresa: (id, data) => axios.put(`${API}/empresas/${id}`, data).then(r => r.data),
  deleteEmpresa: (id) => axios.delete(`${API}/empresas/${id}`).then(r => r.data),

  // Empleados
  getEmpleados: (empresaId) => axios.get(`${API}/empleados?empresa_id=${empresaId}`).then(r => r.data),
  getEmpleado: (id) => axios.get(`${API}/empleados/${id}`).then(r => r.data),
  createEmpleado: (data) => axios.post(`${API}/empleados`, data).then(r => r.data),
  updateEmpleado: (id, data) => axios.put(`${API}/empleados/${id}`, data).then(r => r.data),
  deleteEmpleado: (id) => axios.delete(`${API}/empleados/${id}`).then(r => r.data),

  // Liquidaciones
  getLiquidaciones: (empresaId) => axios.get(`${API}/liquidaciones?empresa_id=${empresaId}`).then(r => r.data),
  getLiquidacion: (id) => axios.get(`${API}/liquidaciones/${id}`).then(r => r.data),
  createLiquidacion: (data) => axios.post(`${API}/liquidaciones`, data).then(r => r.data),
  updateLiquidacion: (id, data) => axios.put(`${API}/liquidaciones/${id}`, data).then(r => r.data),
  deleteLiquidacion: (id) => axios.delete(`${API}/liquidaciones/${id}`).then(r => r.data),

  // Liquidaciones Final
  getLiquidacionesFinal: (empresaId) => axios.get(`${API}/liquidaciones-final?empresa_id=${empresaId}`).then(r => r.data),
  createLiquidacionFinal: (data) => axios.post(`${API}/liquidaciones-final`, data).then(r => r.data),
  deleteLiquidacionFinal: (id) => axios.delete(`${API}/liquidaciones-final/${id}`).then(r => r.data),

  // Configuración
  getConfiguracion: () => axios.get(`${API}/configuracion`).then(r => r.data),
  updateConfiguracion: (data) => axios.put(`${API}/configuracion`, data).then(r => r.data),

  // Dashboard
  getDashboard: (empresaId) => axios.get(`${API}/dashboard?empresa_id=${empresaId}`).then(r => r.data),

  // Seed
  seed: () => axios.post(`${API}/seed`).then(r => r.data),

  // Asistencia Diaria
  getAsistencias: (empleadoId, fechaInicio, fechaFin) => {
    let url = `${API}/asistencias?empleado_id=${empleadoId}`;
    if (fechaInicio) url += `&fecha_inicio=${fechaInicio}`;
    if (fechaFin) url += `&fecha_fin=${fechaFin}`;
    return axios.get(url).then(r => r.data);
  },
  getAsistencia: (id) => axios.get(`${API}/asistencias/${id}`).then(r => r.data),
  createAsistencia: (data) => axios.post(`${API}/asistencias`, data).then(r => r.data),
  createAsistenciasBatch: (data) => axios.post(`${API}/asistencias/batch`, data).then(r => r.data),
  updateAsistencia: (id, data) => axios.put(`${API}/asistencias/${id}`, data).then(r => r.data),
  deleteAsistencia: (id) => axios.delete(`${API}/asistencias/${id}`).then(r => r.data),

  // Liquidación Avanzada por Asistencia
  createLiquidacionAvanzada: (data) => axios.post(`${API}/liquidaciones-avanzadas`, data).then(r => r.data),
  getLiquidacionesAvanzadas: (empresaId, empleadoId) => {
    let url = `${API}/liquidaciones-avanzadas?empresa_id=${empresaId}`;
    if (empleadoId) url += `&empleado_id=${empleadoId}`;
    return axios.get(url).then(r => r.data);
  },

  // Festivos
  getFestivos: (ano = 2026) => axios.get(`${API}/festivos?ano=${ano}`).then(r => r.data),
  verificarFestivo: (fecha) => axios.get(`${API}/festivos/verificar?fecha=${fecha}`).then(r => r.data),
};
