import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Layers, Save, Download, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { calcularNomina } from '@/lib/nominaEngine';
import { generarPDFLote } from '@/lib/pdfGenerator';
import { formatCOP, MESES } from '@/lib/constants';

const defaultNov = {
  dias_trabajados: 30,
  horas_extra_diurna: 0, horas_extra_nocturna: 0,
  horas_extra_dom_diurna: 0, horas_extra_dom_nocturna: 0,
  horas_recargo_nocturno: 0, horas_recargo_dominical: 0,
  dias_incapacidad: 0, dias_licencia: 0,
  bonificaciones: 0, comisiones: 0,
  descuentos_adicionales: 0, descripcion_descuentos: '',
};

export default function LiquidacionLote({ empresaActiva, empleados, liquidaciones, config, onRefresh, onNavigate }) {
  const now = new Date();
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [seleccionados, setSeleccionados] = useState({});
  const [novedades, setNovedades] = useState({});
  const [expandidos, setExpandidos] = useState({});
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState(null);

  const activos = (empleados || []).filter(e => e.estado === 'activo');
  const periodo = `${ano}-${mes.padStart(2, '0')}`;

  // Detectar empleados ya liquidados en este período
  const yaLiquidados = useMemo(() => {
    const set = new Set();
    (liquidaciones || []).forEach(l => {
      if (l.periodo === periodo) set.add(l.empleado_id);
    });
    return set;
  }, [liquidaciones, periodo]);

  const empleadosDisponibles = activos.filter(e => !yaLiquidados.has(e.id));
  const empleadosConflicto = activos.filter(e => yaLiquidados.has(e.id));

  const todosSeleccionados = empleadosDisponibles.length > 0 &&
    empleadosDisponibles.every(e => seleccionados[e.id]);

  const toggleTodos = () => {
    if (todosSeleccionados) {
      setSeleccionados({});
    } else {
      const nuevo = {};
      empleadosDisponibles.forEach(e => { nuevo[e.id] = true; });
      setSeleccionados(nuevo);
    }
  };

  const toggleEmp = (id) => {
    setSeleccionados(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getNov = (empId) => novedades[empId] || { ...defaultNov };

  const updateNov = (empId, key, value) => {
    setNovedades(prev => ({
      ...prev,
      [empId]: {
        ...getNov(empId),
        [key]: key === 'descripcion_descuentos' ? value : (parseFloat(value) || 0),
      },
    }));
  };

  const empSeleccionados = empleadosDisponibles.filter(e => seleccionados[e.id]);

  // Calcular resultados en tiempo real para todos los seleccionados
  const calculos = useMemo(() => {
    const map = {};
    empSeleccionados.forEach(emp => {
      const nov = getNov(emp.id);
      const dias = nov.dias_trabajados || 30;
      const empConTipo = { ...emp, _tipoEmpleador: empresaActiva?.tipo_empleador || 'juridica' };
      map[emp.id] = calcularNomina(empConTipo, nov, config, dias);
    });
    return map;
  }, [empSeleccionados, novedades, config]);

  const totalNeto = Object.values(calculos).reduce((s, r) => s + (r?.neto || 0), 0);
  const totalCosto = Object.values(calculos).reduce((s, r) => s + (r?.costo_total_empleador || 0), 0);

  const handleGuardar = async () => {
    if (empSeleccionados.length === 0) {
      toast.error('Seleccione al menos un empleado');
      return;
    }
    setSaving(true);
    try {
      const promesas = empSeleccionados.map(emp => {
        const r = calculos[emp.id];
        const nov = getNov(emp.id);
        if (!r) return Promise.resolve(null);
        return api.createLiquidacion({
          empleado_id: emp.id,
          empresa_id: empresaActiva.id,
          periodo,
          dias_trabajados: nov.dias_trabajados || 30,
          novedades: nov,
          empleado_nombre: r.empleado_nombre,
          empleado_cedula: r.empleado_cedula,
          empleado_cargo: r.empleado_cargo,
          devengado: r.devengado,
          deducciones: r.deducciones,
          neto: r.neto,
          aportes_empleador: r.aportes_empleador,
          provisiones: r.provisiones,
          costo_total_empleador: r.costo_total_empleador,
          estado: 'pendiente',
        });
      });

      const guardadas = await Promise.all(promesas);
      const exitosas = guardadas.filter(Boolean);

      setResultado({
        periodo,
        empresa: empresaActiva,
        liquidaciones: exitosas,
        calculos: empSeleccionados.map(emp => ({ emp, res: calculos[emp.id] })),
        totalNeto,
        totalCosto,
      });

      toast.success(`${exitosas.length} liquidaciones guardadas exitosamente`);
      onRefresh();
    } catch (err) {
      toast.error('Error al guardar algunas liquidaciones');
    } finally {
      setSaving(false);
    }
  };

  const handlePDF = () => {
    if (!resultado) return;
    generarPDFLote(resultado);
    toast.success('PDF consolidado generado');
  };

  // --- PANTALLA DE RESULTADO ---
  if (resultado) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Lote completado</h1>
            <p className="text-[#A0A0A0] text-sm mt-1">{resultado.periodo} — {resultado.calculos.length} empleados liquidados</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handlePDF} variant="outline" className="border-[#2A2A2A] rounded-[8px] text-[#A0A0A0] hover:text-white">
              <Download size={16} className="mr-2" /> PDF consolidado
            </Button>
            <Button onClick={() => onNavigate('historial')} className="bg-white text-black hover:bg-[#E0E0E0] rounded-[8px]">
              Ver historial
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Empleados liquidados', value: resultado.calculos.length },
            { label: 'Total neto a pagar', value: formatCOP(resultado.totalNeto) },
            { label: 'Costo total empleador', value: formatCOP(resultado.totalCosto) },
          ].map((c, i) => (
            <Card key={i} className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-5">
              <p className="text-[10px] text-[#A0A0A0] uppercase tracking-widest">{c.label}</p>
              <p className="font-heading text-2xl font-semibold text-white mt-2">{c.value}</p>
            </Card>
          ))}
        </div>

        <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Empleado</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Devengado</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Deducciones</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Neto</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Costo empleador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.calculos.map(({ emp, res }) => res && (
                  <TableRow key={emp.id} className="border-[#2A2A2A] hover:bg-[#1E1E1E]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                          {emp.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{emp.nombre}</p>
                          <p className="text-xs text-[#A0A0A0]">{emp.cargo}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCOP(res.devengado.total)}</TableCell>
                    <TableCell className="text-right text-sm text-[#F87171]">-{formatCOP(res.deducciones.total)}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-[#4ADE80]">{formatCOP(res.neto)}</TableCell>
                    <TableCell className="text-right text-sm text-[#A0A0A0]">{formatCOP(res.costo_total_empleador)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Totales */}
          <div className="border-t border-[#2A2A2A] px-4 py-3 flex justify-end gap-8 text-sm">
            <span className="text-[#A0A0A0]">Total neto: <span className="text-[#4ADE80] font-medium">{formatCOP(resultado.totalNeto)}</span></span>
            <span className="text-[#A0A0A0]">Costo total: <span className="text-white font-medium">{formatCOP(resultado.totalCosto)}</span></span>
          </div>
        </Card>
      </div>
    );
  }

  // --- PANTALLA PRINCIPAL ---
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Liquidación por lotes</h1>
        <p className="text-[#A0A0A0] text-sm mt-1">Liquida la nómina de varios empleados en un solo paso</p>
      </div>

      {/* Período */}
      <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6">
        <h3 className="font-heading text-base font-medium text-white mb-4 flex items-center gap-2">
          <Layers size={18} /> Período de liquidación
        </h3>
        <div className="flex gap-4 flex-wrap">
          <div className="w-48">
            <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Mes</Label>
            <Select value={mes} onValueChange={v => { setMes(v); setSeleccionados({}); setResultado(null); }}>
              <SelectTrigger className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Año</Label>
            <Input type="number" value={ano} onChange={e => { setAno(e.target.value); setSeleccionados({}); }} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]" />
          </div>
          {empSeleccionados.length > 0 && (
            <div className="flex items-end pb-0.5 gap-4">
              <div className="text-sm text-[#A0A0A0]">
                <span className="text-white font-medium">{empSeleccionados.length}</span> empleados · Neto total: <span className="text-[#4ADE80] font-medium">{formatCOP(totalNeto)}</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Aviso de conflictos */}
      {empleadosConflicto.length > 0 && (
        <div className="flex items-start gap-3 bg-[rgba(251,191,36,0.05)] border border-[#FBBF24]/20 rounded-[10px] p-4">
          <AlertTriangle size={16} className="text-[#FBBF24] mt-0.5 shrink-0" />
          <p className="text-sm text-[#A0A0A0]">
            <span className="text-[#FBBF24] font-medium">{empleadosConflicto.length} empleado{empleadosConflicto.length > 1 ? 's' : ''}</span> ya {empleadosConflicto.length > 1 ? 'tienen' : 'tiene'} liquidación para {MESES[parseInt(mes) - 1]} {ano}: {empleadosConflicto.map(e => e.nombre.split(' ')[0]).join(', ')}. No aparecen en la lista.
          </p>
        </div>
      )}

      {/* Tabla de selección y novedades */}
      <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] overflow-hidden">
        {/* Header con seleccionar todos */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2 cursor-pointer" onClick={toggleTodos}>
            {todosSeleccionados
              ? <CheckSquare size={18} className="text-white" />
              : <Square size={18} className="text-[#A0A0A0]" />}
            <span className="text-sm text-[#A0A0A0] select-none">
              {todosSeleccionados ? 'Deseleccionar todos' : `Seleccionar todos (${empleadosDisponibles.length})`}
            </span>
          </div>
        </div>

        {empleadosDisponibles.length === 0 ? (
          <div className="text-center py-12 text-[#A0A0A0] text-sm">
            Todos los empleados ya tienen liquidación para este período.
          </div>
        ) : (
          <div className="divide-y divide-[#2A2A2A]">
            {empleadosDisponibles.map(emp => {
              const sel = !!seleccionados[emp.id];
              const nov = getNov(emp.id);
              const exp = !!expandidos[emp.id];
              const res = sel ? calculos[emp.id] : null;

              return (
                <Collapsible key={emp.id} open={exp && sel} onOpenChange={v => sel && setExpandidos(prev => ({ ...prev, [emp.id]: v }))}>
                  <div className={`px-4 py-3 transition-colors ${sel ? 'bg-[#1A1A1A]' : ''}`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Checkbox */}
                      <Checkbox
                        checked={sel}
                        onCheckedChange={() => toggleEmp(emp.id)}
                        className="border-[#2A2A2A] data-[state=checked]:bg-white data-[state=checked]:border-white data-[state=checked]:text-black"
                      />
                      {/* Avatar + nombre */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                          {emp.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{emp.nombre}</p>
                          <p className="text-xs text-[#A0A0A0] truncate">{emp.cargo} · {formatCOP(emp.salario)}</p>
                        </div>
                      </div>
                      {/* Días trabajados (inline) */}
                      {sel && (
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest whitespace-nowrap">Días</Label>
                          <Input
                            type="number"
                            value={nov.dias_trabajados}
                            onChange={e => updateNov(emp.id, 'dias_trabajados', e.target.value)}
                            min={0} max={30}
                            className="w-16 bg-[#0A0A0A] border-[#2A2A2A] rounded-[6px] text-center text-sm h-8"
                          />
                        </div>
                      )}
                      {/* Neto calculado */}
                      {res && (
                        <div className="text-right">
                          <p className="text-xs text-[#A0A0A0]">Neto</p>
                          <p className="text-sm font-medium text-[#4ADE80]">{formatCOP(res.neto)}</p>
                        </div>
                      )}
                      {/* Expandir novedades */}
                      {sel && (
                        <CollapsibleTrigger asChild>
                          <button
                            onClick={() => setExpandidos(prev => ({ ...prev, [emp.id]: !prev[emp.id] }))}
                            className="flex items-center gap-1 text-[11px] text-[#A0A0A0] hover:text-white transition-colors ml-1"
                          >
                            Novedades
                            <ChevronDown size={14} className={`transition-transform duration-200 ${exp ? 'rotate-180' : ''}`} />
                          </button>
                        </CollapsibleTrigger>
                      )}
                    </div>

                    {/* Panel de novedades expandible */}
                    <CollapsibleContent>
                      <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          {[
                            { key: 'horas_extra_diurna', label: 'H. extra diurna' },
                            { key: 'horas_extra_nocturna', label: 'H. extra nocturna' },
                            { key: 'horas_extra_dom_diurna', label: 'H. extra dom. diurna' },
                            { key: 'horas_extra_dom_nocturna', label: 'H. extra dom. nocturna' },
                            { key: 'horas_recargo_nocturno', label: 'Recargo nocturno' },
                            { key: 'horas_recargo_dominical', label: 'Recargo dominical' },
                            { key: 'dias_incapacidad', label: 'Días incapacidad' },
                            { key: 'dias_licencia', label: 'Días licencia' },
                            { key: 'bonificaciones', label: 'Bonificaciones ($)' },
                            { key: 'comisiones', label: 'Comisiones ($)' },
                            { key: 'descuentos_adicionales', label: 'Descuentos ($)' },
                          ].map(({ key, label }) => (
                            <div key={key}>
                              <Label className="text-[#A0A0A0] text-[9px] uppercase tracking-widest">{label}</Label>
                              <Input
                                type="number"
                                value={nov[key] || ''}
                                onChange={e => updateNov(emp.id, key, e.target.value)}
                                min={0}
                                placeholder="0"
                                className="mt-1 bg-[#0A0A0A] border-[#2A2A2A] rounded-[6px] h-8 text-sm"
                              />
                            </div>
                          ))}
                          <div className="sm:col-span-2">
                            <Label className="text-[#A0A0A0] text-[9px] uppercase tracking-widest">Descripción descuentos</Label>
                            <Input
                              value={nov.descripcion_descuentos}
                              onChange={e => updateNov(emp.id, 'descripcion_descuentos', e.target.value)}
                              placeholder="Ej: préstamo, embargo..."
                              className="mt-1 bg-[#0A0A0A] border-[#2A2A2A] rounded-[6px] h-8 text-sm"
                            />
                          </div>
                        </div>
                        {/* Resumen del cálculo */}
                        {res && (
                          <div className="mt-3 pt-3 border-t border-[#2A2A2A] flex flex-wrap gap-5 text-xs text-[#A0A0A0]">
                            <span>Devengado: <span className="text-white">{formatCOP(res.devengado.total)}</span></span>
                            <span>Deducciones: <span className="text-[#F87171]">-{formatCOP(res.deducciones.total)}</span></span>
                            <span>Neto: <span className="text-[#4ADE80] font-medium">{formatCOP(res.neto)}</span></span>
                            <span>Costo empleador: <span className="text-white">{formatCOP(res.costo_total_empleador)}</span></span>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </Card>

      {/* Botón guardar */}
      {empSeleccionados.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleGuardar}
            disabled={saving}
            className="bg-white text-black hover:bg-[#E0E0E0] rounded-[8px] px-8"
          >
            <Save size={16} className="mr-2" />
            {saving ? 'Guardando...' : `Guardar ${empSeleccionados.length} liquidacion${empSeleccionados.length > 1 ? 'es' : ''}`}
          </Button>
        </div>
      )}
    </div>
  );
}
