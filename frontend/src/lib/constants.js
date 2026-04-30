// Constantes legales Colombia 2026
// Fuente: Decreto salario mínimo 2026, Ley 2101/2021 reducción jornada

export const DEFAULTS = {
  SMMLV: 1750905,
  AUXILIO_TRANSPORTE: 249095,
  JORNADA_SEMANAL: 44, // Desde julio 2025, Ley 2101/2021
};

// Tasas de riesgo ARL (% sobre salario, a cargo del empleador)
export const ARL_RATES = {
  'I': 0.00522,   // Riesgo mínimo
  'II': 0.01044,  // Riesgo bajo
  'III': 0.02436, // Riesgo medio
  'IV': 0.04350,  // Riesgo alto
  'V': 0.06960,   // Riesgo máximo
};

// Multiplicadores de horas extras y recargos (Código Sustantivo del Trabajo)
export const EXTRAS = {
  EXTRA_DIURNA: 1.25,        // 25% recargo sobre hora ordinaria
  EXTRA_NOCTURNA: 1.75,      // 75% recargo
  EXTRA_DOM_DIURNA: 2.00,    // 100% recargo
  EXTRA_DOM_NOCTURNA: 2.50,  // 150% recargo
  RECARGO_NOCTURNO: 0.35,    // Solo el recargo adicional (35%)
  RECARGO_DOMINICAL: 1.00,   // Solo el recargo adicional (100%)
};

// Deducciones obligatorias del empleado
export const DEDUCCIONES = {
  SALUD_EMPLEADO: 0.04,    // 4% del salario
  PENSION_EMPLEADO: 0.04,  // 4% del salario
};

// Aportes obligatorios del empleador
export const APORTES_EMPLEADOR = {
  SALUD: 0.085,             // 8.5%
  PENSION: 0.12,            // 12%
  CAJA_COMPENSACION: 0.04,  // 4%
  SENA: 0.02,               // 2% (exonerable)
  ICBF: 0.03,               // 3% (exonerable)
};

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const TIPOS_EMPLEADOR = [
  { value: 'juridica', label: 'Persona jurídica (S.A.S, Ltda, S.A., etc.)' },
  { value: 'natural_2_mas', label: 'Persona natural — 2 o más trabajadores' },
  { value: 'natural_1', label: 'Persona natural — 1 solo trabajador' },
  { value: 'no_declarante', label: 'Entidad no declarante de renta (cooperativa, régimen especial, etc.)' },
];

export const TIPOS_CONTRATO = [
  { value: 'indefinido', label: 'Término Indefinido' },
  { value: 'fijo', label: 'Término Fijo' },
  { value: 'obra', label: 'Obra o Labor' },
];

export const NIVELES_ARL = [
  { value: 'I', label: 'Nivel I — 0.522%', rate: 0.00522 },
  { value: 'II', label: 'Nivel II — 1.044%', rate: 0.01044 },
  { value: 'III', label: 'Nivel III — 2.436%', rate: 0.02436 },
  { value: 'IV', label: 'Nivel IV — 4.350%', rate: 0.04350 },
  { value: 'V', label: 'Nivel V — 6.960%', rate: 0.06960 },
];

export const CONCEPTOS = {
  cesantias: 'Prestación equivalente a un mes de salario por año trabajado. Se consignan antes del 14 de febrero.',
  intereses_cesantias: 'Intereses del 12% anual sobre cesantías. Se pagan al empleado antes del 31 de enero.',
  prima: 'Equivale a un mes de salario por año. Se paga 50% en junio y 50% en diciembre.',
  vacaciones: '15 días hábiles de descanso remunerado por cada año de servicio.',
  arl: 'Administradora de Riesgos Laborales. Tarifa según nivel de riesgo de la actividad económica.',
  salud_empleado: 'Aporte obligatorio del empleado al sistema de salud (4% del salario base).',
  pension_empleado: 'Aporte obligatorio del empleado al sistema de pensiones (4% del salario base).',
  auxilio_transporte: 'Subsidio de transporte para empleados con salario mensual hasta 2 SMMLV ($3.501.810 en 2026).',
  parafiscales: 'Aportes: Caja de Compensación 4%, SENA 2%, ICBF 3%. Exonerados para salarios hasta 10 SMMLV (Ley 1607/2012).',
};

export const formatCOP = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('es-CO').format(Math.round(value));
};
