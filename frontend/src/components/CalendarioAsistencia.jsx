import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  XCircle, 
  Moon, 
  Sun, 
  AlertTriangle,
  Briefcase,
  Stethoscope,
  Umbrella,
  Plane,
  CalendarDays,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PanelDiaAsistencia from './PanelDiaAsistencia';

/**
 * Componente de calendario interactivo para gestionar asistencia diaria.
 * Layout de dos columnas: calendario compacto a la izquierda, panel de configuración a la derecha.
 */
export default function CalendarioAsistencia({
  empleado,
  asistencias,
  fechaInicio,
  fechaFin,
  festivos = [],
  onActualizarAsistencia,
  onCrearAsistencia,
  onRecargar
}) {
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  // Generar array de fechas del período
  const diasCalendario = useMemo(() => {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const dias = [];
    
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      const fechaStr = d.toISOString().split('T')[0];
      const asistencia = asistencias.find(a => a.fecha === fechaStr);
      
      dias.push({
        fecha: fechaStr,
        diaSemana: d.getDay(), // 0=domingo, 6=sábado
        diaMes: d.getDate(),
        mes: d.getMonth(),
        esFestivo: festivos.includes(fechaStr),
        asistencia: asistencia || null
      });
    }
    
    return dias;
  }, [fechaInicio, fechaFin, asistencias, festivos]);

  // Estadísticas del período
  const estadisticas = useMemo(() => {
    const stats = {
      asistidos: 0,
      inasistencias: 0,
      incapacidades: 0,
      licencias: 0,
      vacaciones: 0,
      festivos: 0,
      horasExtras: 0
    };

    asistencias.forEach(asis => {
      switch (asis.estado) {
        case 'asistio':
          stats.asistidos++;
          const extras = (asis.calculo_diario?.horas_extra_diurna || 0) + 
                        (asis.calculo_diario?.horas_extra_nocturna || 0);
          if (extras > 0) stats.horasExtras++;
          break;
        case 'inasistencia': stats.inasistencias++; break;
        case 'incapacidad': stats.incapacidades++; break;
        case 'licencia': stats.licencias++; break;
        case 'vacaciones': stats.vacaciones++; break;
        case 'festivo': stats.festivos++; break;
      }
    });

    return stats;
  }, [asistencias]);

  // Configurar colores según estado
  const getEstadoStyles = (dia) => {
    const { asistencia, esFestivo, diaSemana } = dia;
    
    // Sin registro: festivo o domingo (azul), o vacío (gris)
    if (!asistencia) {
      if (esFestivo || diaSemana === 0) {
        return 'bg-blue-950/30 border-blue-600/30 text-blue-200';
      }
      return 'bg-[#1A1A1A] border-[#2A2A2A] text-[#A0A0A0]';
    }

    // Con asistencia: mostrar el color según el estado real
    switch (asistencia.estado) {
      case 'asistio':
        // Verificar si tiene horas extras
        const tieneExtras = asistencia.calculo_diario?.horas_extra_diurna > 0 ||
                           asistencia.calculo_diario?.horas_extra_nocturna > 0;
        if (tieneExtras) {
          return 'bg-orange-950/30 border-orange-600/30 text-orange-200';
        }
        // Verificar si tiene horas nocturnas
        const tieneNocturnas = asistencia.calculo_diario?.horas_nocturnas > 0;
        if (tieneNocturnas) {
          return 'bg-indigo-950/30 border-indigo-600/30 text-indigo-200';
        }
        return 'bg-green-950/30 border-green-600/30 text-green-200';
      
      case 'inasistencia':
        return 'bg-red-950/30 border-red-600/30 text-red-200';
      
      case 'incapacidad':
        return 'bg-purple-950/30 border-purple-600/30 text-purple-200';
      
      case 'licencia':
        return 'bg-yellow-950/30 border-yellow-600/30 text-yellow-200';
      
      case 'vacaciones':
        return 'bg-cyan-950/30 border-cyan-600/30 text-cyan-200';
      
      default:
        return 'bg-[#1A1A1A] border-[#2A2A2A] text-[#A0A0A0]';
    }
  };

  const getEstadoIcono = (estado) => {
    switch (estado) {
      case 'asistio': return <CheckCircle2 size={14} />;
      case 'inasistencia': return <XCircle size={14} />;
      case 'incapacidad': return <Stethoscope size={14} />;
      case 'licencia': return <Umbrella size={14} />;
      case 'vacaciones': return <Plane size={14} />;
      case 'festivo': return <CalendarDays size={14} />;
      default: return null;
    }
  };

  const getNombreDia = (diaSemana) => {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return dias[diaSemana];
  };

  const handleClickDia = (dia) => {
    setDiaSeleccionado(dia);
  };

  const handleGuardarDia = async (datos) => {
    if (!diaSeleccionado) return false;
    
    let exito;
    
    if (diaSeleccionado.asistencia) {
      // Actualizar asistencia existente
      exito = await onActualizarAsistencia(diaSeleccionado.asistencia.id, datos);
      if (exito) {
        // Actualizar el día seleccionado con los nuevos datos
        setDiaSeleccionado(prev => ({
          ...prev,
          asistencia: { ...prev.asistencia, ...datos }
        }));
      }
    } else {
      // Crear nueva asistencia
      exito = await onCrearAsistencia(diaSeleccionado.fecha, datos);
      if (exito) {
        // Recargar asistencias para obtener el nuevo registro con ID
        await onRecargar();
      }
    }
    
    return exito;
  };

  const handleDiaAnterior = () => {
    const idx = diasCalendario.findIndex(d => d.fecha === diaSeleccionado?.fecha);
    if (idx > 0) {
      setDiaSeleccionado(diasCalendario[idx - 1]);
    }
  };

  const handleDiaSiguiente = () => {
    const idx = diasCalendario.findIndex(d => d.fecha === diaSeleccionado?.fecha);
    if (idx >= 0 && idx < diasCalendario.length - 1) {
      setDiaSeleccionado(diasCalendario[idx + 1]);
    }
  };

  // Seleccionar el primer día automáticamente al cargar
  useMemo(() => {
    if (diasCalendario.length > 0 && !diaSeleccionado) {
      const primerDiaLaboral = diasCalendario.find(d => 
        d.asistencia?.estado === 'asistio' || !d.esFestivo
      ) || diasCalendario[0];
      setDiaSeleccionado(primerDiaLaboral);
    }
  }, [diasCalendario]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Panel izquierdo: Calendario compacto */}
      <Card className="bg-[#141414] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base font-medium">
              Calendario: {empleado?.nombre}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onRecargar}
              className="border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
            >
              Actualizar
            </Button>
          </div>

          {/* Leyenda compacta */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className="bg-green-950/30 border-green-600/30 text-green-200 text-[10px] px-1.5">
              Asistió ({estadisticas.asistidos})
            </Badge>
            <Badge variant="outline" className="bg-orange-950/30 border-orange-600/30 text-orange-200 text-[10px] px-1.5">
              Extras ({estadisticas.horasExtras})
            </Badge>
            <Badge variant="outline" className="bg-indigo-950/30 border-indigo-600/30 text-indigo-200 text-[10px] px-1.5">
              Nocturno
            </Badge>
            <Badge variant="outline" className="bg-red-950/30 border-red-600/30 text-red-200 text-[10px] px-1.5">
              Inasist. ({estadisticas.inasistencias})
            </Badge>
            <Badge variant="outline" className="bg-purple-950/30 border-purple-600/30 text-purple-200 text-[10px] px-1.5">
              Incap. ({estadisticas.incapacidades})
            </Badge>
            <Badge variant="outline" className="bg-yellow-950/30 border-yellow-600/30 text-yellow-200 text-[10px] px-1.5">
              Lic. ({estadisticas.licencias})
            </Badge>
            <Badge variant="outline" className="bg-blue-950/30 border-blue-600/30 text-blue-200 text-[10px] px-1.5">
              Fest. ({estadisticas.festivos})
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Grid de calendario compacto */}
          <div className="grid grid-cols-7 gap-1">
            {/* Encabezados de días de la semana */}
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((dia, idx) => (
              <div key={dia + idx} className="text-center text-[#A0A0A0] text-[10px] py-1 font-medium">
                {dia}
              </div>
            ))}

            {/* Días vacíos al inicio para alinear */}
            {Array.from({ length: diasCalendario[0]?.diaSemana || 0 }).map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square" />
            ))}

            {/* Celdas de días */}
            {diasCalendario.map((dia) => {
              const styles = getEstadoStyles(dia);
              const tieneAlertas = dia.asistencia?.calculo_diario?.alertas?.length > 0;
              const isSelected = diaSeleccionado?.fecha === dia.fecha;
              
              return (
                <button
                  key={dia.fecha}
                  onClick={() => handleClickDia(dia)}
                  className={`
                    aspect-square rounded border p-1 flex flex-col items-center justify-center
                    transition-all duration-200 hover:scale-110
                    ${styles}
                    ${isSelected ? 'ring-1 ring-white' : ''}
                  `}
                >
                  <span className="text-sm font-semibold leading-none">{dia.diaMes}</span>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {dia.asistencia && (
                      <span className="scale-75 origin-center">{getEstadoIcono(dia.asistencia.estado)}</span>
                    )}
                    {tieneAlertas && <AlertTriangle size={8} className="text-amber-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Nota informativa */}
          <p className="text-[#A0A0A0] text-[10px] mt-3 text-center leading-tight">
            Haz clic en un día para editar. Horas nocturnas (21:00-06:00) con recargo 35%.
          </p>
        </CardContent>
      </Card>

      {/* Panel derecho: Configuración del día seleccionado */}
      <PanelDiaAsistencia
        dia={diaSeleccionado}
        empleado={empleado}
        onGuardar={handleGuardarDia}
        onAnterior={handleDiaAnterior}
        onSiguiente={handleDiaSiguiente}
        puedeAnterior={diasCalendario.findIndex(d => d.fecha === diaSeleccionado?.fecha) > 0}
        puedeSiguiente={diasCalendario.findIndex(d => d.fecha === diaSeleccionado?.fecha) < diasCalendario.length - 1}
      />
    </div>
  );
}
