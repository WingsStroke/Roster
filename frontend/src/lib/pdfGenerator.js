import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCOP } from './constants';

/**
 * Genera el desprendible de pago (comprobante de nómina) en PDF.
 */
export function generarDesprendiblePDF(liquidacion, empresa) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.width;

  // Header empresa
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(empresa?.nombre || 'Empresa', pw / 2, 20, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIT: ${empresa?.nit || ''}`, pw / 2, 26, { align: 'center' });
  doc.text(empresa?.direccion || '', pw / 2, 31, { align: 'center' });

  // Línea separadora
  doc.setDrawColor(200);
  doc.line(14, 35, pw - 14, 35);

  // Título
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE DE NOMINA', pw / 2, 43, { align: 'center' });

  // Datos empleado
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const y0 = 52;
  doc.text(`Empleado: ${liquidacion.empleado_nombre || ''}`, 14, y0);
  doc.text(`Cedula: ${liquidacion.empleado_cedula || ''}`, 14, y0 + 5);
  doc.text(`Cargo: ${liquidacion.empleado_cargo || ''}`, 14, y0 + 10);
  doc.text(`Periodo: ${liquidacion.periodo || ''}`, pw - 14, y0, { align: 'right' });
  doc.text(`Dias trabajados: ${liquidacion.dias_trabajados || 30}`, pw - 14, y0 + 5, { align: 'right' });

  // Tabla devengados
  const devRows = [];
  const dev = liquidacion.devengado || {};
  devRows.push(['Salario base', formatCOP(dev.salario_proporcional || 0)]);
  if (dev.auxilio_transporte > 0) devRows.push(['Auxilio de transporte', formatCOP(dev.auxilio_transporte)]);
  if (dev.horas_extras > 0) devRows.push(['Horas extras y recargos', formatCOP(dev.horas_extras)]);
  if (dev.bonificaciones > 0) devRows.push(['Bonificaciones', formatCOP(dev.bonificaciones)]);
  if (dev.comisiones > 0) devRows.push(['Comisiones', formatCOP(dev.comisiones)]);
  if (dev.descuento_incapacidad < 0) devRows.push(['Descuento incapacidad', formatCOP(dev.descuento_incapacidad)]);
  if (dev.descuento_licencia < 0) devRows.push(['Descuento licencia', formatCOP(dev.descuento_licencia)]);
  devRows.push([{ content: 'TOTAL DEVENGADO', styles: { fontStyle: 'bold' } }, { content: formatCOP(dev.total || 0), styles: { fontStyle: 'bold' } }]);

  autoTable(doc, {
    startY: y0 + 18,
    head: [['DEVENGADOS', 'VALOR']],
    body: devRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30], textColor: [245, 245, 245], fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Tabla deducciones
  const dedRows = [];
  const ded = liquidacion.deducciones || {};
  dedRows.push(['Salud empleado (4%)', formatCOP(ded.salud || 0)]);
  dedRows.push(['Pension empleado (4%)', formatCOP(ded.pension || 0)]);
  if (ded.descuentos_adicionales > 0) {
    dedRows.push([`Otros: ${ded.descripcion_descuentos || ''}`, formatCOP(ded.descuentos_adicionales)]);
  }
  dedRows.push([{ content: 'TOTAL DEDUCCIONES', styles: { fontStyle: 'bold' } }, { content: formatCOP(ded.total || 0), styles: { fontStyle: 'bold' } }]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['DEDUCCIONES', 'VALOR']],
    body: dedRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30], textColor: [245, 245, 245], fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Neto a pagar
  const netoY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('NETO A PAGAR:', 14, netoY);
  doc.text(formatCOP(liquidacion.neto || 0), pw - 14, netoY, { align: 'right' });

  // Línea y firmas
  const firmaY = netoY + 30;
  doc.setDrawColor(100);
  doc.line(14, firmaY, 85, firmaY);
  doc.line(pw - 85, firmaY, pw - 14, firmaY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma Empleador', 14, firmaY + 5);
  doc.text('Firma Empleado', pw - 85, firmaY + 5);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    `Generado el ${new Date().toLocaleDateString('es-CO')} — NominaCol`,
    pw / 2, doc.internal.pageSize.height - 10, { align: 'center' }
  );

  const fileName = `nomina_${(liquidacion.empleado_nombre || 'empleado').replace(/\s+/g, '_')}_${liquidacion.periodo || 'periodo'}.pdf`;
  doc.save(fileName);
}


/**
 * Genera el acta de liquidación final (retiro) en PDF.
 */
export function generarActaLiquidacionPDF(liquidacion, empresa) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.width;

  // Header empresa
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(empresa?.nombre || 'Empresa', pw / 2, 20, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIT: ${empresa?.nit || ''}`, pw / 2, 26, { align: 'center' });
  doc.text(empresa?.direccion || '', pw / 2, 31, { align: 'center' });

  doc.setDrawColor(200);
  doc.line(14, 35, pw - 14, 35);

  // Título
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ACTA DE LIQUIDACION FINAL', pw / 2, 44, { align: 'center' });

  // Datos empleado
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const y0 = 54;
  doc.text(`Empleado: ${liquidacion.empleado_nombre || ''}`, 14, y0);
  doc.text(`Cedula: ${liquidacion.empleado_cedula || ''}`, 14, y0 + 5);
  doc.text(`Cargo: ${liquidacion.empleado_cargo || ''}`, 14, y0 + 10);
  doc.text(`Fecha ingreso: ${liquidacion.fecha_ingreso || ''}`, pw - 14, y0, { align: 'right' });
  doc.text(`Fecha retiro: ${liquidacion.fecha_retiro || ''}`, pw - 14, y0 + 5, { align: 'right' });
  doc.text(`Causa: ${liquidacion.causa_label || liquidacion.causa || ''}`, pw - 14, y0 + 10, { align: 'right' });
  doc.text(`Dias trabajados: ${liquidacion.dias_totales_trabajados || 0}`, 14, y0 + 15);

  // Tabla de conceptos
  const conceptos = liquidacion.conceptos || {};
  const rows = [
    ['Salario ultimo mes', formatCOP(conceptos.salario_ultimo_mes || 0)],
  ];
  if (conceptos.auxilio_ultimo_mes > 0) rows.push(['Auxilio de transporte', formatCOP(conceptos.auxilio_ultimo_mes)]);
  rows.push(['Prima de servicios proporcional', formatCOP(conceptos.prima_proporcional || 0)]);
  rows.push(['Cesantias proporcionales', formatCOP(conceptos.cesantias_proporcionales || 0)]);
  rows.push(['Intereses sobre cesantias', formatCOP(conceptos.intereses_cesantias || 0)]);
  rows.push(['Vacaciones pendientes', formatCOP(conceptos.vacaciones_pendientes || 0)]);
  if (conceptos.indemnizacion > 0) {
    rows.push([{ content: 'Indemnizacion', styles: { fontStyle: 'bold', textColor: [200, 50, 50] } }, { content: formatCOP(conceptos.indemnizacion), styles: { fontStyle: 'bold', textColor: [200, 50, 50] } }]);
  }
  rows.push([{ content: 'TOTAL A PAGAR', styles: { fontStyle: 'bold' } }, { content: formatCOP(liquidacion.total_liquidacion || 0), styles: { fontStyle: 'bold' } }]);

  autoTable(doc, {
    startY: y0 + 23,
    head: [['CONCEPTO', 'VALOR']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30], textColor: [245, 245, 245], fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Detalle indemnización
  if (liquidacion.detalle_indemnizacion && liquidacion.detalle_indemnizacion !== 'No aplica') {
    const detY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Nota: ${liquidacion.detalle_indemnizacion}`, 14, detY, { maxWidth: pw - 28 });
  }

  // Firmas
  const firmaY = doc.lastAutoTable.finalY + 30;
  doc.setDrawColor(100);
  doc.line(14, firmaY, 85, firmaY);
  doc.line(pw - 85, firmaY, pw - 14, firmaY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma Empleador', 14, firmaY + 5);
  doc.text('Firma Empleado', pw - 85, firmaY + 5);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    `Generado el ${new Date().toLocaleDateString('es-CO')} — NominaCol`,
    pw / 2, doc.internal.pageSize.height - 10, { align: 'center' }
  );

  const fileName = `liquidacion_final_${(liquidacion.empleado_nombre || 'empleado').replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}


/**
 * Genera un PDF consolidado con el resumen de nómina por lote.
 */
export function generarPDFLote({ periodo, empresa, calculos, totalNeto, totalCosto }) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.width;

  // Header empresa
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(empresa?.nombre || 'Empresa', pw / 2, 20, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIT: ${empresa?.nit || ''}`, pw / 2, 26, { align: 'center' });
  doc.text(empresa?.direccion || '', pw / 2, 31, { align: 'center' });

  doc.setDrawColor(200);
  doc.line(14, 35, pw - 14, 35);

  // Título
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN DE NOMINA — LIQUIDACION POR LOTES', pw / 2, 43, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periodo: ${periodo}`, pw / 2, 50, { align: 'center' });
  doc.text(`Empleados liquidados: ${calculos.length}`, pw / 2, 55, { align: 'center' });

  // Tabla principal
  const rows = calculos
    .filter(({ res }) => res)
    .map(({ emp, res }) => [
      emp.nombre,
      emp.cargo,
      { content: formatCOP(res.devengado.total), styles: { halign: 'right' } },
      { content: `-${formatCOP(res.deducciones.total)}`, styles: { halign: 'right', textColor: [220, 80, 80] } },
      { content: formatCOP(res.neto), styles: { halign: 'right', textColor: [30, 160, 80] } },
      { content: formatCOP(res.costo_total_empleador), styles: { halign: 'right' } },
    ]);

  // Fila de totales
  rows.push([
    { content: 'TOTALES', colSpan: 2, styles: { fontStyle: 'bold' } },
    '',
    '',
    { content: formatCOP(totalNeto), styles: { halign: 'right', fontStyle: 'bold', textColor: [30, 160, 80] } },
    { content: formatCOP(totalCosto), styles: { halign: 'right', fontStyle: 'bold' } },
  ]);

  autoTable(doc, {
    startY: 62,
    head: [['Empleado', 'Cargo', 'Devengado', 'Deducciones', 'Neto', 'Costo empleador']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30], textColor: [245, 245, 245], fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 35 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Resumen ejecutivo
  const sumY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen ejecutivo', 14, sumY);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  const totalDevengado = calculos.reduce((s, { res }) => s + (res?.devengado?.total || 0), 0);
  const totalDeducciones = calculos.reduce((s, { res }) => s + (res?.deducciones?.total || 0), 0);
  const totalAportes = calculos.reduce((s, { res }) => s + (res?.aportes_empleador?.total || 0), 0);
  const totalProvisiones = calculos.reduce((s, { res }) => s + (res?.provisiones?.total || 0), 0);

  const resRows = [
    ['Total devengado empleados', formatCOP(totalDevengado)],
    ['Total deducciones empleados', `-${formatCOP(totalDeducciones)}`],
    ['Total neto a pagar', formatCOP(totalNeto)],
    ['Aportes parafiscales empleador', formatCOP(totalAportes)],
    ['Provisiones prestaciones', formatCOP(totalProvisiones)],
    [{ content: 'Costo real total empresa', styles: { fontStyle: 'bold' } }, { content: formatCOP(totalCosto), styles: { fontStyle: 'bold' } }],
  ];

  autoTable(doc, {
    startY: sumY + 5,
    body: resRows,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: pw / 2 + 10 },
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    `Generado el ${new Date().toLocaleDateString('es-CO')} — NominaCol`,
    pw / 2, doc.internal.pageSize.height - 10, { align: 'center' }
  );

  doc.save(`nomina_lote_${periodo}.pdf`);
}
