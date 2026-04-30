import { ARL_RATES, EXTRAS, DEDUCCIONES, APORTES_EMPLEADOR } from './constants';

/**
 * Motor de cálculos de nómina mensual — Colombia 2026
 * Cada fórmula referencia su base legal en comentarios.
 */

/**
 * Calcula la nómina mensual completa para un empleado.
 * @param {Object} empleado - Datos del empleado (salario, riesgo_arl, auxilio_transporte)
 * @param {Object} novedades - Horas extras, incapacidades, bonificaciones, etc.
 * @param {Object} config - Configuración legal (smmlv, auxilio_transporte, jornada_horas)
 * @param {number} diasTrabajados - Días trabajados en el mes (máx 30)
 * @returns {Object} Desglose completo: devengado, deducciones, neto, aportes, provisiones
 */
export function calcularNomina(empleado, novedades = {}, config, diasTrabajados = 30) {
  if (!empleado || !config) return null;

  const salario = empleado.salario || 0;
  // Jornada máxima semanal = 44 horas (Ley 2101/2021, desde julio 2025)
  // Horas mes = 44 * 52 / 12 = 190.67
  const horasMes = (config.jornada_horas || 44) * 52 / 12;
  // Art. 134 CST: Hora ordinaria = Salario mensual / horas mensuales
  const horaOrdinaria = salario / horasMes;

  // Salario proporcional a días trabajados (base 30 días/mes)
  const salarioProporcional = (salario / 30) * diasTrabajados;

  // Auxilio de transporte: Art. 2 Ley 1 de 1963
  // Aplica si salario <= 2 * SMMLV ($3.501.810 en 2026)
  const aplicaAuxilio = empleado.auxilio_transporte && salario <= (2 * config.smmlv);
  const auxilioTransporte = aplicaAuxilio ? (config.auxilio_transporte / 30) * diasTrabajados : 0;

  // Horas extras y recargos (CST Art. 168-172)
  const extrasResult = calcularExtras(horaOrdinaria, novedades);

  const bonificaciones = parseFloat(novedades.bonificaciones) || 0;
  const comisiones = parseFloat(novedades.comisiones) || 0;

  // Incapacidad: empleador paga días 1-2 al 100%, EPS paga desde día 3
  // Art. 227 CST y Art. 1 Decreto 2943/2013
  const diasIncapacidad = parseInt(novedades.dias_incapacidad) || 0;
  const diasLicencia = parseInt(novedades.dias_licencia) || 0;

  const descuentoIncapacidad = diasIncapacidad > 2
    ? (salario / 30) * (diasIncapacidad - 2)
    : 0;
  const descuentoLicencia = (salario / 30) * diasLicencia;

  // Devengado total
  const totalDevengado = salarioProporcional + auxilioTransporte + extrasResult.total
    + bonificaciones + comisiones - descuentoIncapacidad - descuentoLicencia;

  const devengado = {
    salario_proporcional: salarioProporcional,
    auxilio_transporte: auxilioTransporte,
    horas_extras: extrasResult.total,
    bonificaciones,
    comisiones,
    descuento_incapacidad: -descuentoIncapacidad,
    descuento_licencia: -descuentoLicencia,
    detalle_extras: extrasResult.detalle,
    total: totalDevengado,
  };

  // Base para deducciones: salario + extras + comisiones, SIN auxilio de transporte
  // Art. 18 Ley 100/1993
  const baseDeducciones = salarioProporcional + extrasResult.total + comisiones
    - descuentoIncapacidad - descuentoLicencia;

  // Deducciones empleado (Art. 204 y 17 Ley 100/1993)
  const saludEmpleado = baseDeducciones * DEDUCCIONES.SALUD_EMPLEADO;
  const pensionEmpleado = baseDeducciones * DEDUCCIONES.PENSION_EMPLEADO;
  const descuentosAdicionales = parseFloat(novedades.descuentos_adicionales) || 0;

  const deducciones = {
    salud: saludEmpleado,
    pension: pensionEmpleado,
    descuentos_adicionales: descuentosAdicionales,
    descripcion_descuentos: novedades.descripcion_descuentos || '',
    total: saludEmpleado + pensionEmpleado + descuentosAdicionales,
  };

  // Neto a pagar al empleado
  const neto = totalDevengado - deducciones.total;

  // Aportes empleador (Art. 204 Ley 100, Decreto 1295/1994, Ley 21/1982)
  const arlRate = ARL_RATES[empleado.riesgo_arl] || ARL_RATES['I'];
  const saludEmpleador = baseDeducciones * APORTES_EMPLEADOR.SALUD;
  const pensionEmpleador = baseDeducciones * APORTES_EMPLEADOR.PENSION;
  const arlEmpleador = baseDeducciones * arlRate;
  const cajaCompensacion = baseDeducciones * APORTES_EMPLEADOR.CAJA_COMPENSACION;

  // Exoneración parafiscales: Art. 114-1 ET (Ley 1819/2016)
  // Condición 1 — salario: empleado debe ganar < 10 SMMLV individualmente
  // Condición 2 — tipo empleador:
  //   'juridica'       → persona jurídica declarante de renta: exonerada
  //   'natural_2_mas'  → persona natural con ≥2 trabajadores: exonerada
  //   'natural_1'      → persona natural con 1 solo trabajador: NO exonerada
  //   'no_declarante'  → entidades no declarantes (cooperativas, etc.): NO exoneradas
  const tipoEmpleador = empleado._tipoEmpleador || 'juridica'; // default conservador
  const salarioMenorLimite = salario < (10 * config.smmlv);
  const empleadorExonerado = tipoEmpleador === 'juridica' || tipoEmpleador === 'natural_2_mas';
  const exonerado = salarioMenorLimite && empleadorExonerado;
  const sena = exonerado ? 0 : baseDeducciones * APORTES_EMPLEADOR.SENA;
  const icbf = exonerado ? 0 : baseDeducciones * APORTES_EMPLEADOR.ICBF;

  const aportesEmpleador = {
    salud: saludEmpleador,
    pension: pensionEmpleador,
    arl: arlEmpleador,
    caja_compensacion: cajaCompensacion,
    sena,
    icbf,
    total: saludEmpleador + pensionEmpleador + arlEmpleador + cajaCompensacion + sena + icbf,
  };

  // Provisiones prestaciones sociales mensuales
  // Base: Salario + Auxilio de transporte (excepto vacaciones)
  const baseProvision = salarioProporcional + auxilioTransporte;

  // Cesantías: Art. 249 CST — (Sal + Aux) * días / 360
  const cesantias = baseProvision * diasTrabajados / 360;
  // Intereses cesantías: Ley 52/1975 — 12% anual
  const interesesCesantias = cesantias * 0.12 / 12;
  // Prima de servicios: Art. 306 CST — (Sal + Aux) * días / 360
  const prima = baseProvision * diasTrabajados / 360;
  // Vacaciones: Art. 186 CST — Salario / 720 * días (sin auxilio)
  const vacaciones = salarioProporcional * diasTrabajados / 720;

  const provisiones = {
    cesantias,
    intereses_cesantias: interesesCesantias,
    prima,
    vacaciones,
    total: cesantias + interesesCesantias + prima + vacaciones,
  };

  const costoTotalEmpleador = neto + deducciones.total + aportesEmpleador.total + provisiones.total;

  return {
    empleado_nombre: empleado.nombre,
    empleado_cedula: empleado.cedula,
    empleado_cargo: empleado.cargo,
    hora_ordinaria: horaOrdinaria,
    dias_trabajados: diasTrabajados,
    devengado,
    deducciones,
    neto,
    aportes_empleador: aportesEmpleador,
    provisiones,
    costo_total_empleador: costoTotalEmpleador,
  };
}

