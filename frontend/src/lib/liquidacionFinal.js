/**
 * Motor de cálculos de liquidación final (retiro) — Colombia 2026
 * Fuentes: Código Sustantivo del Trabajo Arts. 64, 186, 249, 306; Ley 52/1975
 */

export const CAUSAS_RETIRO = [
  { value: 'renuncia', label: 'Renuncia voluntaria' },
  { value: 'despido_justa_causa', label: 'Despido con justa causa' },
  { value: 'despido_sin_justa_causa', label: 'Despido sin justa causa' },
  { value: 'mutuo_acuerdo', label: 'Mutuo acuerdo' },
  { value: 'vencimiento_contrato', label: 'Vencimiento de contrato' },
];

/**
 * Calcula la liquidación final para un empleado retirado.
 * @param {Object} empleado - Datos del empleado
 * @param {Object} params - { fecha_retiro, causa, fecha_vencimiento_contrato, dias_vacaciones_disfrutados }
 * @param {Object} config - Configuración legal
 * @returns {Object|null} Desglose de la liquidación final
 */
export function calcularLiquidacionFinal(empleado, params, config) {
  if (!empleado || !config || !params.fecha_retiro || !params.causa) return null;

  const salario = empleado.salario || 0;
  const fechaIngreso = new Date(empleado.fecha_ingreso);
  const fechaRetiro = new Date(params.fecha_retiro);

  if (isNaN(fechaIngreso.getTime()) || isNaN(fechaRetiro.getTime())) return null;
  if (fechaRetiro < fechaIngreso) return null;

  // Auxilio de transporte
  const aplicaAuxilio = empleado.auxilio_transporte && salario <= (2 * config.smmlv);
  const auxilioMensual = aplicaAuxilio ? config.auxilio_transporte : 0;
  const salarioDiario = salario / 30;

  // === Días totales trabajados ===
  const diasTotales = diasEntre(fechaIngreso, fechaRetiro);

  // === 1. Salario proporcional último mes ===
  // Días trabajados en el mes de retiro: desde el inicio del mes (o fecha de ingreso
  // si ingresó en ese mismo mes) hasta la fecha de retiro, base 30 días/mes (CST).
  const inicioUltimoMes = new Date(fechaRetiro.getFullYear(), fechaRetiro.getMonth(), 1);
  const fechaBaseUltimoMes = fechaIngreso > inicioUltimoMes ? fechaIngreso : inicioUltimoMes;
  const diasUltimoMes = Math.min(30, Math.max(1, diasEntre(fechaBaseUltimoMes, fechaRetiro) + 1));
  const salarioUltimoMes = salarioDiario * diasUltimoMes;
  const auxilioUltimoMes = (auxilioMensual / 30) * diasUltimoMes;

  // === 2. Prima de servicios proporcional ===
  // Art. 306 CST: (Sal + Aux) * días_semestre / 360
  // Semestres: Ene-Jun, Jul-Dic
  const mesRetiro = fechaRetiro.getMonth();
  const inicioSemestre = mesRetiro < 6
    ? new Date(fechaRetiro.getFullYear(), 0, 1)
    : new Date(fechaRetiro.getFullYear(), 6, 1);
  const fechaBasePrima = fechaIngreso > inicioSemestre ? fechaIngreso : inicioSemestre;
  const diasSemestre = Math.max(0, diasEntre(fechaBasePrima, fechaRetiro));
  const prima = (salario + auxilioMensual) * diasSemestre / 360;

  // === 3. Cesantías proporcionales ===
  // Art. 249 CST: (Sal + Aux) * días_año / 360
  const inicioAno = new Date(fechaRetiro.getFullYear(), 0, 1);
  const fechaBaseCesantias = fechaIngreso > inicioAno ? fechaIngreso : inicioAno;
  const diasAno = Math.max(0, diasEntre(fechaBaseCesantias, fechaRetiro));
  const cesantias = (salario + auxilioMensual) * diasAno / 360;

  // === 4. Intereses sobre cesantías ===
  // Ley 52/1975: Las cesantías ya son el saldo proporcional acumulado.
  // Los intereses = saldo_cesantias * 12% * (días_del_período / 365)
  // No se multiplica por días otra vez — cesantias ya los incorpora.
  const interesesCesantias = cesantias * 0.12 * (diasAno / 365);

  // === 5. Vacaciones no disfrutadas ===
  // Art. 186 CST: 15 días hábiles por año = Salario * días_totales / 720
  const diasVacDisfrutados = parseInt(params.dias_vacaciones_disfrutados) || 0;
  const diasVacGanados = diasTotales * 15 / 360;
  const diasVacPendientes = Math.max(0, diasVacGanados - diasVacDisfrutados);
  const vacaciones = salarioDiario * diasVacPendientes;

  // === 6. Indemnización (solo despido sin justa causa) ===
  let indemnizacion = 0;
  let detalleIndemnizacion = 'No aplica';

  if (params.causa === 'despido_sin_justa_causa') {
    const anosCompletos = Math.floor(diasTotales / 360);
    const diasRestantes = diasTotales % 360;

    if (empleado.tipo_contrato === 'indefinido') {
      if (salario <= 10 * config.smmlv) {
        // Art. 64 CST: 20 días por primer año + 15 días por cada año adicional
        if (anosCompletos < 1) {
          // Menos de un año: mínimo 20 días
          indemnizacion = 20 * salarioDiario;
        } else {
          indemnizacion = 20 * salarioDiario; // primer año
          if (anosCompletos > 1) {
            indemnizacion += (anosCompletos - 1) * 15 * salarioDiario; // años adicionales completos
          }
          indemnizacion += (diasRestantes / 360) * 15 * salarioDiario; // fracción proporcional
        }
        detalleIndemnizacion = `Art. 64 CST (sal. <= 10 SMMLV): 20 días 1er año + 15 días/año adicional. ${anosCompletos} año(s), ${diasRestantes} días.`;
      } else {
        // Salario > 10 SMMLV: 15 días por primer año + 20 días por año adicional
        if (anosCompletos < 1) {
          indemnizacion = 15 * salarioDiario;
        } else {
          indemnizacion = 15 * salarioDiario;
          if (anosCompletos > 1) {
            indemnizacion += (anosCompletos - 1) * 20 * salarioDiario;
          }
          indemnizacion += (diasRestantes / 360) * 20 * salarioDiario;
        }
        detalleIndemnizacion = `Art. 64 CST (sal. > 10 SMMLV): 15 días 1er año + 20 días/año adicional. ${anosCompletos} año(s), ${diasRestantes} días.`;
      }
    } else if (empleado.tipo_contrato === 'fijo') {
      // Art. 64 CST: Salarios faltantes hasta vencimiento del contrato
      if (params.fecha_vencimiento_contrato) {
        const fechaVenc = new Date(params.fecha_vencimiento_contrato);
        const diasFaltantes = Math.max(0, diasEntre(fechaRetiro, fechaVenc));
        indemnizacion = salarioDiario * diasFaltantes;
        detalleIndemnizacion = `Art. 64 CST: Salarios faltantes hasta vencimiento (${diasFaltantes} días).`;
      } else {
        detalleIndemnizacion = 'Contrato fijo: ingrese fecha de vencimiento para calcular.';
      }
    } else if (empleado.tipo_contrato === 'obra') {
      indemnizacion = 0;
      detalleIndemnizacion = 'Art. 64 CST: No aplica indemnización para contrato por obra o labor.';
    }
  }

  const conceptos = {
    salario_ultimo_mes: salarioUltimoMes,
    auxilio_ultimo_mes: auxilioUltimoMes,
    prima_proporcional: prima,
    cesantias_proporcionales: cesantias,
    intereses_cesantias: interesesCesantias,
    vacaciones_pendientes: vacaciones,
    indemnizacion,
  };

  const totalLiquidacion = Object.values(conceptos).reduce((sum, v) => sum + v, 0);

  return {
    empleado_nombre: empleado.nombre,
    empleado_cedula: empleado.cedula,
    empleado_cargo: empleado.cargo,
    fecha_ingreso: empleado.fecha_ingreso,
    fecha_retiro: params.fecha_retiro,
    causa: params.causa,
    causa_label: CAUSAS_RETIRO.find(c => c.value === params.causa)?.label || params.causa,
    dias_totales_trabajados: diasTotales,
    dias_vacaciones_ganados: Math.round(diasVacGanados * 10) / 10,
    dias_vacaciones_pendientes: Math.round(diasVacPendientes * 10) / 10,
    conceptos,
    detalle_indemnizacion: detalleIndemnizacion,
    total_liquidacion: totalLiquidacion,
  };
}

/** Calcula días entre dos fechas (incluyendo ambos extremos) */
function diasEntre(desde, hasta) {
  const ms = hasta.getTime() - desde.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
