import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserX, Download, Save, Info, Trash2, Eye, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCOP, CONCEPTOS } from '@/lib/constants';
import { calcularLiquidacionFinal, CAUSAS_RETIRO } from '@/lib/liquidacionFinal';
import { generarActaLiquidacionPDF } from '@/lib/pdfGenerator';

export default function LiquidacionFinal({ empresaActiva, empleados, config, onRefresh }) {
  const [empleadoId, setEmpleadoId] = useState('');
  const [fechaRetiro, setFechaRetiro] = useState(new Date().toISOString().split('T')[0]);
  const [causa, setCausa] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [diasVacDisfrutados, setDiasVacDisfrutados] = useState(0);
  const [saving, setSaving] = useState(false);
  const [liquidacionesFinal, setLiquidacionesFinal] = useState([]);
  const [detailLiq, setDetailLiq] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const activos = (empleados || []).filter(e => e.estado === 'activo');
  const empleadoActual = activos.find(e => e.id === empleadoId);

  useEffect(() => {
    if (empresaActiva) loadFinalLiqs();
  }, [empresaActiva?.id]);

  const loadFinalLiqs = async () => {
    try {
      const data = await api.getLiquidacionesFinal(empresaActiva.id);
      setLiquidacionesFinal(data);
    } catch (e) {
      toast.error('Error al cargar el historial de liquidaciones finales');
    }
  };

  const resultado = useMemo(() => {
    if (!empleadoActual || !config || !causa) return null;
    return calcularLiquidacionFinal(empleadoActual, {
      fecha_retiro: fechaRetiro,
      causa,
      fecha_vencimiento_contrato: fechaVencimiento,
      dias_vacaciones_disfrutados: diasVacDisfrutados,
    }, config);
  }, [empleadoActual, fechaRetiro, causa, fechaVencimiento, diasVacDisfrutados, config]);

  const handleSave = async () => {
    if (!resultado) { toast.error('Complete todos los campos'); return; }
    setSaving(true);
    try {
      await api.createLiquidacionFinal({
        empleado_id: empleadoId,
        empresa_id: empresaActiva.id,
        ...resultado,
      });
      toast.success('Liquidación final guardada. Empleado marcado como retirado.');
      setEmpleadoId('');
      setCausa('');
      onRefresh();
      loadFinalLiqs();
    } catch (err) {
      toast.error('Error al guardar liquidación final');
    } finally {
      setSaving(false);
    }
  };

  const handlePDF = () => {
    if (!resultado) return;
    generarActaLiquidacionPDF(resultado, empresaActiva);
    toast.success('PDF generado');
  };

  const handleDelete = async () => {
    try {
      await api.deleteLiquidacionFinal(deleteId);
      toast.success('Liquidación eliminada');
      setDeleteId(null);
      loadFinalLiqs();
    } catch (e) { toast.error('Error al eliminar'); }
  };

  const needsVencimiento = causa === 'despido_sin_justa_causa' && empleadoActual?.tipo_contrato === 'fijo';

  return (
    <div data-testid="liquidacion-final-view" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Liquidación Final</h1>
        <p className="text-[#A0A0A0] text-sm mt-1">Liquidación de prestaciones por retiro del empleado</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Form */}
        <div className="space-y-4">
          <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6 space-y-4">
            <h3 className="font-heading text-base font-medium flex items-center gap-2 text-white">
              <UserX size={18} /> Datos del retiro
            </h3>

            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Empleado</Label>
              <Select value={empleadoId} onValueChange={setEmpleadoId}>
                <SelectTrigger data-testid="select-empleado-final" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
                  <SelectValue placeholder="Seleccionar empleado activo..." />
                </SelectTrigger>
                <SelectContent>
                  {activos.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nombre} — {e.cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {empleadoActual && (
              <div className="bg-[#0A0A0A] rounded-[8px] p-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-[#A0A0A0]">Salario</span><span className="text-white font-medium">{formatCOP(empleadoActual.salario)}</span></div>
                <div className="flex justify-between"><span className="text-[#A0A0A0]">Ingreso</span><span className="text-white">{empleadoActual.fecha_ingreso}</span></div>
                <div className="flex justify-between"><span className="text-[#A0A0A0]">Contrato</span><span className="text-white capitalize">{empleadoActual.tipo_contrato}</span></div>
                <div className="flex justify-between"><span className="text-[#A0A0A0]">ARL</span><span className="text-white">Nivel {empleadoActual.riesgo_arl}</span></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Fecha de retiro</Label>
                <Input data-testid="input-fecha-retiro" type="date" value={fechaRetiro} onChange={e => setFechaRetiro(e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" />
              </div>
              <div>
                <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Causa</Label>
                <Select value={causa} onValueChange={setCausa}>
                  <SelectTrigger data-testid="select-causa" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CAUSAS_RETIRO.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {needsVencimiento && (
              <div>
                <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Fecha vencimiento contrato</Label>
                <Input data-testid="input-fecha-vencimiento" type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" />
              </div>
            )}

            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">
                Días de vacaciones ya disfrutados
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info size={12} className="inline ml-1 text-[#555555] cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-[#1E1E1E] border-[#2A2A2A] text-xs">
                    Ingrese el total de días hábiles de vacaciones que el empleado ya disfrutó durante su vinculación.
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input data-testid="input-vac-disfrutados" type="number" value={diasVacDisfrutados} onChange={e => setDiasVacDisfrutados(parseInt(e.target.value) || 0)} min={0} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" placeholder="0" />
            </div>

            {causa === 'despido_sin_justa_causa' && (
              <div className="flex items-start gap-2 bg-[rgba(248,113,113,0.05)] border border-[#F87171]/20 rounded-[8px] p-3">
                <AlertTriangle size={16} className="text-[#F87171] mt-0.5 shrink-0" />
                <p className="text-xs text-[#A0A0A0]">
                  Esta causa genera <span className="text-[#F87171] font-medium">indemnización</span> según Art. 64 del Código Sustantivo del Trabajo.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT: Result */}
        <div className="space-y-4">
          {!resultado ? (
            <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-12 text-center">
              <UserX size={48} className="mx-auto text-[#2A2A2A] mb-4" />
              <p className="text-[#A0A0A0] text-sm">Seleccione un empleado y causa de retiro</p>
            </Card>
          ) : (
            <>
              <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-medium text-white">Acta de Liquidación</h3>
                  <Badge variant="outline" className="text-[11px] bg-[rgba(248,113,113,0.1)] text-[#F87171] border-[#F87171]/20">
                    {resultado.causa_label}
                  </Badge>
                </div>

                <div className="text-xs text-[#A0A0A0] space-y-0.5">
                  <p className="font-medium text-white text-sm">{resultado.empleado_nombre}</p>
                  <p>{resultado.empleado_cargo} — C.C. {resultado.empleado_cedula}</p>
                  <p>Ingreso: {resultado.fecha_ingreso} — Retiro: {resultado.fecha_retiro}</p>
                  <p>Tiempo trabajado: <span className="text-white">{resultado.dias_totales_trabajados} días ({Math.floor(resultado.dias_totales_trabajados / 360)} años, {resultado.dias_totales_trabajados % 360} días)</span></p>
                </div>

                <Separator className="bg-[#2A2A2A]" />

                <div className="space-y-2 text-sm">
                  <h4 className="text-[10px] text-[#A0A0A0] uppercase tracking-widest mb-1">Conceptos</h4>
                  <Row label="Salario último mes" value={resultado.conceptos.salario_ultimo_mes} />
                  {resultado.conceptos.auxilio_ultimo_mes > 0 && (
                    <Row label="Auxilio transporte" value={resultado.conceptos.auxilio_ultimo_mes} />
                  )}
                  <Row label={<>Prima proporcional <Tip text={CONCEPTOS.prima} /></>} value={resultado.conceptos.prima_proporcional} />
                  <Row label={<>Cesantías proporcionales <Tip text={CONCEPTOS.cesantias} /></>} value={resultado.conceptos.cesantias_proporcionales} />
                  <Row label={<>Int. cesantías <Tip text={CONCEPTOS.intereses_cesantias} /></>} value={resultado.conceptos.intereses_cesantias} />
                  <Row label={
                    <>Vacaciones pendientes <Tip text={`${resultado.dias_vacaciones_pendientes} días hábiles pendientes de ${resultado.dias_vacaciones_ganados} ganados. ${CONCEPTOS.vacaciones}`} /></>
                  } value={resultado.conceptos.vacaciones_pendientes} />

                  {resultado.conceptos.indemnizacion > 0 && (
                    <>
                      <Separator className="bg-[#2A2A2A]" />
                      <Row
                        label={<>Indemnización <Tip text={resultado.detalle_indemnizacion} /></>}
                        value={resultado.conceptos.indemnizacion}
                        highlight
                      />
                    </>
                  )}
                  {resultado.conceptos.indemnizacion === 0 && causa === 'despido_sin_justa_causa' && empleadoActual?.tipo_contrato === 'obra' && (
                    <p className="text-xs text-[#A0A0A0] italic pt-1">{resultado.detalle_indemnizacion}</p>
                  )}
                </div>

                <Separator className="bg-[#2A2A2A]" />

                <div className="flex justify-between items-center py-1">
                  <span className="font-heading text-lg font-semibold text-white">Total liquidación</span>
                  <span data-testid="total-liquidacion-final" className="font-heading text-2xl font-bold text-[#4ADE80]">
                    {formatCOP(resultado.total_liquidacion)}
                  </span>
                </div>
              </Card>

              {resultado.conceptos.indemnizacion > 0 && (
                <Card className="bg-[#1E1E1E] border-[#3A3A3A] rounded-[12px] p-4">
                  <p className="text-xs text-[#A0A0A0]">{resultado.detalle_indemnizacion}</p>
                </Card>
              )}

              <div className="flex flex-wrap gap-3">
                <Button data-testid="save-liquidacion-final-btn" onClick={handleSave} disabled={saving} className="flex-1 bg-white text-black hover:bg-[#E0E0E0] rounded-[8px]">
                  <Save size={16} className="mr-2" /> Guardar y retirar empleado
                </Button>
                <Button data-testid="pdf-liquidacion-final-btn" onClick={handlePDF} variant="outline" className="border-[#2A2A2A] rounded-[8px] text-[#A0A0A0] hover:text-white">
                  <Download size={16} className="mr-2" /> PDF
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Previous final liquidations */}
      {liquidacionesFinal.length > 0 && (
        <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6">
          <h3 className="font-heading text-base font-medium text-white mb-4">Liquidaciones finales registradas</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Empleado</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Retiro</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Causa</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Total</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidacionesFinal.map(liq => (
                  <TableRow key={liq.id} className="border-[#2A2A2A] hover:bg-[#1E1E1E] transition-colors">
                    <TableCell className="font-medium text-white">{liq.empleado_nombre || '—'}</TableCell>
                    <TableCell className="text-[#A0A0A0]">{liq.fecha_retiro}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] bg-[rgba(248,113,113,0.1)] text-[#F87171] border-[#F87171]/20">
                        {liq.causa_label || liq.causa}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-[#4ADE80]">{formatCOP(liq.total_liquidacion || 0)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button data-testid={`view-final-${liq.id}`} variant="ghost" size="icon" onClick={() => setDetailLiq(liq)} className="h-8 w-8 text-[#A0A0A0] hover:text-white"><Eye size={14} /></Button>
                        <Button data-testid={`pdf-final-${liq.id}`} variant="ghost" size="icon" onClick={() => generarActaLiquidacionPDF(liq, empresaActiva)} className="h-8 w-8 text-[#A0A0A0] hover:text-white"><FileText size={14} /></Button>
                        <Button data-testid={`del-final-${liq.id}`} variant="ghost" size="icon" onClick={() => setDeleteId(liq.id)} className="h-8 w-8 text-[#A0A0A0] hover:text-[#F87171]"><Trash2 size={14} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailLiq} onOpenChange={open => !open && setDetailLiq(null)}>
        <DialogContent className="bg-[#141414] border-[#2A2A2A] rounded-[16px] max-w-lg max-h-[85vh] overflow-y-auto">
          {detailLiq && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading text-lg">Detalle de liquidación final</DialogTitle>
                <DialogDescription className="text-[#A0A0A0] text-sm">{detailLiq.empleado_nombre}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <div className="flex justify-between"><span className="text-[#A0A0A0]">Causa</span><span className="text-[#F87171]">{detailLiq.causa_label}</span></div>
                <div className="flex justify-between"><span className="text-[#A0A0A0]">Ingreso</span><span>{detailLiq.fecha_ingreso}</span></div>
                <div className="flex justify-between"><span className="text-[#A0A0A0]">Retiro</span><span>{detailLiq.fecha_retiro}</span></div>
                <div className="flex justify-between"><span className="text-[#A0A0A0]">Días trabajados</span><span>{detailLiq.dias_totales_trabajados}</span></div>
                <Separator className="bg-[#2A2A2A]" />
                {detailLiq.conceptos && Object.entries(detailLiq.conceptos).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#A0A0A0] capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className={v > 0 ? '' : 'text-[#555555]'}>{formatCOP(v)}</span>
                  </div>
                ))}
                <Separator className="bg-[#2A2A2A]" />
                <div className="flex justify-between font-heading font-semibold text-lg">
                  <span className="text-white">Total</span>
                  <span className="text-[#4ADE80]">{formatCOP(detailLiq.total_liquidacion || 0)}</span>
                </div>
                {detailLiq.detalle_indemnizacion && detailLiq.detalle_indemnizacion !== 'No aplica' && (
                  <p className="text-xs text-[#A0A0A0] italic mt-2">{detailLiq.detalle_indemnizacion}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#141414] border-[#2A2A2A] rounded-[16px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Eliminar liquidación final</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A0A0A0]">Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#2A2A2A] rounded-[8px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-final" onClick={handleDelete} className="bg-[#F87171] text-white hover:bg-[#ef4444] rounded-[8px]">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Tip({ text }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info size={13} className="text-[#555555] hover:text-[#A0A0A0] ml-1 inline cursor-help transition-colors" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-[#1E1E1E] border-[#2A2A2A] text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function Row({ label, value, highlight }) {
  const abs = Math.abs(typeof value === 'number' ? value : 0);
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#A0A0A0] flex items-center">{label}</span>
      <span className={highlight ? 'text-[#F87171] font-medium' : 'text-[#F5F5F5]'}>{formatCOP(abs)}</span>
    </div>
  );
}
