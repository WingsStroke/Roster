import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { 
  X, 
  Save, 
  Clock, 
  CalendarDays,
  Stethoscope,
  Umbrella,
  Plane,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Moon,
  Sun
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { asistenciaDiariaUpdateSchema } from '@/lib/validationSchemas';

/**
 * Diálogo para editar un día específico de asistencia.
 * Permite cambiar el estado, horas de entrada/salida y minutos de almuerzo.
 */
export default function DialogoDiaAsistencia({ dia, empleado, onGuardar, onCerrar }) {
  const [calculoPreview, setCalculoPreview] = useState(null);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('asistio');

  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue, 
    formState: { errors, isSubmitting },
    reset
  } = useForm({
    resolver: zodResolver(asistenciaDiariaUpdateSchema),
    defaultValues: {
      estado: dia.asistencia?.estado || 'asistio',
      hora_entrada: dia.asistencia?.hora_entrada || empleado?.horario?.hora_entrada_default || '08:00',
      hora_salida: dia.asistencia?.hora_salida || empleado?.horario?.hora_salida_default || '17:00',
      minutos_almuerzo: dia.asistencia?.minutos_almuerzo || empleado?.horario?.minutos_almuerzo_default || 60,
    }
  });

  // Observar cambios para recalcular preview
  const horaEntrada = watch('hora_entrada');
  const horaSalida = watch('hora_salida');
  const minutosAlmuerzo = watch('minutos_almuerzo');
  const estado = watch('estado');

  // Recalcular preview cuando cambian los valores
  useEffect(() => {
    if (estado === 'asistio' && horaEntrada && horaSalida) {
      const calculo = calcularPreview(horaEntrada, horaSalida, minutosAlmuerzo || 0);
      setCalculoPreview(calculo);
    } else {
      setCalculoPreview(null);
    }
  }, [horaEntrada, horaSalida, minutosAlmuerzo, estado]);

  // Actualizar estado seleccionado cuando cambia
  useEffect(() => {
    setEstadoSeleccionado(estado);
  }, [estado]);

  // Cálculo de preview
  const calcularPreview = (entrada, salida, almuerzoMin) => {
    const entradaDec = convertirADecimal(entrada);
    const salidaDec = convertirADecimal(salida);
    
    if (salidaDec <= entradaDec) {
      return { error: 'Hora de salida debe ser mayor a hora de entrada' };
    }

    let horasTotal;
    if (salidaDec > entradaDec) {
      horasTotal = salidaDec - entradaDec;
    } else {
      horasTotal = (24 - entradaDec) + salidaDec;
    }

    const horasAlmuerzo = almuerzoMin / 60;
    const horasTrabajadas = Math.max(0, horasTotal - horasAlmuerzo);
    
    // Horas nocturnas (21:00 - 06:00)
    const horasNocturnas = calcularHorasNocturnas(entradaDec, salidaDec);
    const horasDiurnas = Math.max(0, horasTrabajadas - horasNocturnas);
    
    // Jornada legal del empleado
    const jornadaLegal = empleado?.horario?.jornada_diaria_horas || 8;
    
    // Horas extras
    const horasExtras = Math.max(0, horasTrabajadas - jornadaLegal);
    const proporcionNocturna = horasTrabajadas > 0 ? horasNocturnas / horasTrabajadas : 0;
    const extrasNocturnas = horasExtras * proporcionNocturna;
    const extrasDiurnas = horasExtras - extrasNocturnas;
    
    // Alertas Ley 2101/2021
    const alertas = [];
    if (horasExtras > 2) {
      alertas.push(`EXCESO: ${horasExtras.toFixed(1)}h extras (máx 2h/día)`);
    }
    
    return {
      horas_trabajadas: horasTrabajadas.toFixed(2),
      horas_ordinarias: Math.min(horasTrabajadas, jornadaLegal).toFixed(2),
      horas_nocturnas: horasNocturnas.toFixed(2),
      horas_extras_diurnas: extrasDiurnas.toFixed(2),
      horas_extras_nocturnas: extrasNocturnas.toFixed(2),
      jornada_legal: jornadaLegal,
      alertas
    };
  };

  const convertirADecimal = (horaStr) => {
    const [hora, minuto] = horaStr.split(':').map(Number);
    return hora + minuto / 60;
  };

  const calcularHorasNocturnas = (entradaDec, salidaDec) => {
    const INICIO_NOCTURNO = 21; // 21:00
    const FIN_NOCTURNO = 6;   // 06:00
    
    let nocturnas = 0;
    
    // Caso 1: Jornada completamente nocturna
    if (entradaDec >= INICIO_NOCTURNO && salidaDec <= FIN_NOCTURNO) {
      if (salidaDec <= entradaDec) {
        nocturnas = (24 - entradaDec) + salidaDec;
      } else {
        nocturnas = salidaDec - entradaDec;
      }
    }
    // Caso 2: Entrada diurna, salida nocturna
    else if (entradaDec < INICIO_NOCTURNO && salidaDec > INICIO_NOCTURNO) {
      nocturnas = salidaDec - INICIO_NOCTURNO;
    }
    // Caso 3: Cruza medianoche
    else if (entradaDec < INICIO_NOCTURNO && salidaDec < entradaDec && salidaDec <= FIN_NOCTURNO) {
      nocturnas = (24 - INICIO_NOCTURNO) + salidaDec;
    }
    // Caso 4: Entrada nocturna, salida diurna
    else if (entradaDec >= INICIO_NOCTURNO && salidaDec > FIN_NOCTURNO && salidaDec < entradaDec) {
      nocturnas = (24 - entradaDec) + Math.min(salidaDec, FIN_NOCTURNO);
    }
    // Caso 5: Jornada que empieza y termina en horario nocturno cruzando medianoche
    else if (entradaDec >= INICIO_NOCTURNO && salidaDec <= FIN_NOCTURNO) {
      nocturnas = (24 - entradaDec) + salidaDec;
    }
    
    return Math.max(0, nocturnas);
  };

  const onSubmit = async (data) => {
    const exito = await onGuardar(data);
    if (exito) {
      toast.success('Asistencia guardada correctamente');
    }
  };

  // Determinar si los campos de hora deben estar deshabilitados
  const camposHorasDeshabilitados = estadoSeleccionado !== 'asistio';

  // Icono y color según estado
  const getEstadoIconoYColor = (estadoVal) => {
    switch (estadoVal) {
      case 'asistio': return { icono: <CheckCircle2 size={18} />, color: 'text-green-400', label: 'Asistió' };
      case 'inasistencia': return { icono: <XCircle size={18} />, color: 'text-red-400', label: 'Inasistencia' };
      case 'incapacidad': return { icono: <Stethoscope size={18} />, color: 'text-purple-400', label: 'Incapacidad' };
      case 'licencia': return { icono: <Umbrella size={18} />, color: 'text-yellow-400', label: 'Licencia' };
      case 'vacaciones': return { icono: <Plane size={18} />, color: 'text-cyan-400', label: 'Vacaciones' };
      case 'festivo': return { icono: <CalendarDays size={18} />, color: 'text-blue-400', label: 'Festivo' };
      default: return { icono: <Clock size={18} />, color: 'text-[#A0A0A0]', label: estadoVal };
    }
  };

  const estadoActual = getEstadoIconoYColor(estadoSeleccionado);
  const fechaFormateada = new Date(dia.fecha).toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Dialog open={true} onOpenChange={onCerrar}>
      <DialogContent className="bg-[#141414] border-[#2A2A2A] text-white max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays size={20} className="text-[#A0A0A0]" />
              {fechaFormateada}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onCerrar} className="text-[#A0A0A0] hover:text-white">
              <X size={18} />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Estado de asistencia */}
          <div className="space-y-2">
            <Label className="text-[#A0A0A0]">Estado</Label>
            <Select
              value={estadoSeleccionado}
              onValueChange={(val) => setValue('estado', val)}
            >
              <SelectTrigger className="bg-[#1A1A1A] border-[#2A2A2A] text-white">
                <div className="flex items-center gap-2">
                  {estadoActual.icono}
                  <span className={estadoActual.color}>{estadoActual.label}</span>
                </div>
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                <SelectItem value="asistio" className="text-white">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-400" />
                    Asistió
                  </div>
                </SelectItem>
                <SelectItem value="inasistencia" className="text-white">
                  <div className="flex items-center gap-2">
                    <XCircle size={16} className="text-red-400" />
                    Inasistencia
                  </div>
                </SelectItem>
                <SelectItem value="incapacidad" className="text-white">
                  <div className="flex items-center gap-2">
                    <Stethoscope size={16} className="text-purple-400" />
                    Incapacidad
                  </div>
                </SelectItem>
                <SelectItem value="licencia" className="text-white">
                  <div className="flex items-center gap-2">
                    <Umbrella size={16} className="text-yellow-400" />
                    Licencia
                  </div>
                </SelectItem>
                <SelectItem value="vacaciones" className="text-white">
                  <div className="flex items-center gap-2">
                    <Plane size={16} className="text-cyan-400" />
                    Vacaciones
                  </div>
                </SelectItem>
                <SelectItem value="festivo" className="text-white">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-blue-400" />
                    Festivo
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.estado && (
              <p className="text-red-400 text-xs">{errors.estado.message}</p>
            )}
          </div>

          {/* Campos de horas (solo si asistió) */}
          <div className={`space-y-4 ${camposHorasDeshabilitados ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-2 gap-3">
              {/* Hora entrada */}
              <div className="space-y-2">
                <Label className="text-[#A0A0A0] flex items-center gap-1">
                  <Sun size={14} />
                  Hora Entrada
                </Label>
                <Input
                  type="time"
                  {...register('hora_entrada')}
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
                  disabled={camposHorasDeshabilitados}
                />
                {errors.hora_entrada && (
                  <p className="text-red-400 text-xs">{errors.hora_entrada.message}</p>
                )}
              </div>

              {/* Hora salida */}
              <div className="space-y-2">
                <Label className="text-[#A0A0A0] flex items-center gap-1">
                  <Moon size={14} />
                  Hora Salida
                </Label>
                <Input
                  type="time"
                  {...register('hora_salida')}
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
                  disabled={camposHorasDeshabilitados}
                />
                {errors.hora_salida && (
                  <p className="text-red-400 text-xs">{errors.hora_salida.message}</p>
                )}
              </div>
            </div>

            {/* Minutos almuerzo */}
            <div className="space-y-2">
              <Label className="text-[#A0A0A0]">Minutos de Almuerzo (no remunerado)</Label>
              <Input
                type="number"
                min={30}
                max={120}
                step={5}
                {...register('minutos_almuerzo', { valueAsNumber: true })}
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
                disabled={camposHorasDeshabilitados}
              />
              {errors.minutos_almuerzo && (
                <p className="text-red-400 text-xs">{errors.minutos_almuerzo.message}</p>
              )}
            </div>
          </div>

          {/* Preview de cálculo */}
          {calculoPreview && !calculoPreview.error && estadoSeleccionado === 'asistio' && (
            <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A] space-y-2">
              <p className="text-[#A0A0A0] text-xs font-medium uppercase tracking-wide">Cálculo Estimado</p>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#A0A0A0]">Horas trabajadas:</span>
                  <span className="text-white font-medium">{calculoPreview.horas_trabajadas}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A0A0A0]">Ordinarias:</span>
                  <span className="text-green-400 font-medium">{calculoPreview.horas_ordinarias}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A0A0A0]">Nocturnas (35%):</span>
                  <span className="text-indigo-400 font-medium">{calculoPreview.horas_nocturnas}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A0A0A0]">Extras diurnas (25%):</span>
                  <span className="text-orange-400 font-medium">{calculoPreview.horas_extras_diurnas}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A0A0A0]">Extras nocturnas (75%):</span>
                  <span className="text-orange-400 font-medium">{calculoPreview.horas_extras_nocturnas}h</span>
                </div>
              </div>

              {calculoPreview.alertas.length > 0 && (
                <Alert className="bg-amber-950/30 border-amber-600/30 mt-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-amber-200 text-xs">
                    {calculoPreview.alertas[0]}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {calculoPreview?.error && (
            <Alert className="bg-red-950/30 border-red-600/30">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-200 text-xs">
                {calculoPreview.error}
              </AlertDescription>
            </Alert>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              className="flex-1 border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-white text-black hover:bg-[#E0E0E0]"
            >
              <Save size={16} className="mr-2" />
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