function calcularExtras(horaOrdinaria, novedades) {
  const detalle = [];
  let total = 0;

  const items = [
    { key: 'horas_extra_diurna', label: 'Horas extras diurnas', factor: EXTRAS.EXTRA_DIURNA, factorLabel: '125%' },
    { key: 'horas_extra_nocturna', label: 'Horas extras nocturnas', factor: EXTRAS.EXTRA_NOCTURNA, factorLabel: '175%' },
    { key: 'horas_extra_dom_diurna', label: 'H. extras dom/fest diurnas', factor: EXTRAS.EXTRA_DOM_DIURNA, factorLabel: '200%' },
    { key: 'horas_extra_dom_nocturna', label: 'H. extras dom/fest nocturnas', factor: EXTRAS.EXTRA_DOM_NOCTURNA, factorLabel: '250%' },
    { key: 'horas_recargo_nocturno', label: 'Recargo nocturno', factor: EXTRAS.RECARGO_NOCTURNO, factorLabel: '35%' },
    { key: 'horas_recargo_dominical', label: 'Recargo dominical/festivo', factor: EXTRAS.RECARGO_DOMINICAL, factorLabel: '100%' },
  ];

  for (const item of items) {
    const horas = parseFloat(novedades[item.key]) || 0;
    if (horas > 0) {
      const valor = horaOrdinaria * item.factor * horas;
      detalle.push({ concepto: item.label, horas, factor: item.factorLabel, valor });
      total += valor;
    }
  }

  return { detalle, total };
}
