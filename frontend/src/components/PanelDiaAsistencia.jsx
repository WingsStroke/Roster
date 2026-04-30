import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { 
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
  Sun,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { asistenciaDiariaUpdateSchema } from '@/lib/validationSchemas';

/**
 * Panel lateral estático para editar un día específico de asistencia.
 * Reemplaza el modal flotante por un panel fijo a la derecha del calendario.
 */
export default function PanelDiaAsistencia({ 
  dia, 
  empleado, 
  onGuardar, 
  onAnterior,
  onSiguiente,
  puedeAnterior,
  puedeSiguiente
}) {
  const [calculoPreview, setCalculoPreview] = useState(null);

  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue, 
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(asistenciaDiariaUpdateSchema),
    defaultValues: {
      estado: 'asistio',
      hora_entrada: '08:00',
      hora_salida: '17:00',
      minutos_almuerzo: 60,
    }
  });

  // Resetear formulario cuando cambia el día seleccionado
  useEffect(() => {
    if (dia?.asistencia) {
      reset({
        estado: dia.asistencia.estado || 'asistio',
        hora_entrada: dia.asistencia.hora_entrada || empleado?.horario?.hora_entrada_default || '08:00',
        hora_salida: dia.asistencia.hora_salida || empleado?.horario?.hora_salida_default || '17:00',
        minutos_almuerzo: dia.asistencia.minutos_almuerzo || empleado?.horario?.minutos_almuerzo_default || 60,
      });
    }
  }, [dia?.fecha, reset]);

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
    const INICIO_NOCTURNO = 21;
    const FIN_NOCTURNO = 6;
    
    let nocturnas = 0;
    
    if (entradaDec >= INICIO_NOCTURNO && salidaDec <= FIN_NOCTURNO) {
      if (salidaDec <= entradaDec) {
        nocturnas = (24 - entradaDec) + salidaDec;
      } else {
        nocturnas = salidaDec - entradaDec;
      }
    }
    else if (entradaDec < INICIO_NOCTURNO && salidaDec > INICIO_NOCTURNO) {
      nocturnas = salidaDec - INICIO_NOCTURNO;
    }
    else if (entradaDec < INICIO_NOCTURNO && salidaDec < entradaDec && salidaDec <= FIN_NOCTURNO) {
      nocturnas = (24 - INICIO_NOCTURNO) + salidaDec;
    }
    else if (entradaDec >= INICIO_NOCTURNO && salidaDec > FIN_NOCTURNO && salidaDec < entradaDec) {
      nocturnas = (24 - entradaDec) + Math.min(salidaDec, FIN_NOCTURNO);
    }
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
  const camposHorasDeshabilitados = estado !== 'asistio';

  // Icono y color según estado
  const getEstadoInfo = (estadoVal) => {
    switch (estadoVal) {
      case 'asistio': return { 
        icono: <CheckCircle2 size={18} />, 
        color: 'text-green-400', 
        bg: 'bg-green-950/30 border-green-600/30',
        label: 'Asistió' 
      };
      case 'inasistencia': return { 
        icono: <XCircle size={18} />, 
        color: 'text-red-400', 
        bg: 'bg-red-950/30 border-red-600/30',
        label: 'Inasistencia' 
      };
      case 'incapacidad': return { 
        icono: <Stethoscope size={18} />, 
        color: 'text-purple-400', 
        bg: 'bg-purple-950/30 border-purple-600/30',
        label: 'Incapacidad' 
      };
      case 'licencia': return { 
        icono: <Umbrella size={18} />, 
        color: 'text-yellow-400', 
        bg: 'bg-yellow-950/30 border-yellow-600/30',
        label: 'Licencia' 
      };
      case 'vacaciones': return { 
        icono: <Plane size={18} />, 
        color: 'text-cyan-400', 
        bg: 'bg-cyan-950/30 border-cyan-600/30',
        label: 'Vacaciones' 
      };
      case 'festivo': return { 
        icono: <CalendarDays size={18} />, 
        color: 'text-blue-400', 
        bg: 'bg-blue-950/30 border-blue-600/30',
        label: 'Festivo' 
      };
      default: return { 
        icono: <Clock size={18} />, 
        color: 'text-[#A0A0A0]', 
        bg: 'bg-[#1A1A1A] border-[#2A2A2A]',
        label: estadoVal 
      };
    }
  };

  const estadoInfo = getEstadoInfo(estado);
  
  // Formatear fecha
  const fechaFormateada = dia ? new Date(dia.fecha).toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Selecciona un día';

  const diaSemana = dia ? new Date(dia.fecha).toLocaleDateString('es-CO', { weekday: 'short' }) : '';
  const diaMes = dia?.diaMes || '';
  const mes = dia ? new Date(dia.fecha).toLocaleDateString('es-CO', { month: 'short' }) : '';

  if (!dia) {
    return (
      <Card className="bg-[#141414] border-[#2A2A2A] h-full">
        <CardContent className="flex flex-col items-center justify-center h-full py-12 text-[#A0A0A0]">
          <CalendarDays size={48} className="mb-4 opacity-50" />
          <p className="text-center">Selecciona un día del calendario para configurar la asistencia</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#141414] border-[#2A2A2A] h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Fecha grande */}
            <div className="text-center bg-[#1A1A1A] rounded-lg p-2 min-w-[60px]">
              <div className="text-[#A0A0A0] text-[10px] uppercase">{diaSemana}</div>
              <div className="text-white text-2xl font-bold">{diaMes}</div>
              <div className="text-[#A0A0A0] text-[10px] uppercase">{mes}</div>
            </div>
            
            <div>
              <CardTitle className="text-white text-base font-medium">
                Configurar Día
              </CardTitle>
              <p className="text-[#A0A0A0] text-xs">{fechaFormateada}</p>
            </div>
          </div>

          {/* Navegación entre días */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={onAnterior}
              disabled={!puedeAnterior}
              className="h-8 w-8 border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onSiguiente}
              disabled={!puedeSiguiente}
              className="h-8 w-8 border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 flex-1 flex flex-col">
          
          {/* Info del empleado */}
          <div className="flex items-center gap-2 text-sm text-[#A0A0A0] bg-[#1A1A1A] rounded-lg p-2">
            <User size={14} />
            <span className="truncate">{empleado?.nombre || 'Empleado'}</span>
          </div>

          <Separator className="bg-[#2A2A2A]" />

          {/* Estado de asistencia */}
          <div className="space-y-2">
            <Label className="text-[#A0A0A0] text-xs uppercase tracking-wider">Estado</Label>
            <Select
              value={estado}
              onValueChange={(val) => setValue('estado', val)}
            >
              <SelectTrigger className={`bg-[#1A1A1A] border-[#2A2A2A] text-white ${estadoInfo.bg}`}>
                <div className="flex items-center gap-2">
                  {estadoInfo.icono}
                  <span className={estadoInfo.color}>{estadoInfo.label}</span>
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
          </div>

          {/* Campos de horas (solo si asistió) */}
          <div className={`space-y-4 ${camposHorasDeshabilitados ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-2 gap-3">
              {/* Hora entrada */}
              <div className="space-y-1.5">
                <Label className="text-[#A0A0A0] text-xs flex items-center gap-1">
                  <Sun size={12} />
                  Entrada
                </Label>
                <Input
                  type="time"
                  {...register('hora_entrada')}
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white h-9"
                />
                {errors.hora_entrada && (
                  <p className="text-red-400 text-[10px]">{errors.hora_entrada.message}</p>
                )}
              </div>

              {/* Hora salida */}
              <div className="space-y-1.5">
                <Label className="text-[#A0A0A0] text-xs flex items-center gap-1">
                  <Moon size={12} />
                  Salida
                </Label>
                <Input
                  type="time"
                  {...register('hora_salida')}
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white h-9"
                />
                {errors.hora_salida && (
                  <p className="text-red-400 text-[10px]">{errors.hora_salida.message}</p>
                )}
              </div>
            </div>

            {/* Minutos almuerzo */}
            <div className="space-y-1.5">
              <Label className="text-[#A0A0A0] text-xs">Almuerzo (minutos)</Label>
              <Input
                type="number"
                min={30}
                max={120}
                step={5}
                {...register('minutos_almuerzo', { valueAsNumber: true })}
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white h-9"
              />
              {errors.minutos_almuerzo && (
                <p className="text-red-400 text-[10px]">{errors.minutos_almuerzo.message}</p>
              )}
            </div>
          </div>

          {/* Preview de cálculo */}
          {calculoPreview && !calculoPreview.error && estado === 'asistio' && (
            <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A] space-y-2">
              <p className="text-[#A0A0A0] text-[10px] font-medium uppercase tracking-wide">Cálculo Automático</p>
              
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#A0A0A0]">Trabajadas:</span>
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
                  <span className="text-[#A0A0A0]">Extras D (25%):</span>
                  <span className="text-orange-400 font-medium">{calculoPreview.horas_extras_diurnas}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A0A0A0]">Extras N (75%):</span>
                  <span className="text-orange-400 font-medium">{calculoPreview.horas_extras_nocturnas}h</span>
                </div>
              </div>

              {calculoPreview.alertas.length > 0 && (
                <Alert className="bg-amber-950/30 border-amber-600/30 mt-2 py-2">
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  <AlertDescription className="text-amber-200 text-[10px]">
                    {calculoPreview.alertas[0]}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {calculoPreview?.error && (
            <Alert className="bg-red-950/30 border-red-600/30 py-2">
              <AlertTriangle className="h-3 w-3 text-red-400" />
              <AlertDescription className="text-red-200 text-[10px]">
                {calculoPreview.error}
              </AlertDescription>
            </Alert>
          )}

          {/* Espaciador para empujar el botón al fondo */}
          <div className="flex-1" />

          {/* Botón guardar */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-black hover:bg-[#E0E0E0] h-10"
          >
            <Save size={16} className="mr-2" />
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
