import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Download, Save, Info, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { calcularNomina } from '@/lib/nominaEngine';
import { generarDesprendiblePDF } from '@/lib/pdfGenerator';
import { formatCOP, MESES, CONCEPTOS } from '@/lib/constants';

const defaultNovedades = {
  horas_extra_diurna: 0, horas_extra_nocturna: 0,
  horas_extra_dom_diurna: 0, horas_extra_dom_nocturna: 0,
  horas_recargo_nocturno: 0, horas_recargo_dominical: 0,
  dias_incapacidad: 0, dias_licencia: 0,
  descuentos_adicionales: 0, descripcion_descuentos: '',
  bonificaciones: 0, comisiones: 0,
};

export default function NuevaLiquidacion({ empresaActiva, empleados, liquidaciones, config, onRefresh, onNavigate }) {
  const [empleadoId, setEmpleadoId] = useState('');
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [diasTrabajados, setDiasTrabajados] = useState(30);
  const [novedades, setNovedades] = useState({ ...defaultNovedades });
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [novedadesOpen, setNovedadesOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const activos = (empleados || []).filter(e => e.estado === 'activo');
  const empleadoActual = activos.find(e => e.id === empleadoId);

  const resultado = useMemo(() => {
    if (!empleadoActual || !config) return null;
    const empConTipo = { ...empleadoActual, _tipoEmpleador: empresaActiva?.tipo_empleador || 'juridica' };
    return calcularNomina(empConTipo, novedades, config, diasTrabajados);
  }, [empleadoActual, novedades, config, diasTrabajados, empresaActiva?.tipo_empleador]);

  const periodo = `${ano}-${mes.padStart(2, '0')}`;

  const updateNov = (key, value) => {
    setNovedades(prev => ({
      ...prev,
      [key]: key === 'descripcion_descuentos' ? value : (parseFloat(value) || 0),
    }));
  };

  const handleSave = async (estado) => {
    if (!resultado) { toast.error('Seleccione un empleado primero'); return; }

    // Fix #5: validar que no exista ya una liquidación para este empleado y período
    const duplicado = (liquidaciones || []).find(
      l => l.empleado_id === empleadoId && l.periodo === periodo
    );
    if (duplicado) {
      toast.error(`Ya existe una liquidación de ${resultado.empleado_nombre} para el período ${periodo}. Revise el historial.`);
      return;
    }

    setSaving(true);
    try {
      await api.createLiquidacion({
        empleado_id: empleadoId,
        empresa_id: empresaActiva.id,
        periodo,
        dias_trabajados: diasTrabajados,
        novedades,
        empleado_nombre: resultado.empleado_nombre,
        empleado_cedula: resultado.empleado_cedula,
        empleado_cargo: resultado.empleado_cargo,
        devengado: resultado.devengado,
        deducciones: resultado.deducciones,
        neto: resultado.neto,
        aportes_empleador: resultado.aportes_empleador,
        provisiones: resultado.provisiones,
        costo_total_empleador: resultado.costo_total_empleador,
        estado,
      });
      toast.success(`Liquidación guardada como ${estado}`);
      onRefresh();
      onNavigate('historial');
    } catch (err) {
      toast.error('Error al guardar liquidación');
    } finally {
      setSaving(false);
    }
  };

  const handlePDF = () => {
    if (!resultado) return;
    generarDesprendiblePDF({ ...resultado, periodo, dias_trabajados: diasTrabajados }, empresaActiva);
    toast.success('PDF generado');
  };

  return (
    <div data-testid="liquidacion-view" className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Liquidar Nómina</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Form */}
        <div className="space-y-4">
          {/* Basic data */}
          <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6 space-y-4">
            <h3 className="font-heading text-base font-medium flex items-center gap-2 text-white">
              <Calculator size={18} /> Datos básicos
            </h3>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Empleado</Label>
              <Select value={empleadoId} onValueChange={setEmpleadoId}>
                <SelectTrigger data-testid="select-empleado" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
                  <SelectValue placeholder="Seleccionar empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {activos.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nombre} — {e.cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {empleadoActual && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#A0A0A0]">
                <span>Salario: <span className="text-white font-medium">{formatCOP(empleadoActual.salario)}</span></span>
                <span>ARL: <span className="text-white">Nivel {empleadoActual.riesgo_arl}</span></span>
                <span>Contrato: <span className="text-white capitalize">{empleadoActual.tipo_contrato}</span></span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Mes</Label>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger data-testid="select-mes" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Año</Label>
                <Input data-testid="input-ano" type="number" value={ano} onChange={e => setAno(e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" />
              </div>
              <div>
                <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Días</Label>
                <Input data-testid="input-dias" type="number" value={diasTrabajados} onChange={e => setDiasTrabajados(parseInt(e.target.value) || 0)} min={0} max={30} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" />
              </div>
            </div>
          </Card>

          {/* Overtime */}
          <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
            <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6">
              <CollapsibleTrigger data-testid="toggle-extras" className="flex items-center justify-between w-full">
                <h3 className="font-heading text-base font-medium text-white">Horas extras y recargos</h3>
                <ChevronDown size={18} className={`text-[#A0A0A0] transition-transform duration-200 ${extrasOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-3">
                {[
                  { key: 'horas_extra_diurna', label: 'H. Extra diurna (25%)' },
                  { key: 'horas_extra_nocturna', label: 'H. Extra nocturna (75%)' },
                  { key: 'horas_extra_dom_diurna', label: 'H. Extra dom/fest diurna (100%)' },
                  { key: 'horas_extra_dom_nocturna', label: 'H. Extra dom/fest nocturna (150%)' },
                  { key: 'horas_recargo_nocturno', label: 'Recargo nocturno (35%)' },
                  { key: 'horas_recargo_dominical', label: 'Recargo dominical (100%)' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <Label className="text-sm text-[#A0A0A0] flex-1">{label}</Label>
                    <Input
                      data-testid={`input-${key}`}
                      type="number"
                      value={novedades[key] || ''}
                      onChange={e => updateNov(key, e.target.value)}
                      min={0}
                      className="w-20 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] text-right"
                      placeholder="0"
                    />
                    <span className="text-[10px] text-[#555555] w-6">hrs</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Novedades */}
          <Collapsible open={novedadesOpen} onOpenChange={setNovedadesOpen}>
            <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6">
              <CollapsibleTrigger data-testid="toggle-novedades" className="flex items-center justify-between w-full">
                <h3 className="font-heading text-base font-medium text-white">Novedades</h3>
                <ChevronDown size={18} className={`text-[#A0A0A0] transition-transform duration-200 ${novedadesOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Días incapacidad</Label>
                    <Input data-testid="input-incapacidad" type="number" value={novedades.dias_incapacidad || ''} onChange={e => updateNov('dias_incapacidad', e.target.value)} min={0} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Días licencia no rem.</Label>
                    <Input data-testid="input-licencia" type="number" value={novedades.dias_licencia || ''} onChange={e => updateNov('dias_licencia', e.target.value)} min={0} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" placeholder="0" />
                  </div>
                </div>
                <Separator className="bg-[#2A2A2A]" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Bonificaciones ($)</Label>
                    <Input data-testid="input-bonificaciones" type="number" value={novedades.bonificaciones || ''} onChange={e => updateNov('bonificaciones', e.target.value)} min={0} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Comisiones ($)</Label>
                    <Input data-testid="input-comisiones" type="number" value={novedades.comisiones || ''} onChange={e => updateNov('comisiones', e.target.value)} min={0} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" placeholder="0" />
                  </div>
                </div>
                <Separator className="bg-[#2A2A2A]" />
                <div>
                  <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Descuentos adicionales ($)</Label>
                  <Input data-testid="input-descuentos" type="number" value={novedades.descuentos_adicionales || ''} onChange={e => updateNov('descuentos_adicionales', e.target.value)} min={0} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" placeholder="0" />
                </div>
                <div>
                  <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Descripción descuentos</Label>
                  <Input data-testid="input-desc-descuentos" value={novedades.descripcion_descuentos} onChange={e => updateNov('descripcion_descuentos', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" placeholder="Ej: Préstamo, embargo..." />
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* RIGHT: Result */}
        <div className="space-y-4">
          {!resultado ? (
            <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-12 text-center">
              <Calculator size={48} className="mx-auto text-[#2A2A2A] mb-4" />
              <p className="text-[#A0A0A0] text-sm">Seleccione un empleado para ver el cálculo en tiempo real</p>
            </Card>
          ) : (
            <>
              {/* Pay stub preview */}
              <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-medium text-white">Desprendible de pago</h3>
                  <span className="text-xs text-[#A0A0A0]">{MESES[parseInt(mes) - 1]} {ano}</span>
                </div>
                <div className="text-xs text-[#A0A0A0]">
                  <p className="font-medium text-white text-sm">{resultado.empleado_nombre}</p>
                  <p>{resultado.empleado_cargo} — C.C. {resultado.empleado_cedula}</p>
                </div>

                <Separator className="bg-[#2A2A2A]" />

                {/* Devengados */}
                <div>
                  <h4 className="text-[10px] text-[#A0A0A0] uppercase tracking-widest mb-2">Devengados</h4>
                  <div className="space-y-1.5 text-sm">
                    <Row label="Salario" value={resultado.devengado.salario_proporcional} />
                    {resultado.devengado.auxilio_transporte > 0 && (
                      <Row label={<>Auxilio transporte <Tip text={CONCEPTOS.auxilio_transporte} /></>} value={resultado.devengado.auxilio_transporte} />
                    )}
                    {resultado.devengado.horas_extras > 0 && <Row label="Horas extras / recargos" value={resultado.devengado.horas_extras} />}
                    {resultado.devengado.bonificaciones > 0 && <Row label="Bonificaciones" value={resultado.devengado.bonificaciones} />}
                    {resultado.devengado.comisiones > 0 && <Row label="Comisiones" value={resultado.devengado.comisiones} />}
                    {resultado.devengado.descuento_incapacidad < 0 && <Row label="Desc. incapacidad" value={resultado.devengado.descuento_incapacidad} negative />}
                    {resultado.devengado.descuento_licencia < 0 && <Row label="Desc. licencia" value={resultado.devengado.descuento_licencia} negative />}
                    <div className="flex justify-between font-medium pt-1.5 border-t border-[#2A2A2A] text-white">
                      <span>Total devengado</span>
                      <span>{formatCOP(resultado.devengado.total)}</span>
                    </div>
                  </div>
                </div>

                <Separator className="bg-[#2A2A2A]" />

                {/* Deducciones */}
                <div>
                  <h4 className="text-[10px] text-[#A0A0A0] uppercase tracking-widest mb-2">Deducciones</h4>
                  <div className="space-y-1.5 text-sm">
                    <Row label={<>Salud 4% <Tip text={CONCEPTOS.salud_empleado} /></>} value={resultado.deducciones.salud} negative />
                    <Row label={<>Pensión 4% <Tip text={CONCEPTOS.pension_empleado} /></>} value={resultado.deducciones.pension} negative />
                    {resultado.deducciones.descuentos_adicionales > 0 && (
                      <Row label={`Otros: ${resultado.deducciones.descripcion_descuentos}`} value={resultado.deducciones.descuentos_adicionales} negative />
                    )}
                    <div className="flex justify-between font-medium pt-1.5 border-t border-[#2A2A2A]">
                      <span className="text-white">Total deducciones</span>
                      <span className="text-[#F87171]">-{formatCOP(resultado.deducciones.total)}</span>
                    </div>
                  </div>
                </div>

                <Separator className="bg-[#2A2A2A]" />

                {/* Neto */}
                <div className="flex justify-between items-center py-1">
                  <span className="font-heading text-lg font-semibold text-white">Neto a pagar</span>
                  <span data-testid="neto-a-pagar" className="font-heading text-2xl font-bold text-[#4ADE80]">{formatCOP(resultado.neto)}</span>
                </div>
              </Card>

              {/* Employer costs */}
              <Collapsible>
                <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6">
                  <CollapsibleTrigger data-testid="toggle-aportes" className="flex items-center justify-between w-full">
                    <h3 className="font-heading text-sm font-medium text-white">Aportes empleador</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#A0A0A0]">{formatCOP(resultado.aportes_empleador.total)}</span>
                      <ChevronDown size={14} className="text-[#A0A0A0]" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-1.5 text-sm">
                    <Row label="Salud (8.5%)" value={resultado.aportes_empleador.salud} />
                    <Row label="Pensión (12%)" value={resultado.aportes_empleador.pension} />
                    <Row label={<>ARL <Tip text={CONCEPTOS.arl} /></>} value={resultado.aportes_empleador.arl} />
                    <Row label="Caja compensación (4%)" value={resultado.aportes_empleador.caja_compensacion} />
                    <Row label="SENA (2%)" value={resultado.aportes_empleador.sena} />
                    <Row label="ICBF (3%)" value={resultado.aportes_empleador.icbf} />
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Provisions */}
              <Collapsible>
                <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6">
                  <CollapsibleTrigger data-testid="toggle-provisiones" className="flex items-center justify-between w-full">
                    <h3 className="font-heading text-sm font-medium text-white">Provisiones prestaciones</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#A0A0A0]">{formatCOP(resultado.provisiones.total)}</span>
                      <ChevronDown size={14} className="text-[#A0A0A0]" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-1.5 text-sm">
                    <Row label={<>Cesantías <Tip text={CONCEPTOS.cesantias} /></>} value={resultado.provisiones.cesantias} />
                    <Row label={<>Int. cesantías <Tip text={CONCEPTOS.intereses_cesantias} /></>} value={resultado.provisiones.intereses_cesantias} />
                    <Row label={<>Prima servicios <Tip text={CONCEPTOS.prima} /></>} value={resultado.provisiones.prima} />
                    <Row label={<>Vacaciones <Tip text={CONCEPTOS.vacaciones} /></>} value={resultado.provisiones.vacaciones} />
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Total cost */}
              <Card className="bg-[#1E1E1E] border-[#3A3A3A] rounded-[12px] p-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#A0A0A0]">Costo real total empleador</span>
                  <span data-testid="costo-total" className="font-heading text-lg font-semibold text-white">{formatCOP(resultado.costo_total_empleador)}</span>
                </div>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button data-testid="save-pendiente-btn" onClick={() => handleSave('pendiente')} disabled={saving} variant="outline" className="flex-1 border-[#2A2A2A] rounded-[8px] text-[#A0A0A0] hover:text-white">
                  <Save size={16} className="mr-2" /> Pendiente
                </Button>
                <Button data-testid="save-pagada-btn" onClick={() => handleSave('pagada')} disabled={saving} className="flex-1 bg-white text-black hover:bg-[#E0E0E0] rounded-[8px]">
                  <Save size={16} className="mr-2" /> Pagada
                </Button>
                <Button data-testid="download-pdf-btn" onClick={handlePDF} variant="outline" className="border-[#2A2A2A] rounded-[8px] text-[#A0A0A0] hover:text-white">
                  <Download size={16} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
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

function Row({ label, value, negative }) {
  const abs = Math.abs(typeof value === 'number' ? value : 0);
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#A0A0A0] flex items-center">{label}</span>
      <span className={negative ? 'text-[#F87171]' : 'text-[#F5F5F5]'}>
        {negative ? '-' : ''}{formatCOP(abs)}
      </span>
    </div>
  );
}
