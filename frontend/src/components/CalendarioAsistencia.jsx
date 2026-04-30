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
  CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DialogoDiaAsistencia from './DialogoDiaAsistencia';

/**
 * Componente de calendario interactivo para gestionar asistencia diaria.
 * Muestra días del período con colores según estado y permite editar cada día.
 */
export default function CalendarioAsistencia({
  empleado,
  asistencias,
  fechaInicio,
  fechaFin,
  festivos = [],
  onActualizarAsistencia,
  onRecargar
}) {
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [mostrarDialogo, setMostrarDialogo] = useState(false);

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
    
    // Sin registro
    if (!asistencia) {
      return 'bg-[#1A1A1A] border-[#2A2A2A] text-[#A0A0A0]';
    }

    // Festivo o domingo
    if (esFestivo || diaSemana === 0) {
      return 'bg-blue-950/30 border-blue-600/30 text-blue-200';
    }

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
    setMostrarDialogo(true);
  };

  const handleGuardarDia = async (datos) => {
    if (!diaSeleccionado?.asistencia) return false;
    
    const exito = await onActualizarAsistencia(diaSeleccionado.asistencia.id, datos);
    if (exito) {
      setMostrarDialogo(false);
      setDiaSeleccionado(null);
    }
    return exito;
  };

  return (
    <Card className="bg-[#141414] border-[#2A2A2A]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base font-medium">
            Calendario de Asistencia: {empleado?.nombre}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[#A0A0A0]">
              {fechaInicio} al {fechaFin}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onRecargar}
              className="border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
            >
              Actualizar
            </Button>
          </div>
        </div>

        {/* Leyenda y estadísticas */}
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="bg-green-950/30 border-green-600/30 text-green-200 text-xs">
            <CheckCircle2 size={10} className="mr-1" />
            Asistió ({estadisticas.asistidos})
          </Badge>
          <Badge variant="outline" className="bg-orange-950/30 border-orange-600/30 text-orange-200 text-xs">
            <AlertTriangle size={10} className="mr-1" />
            Con Extras ({estadisticas.horasExtras})
          </Badge>
          <Badge variant="outline" className="bg-indigo-950/30 border-indigo-600/30 text-indigo-200 text-xs">
            <Moon size={10} className="mr-1" />
            Nocturno
          </Badge>
          <Badge variant="outline" className="bg-red-950/30 border-red-600/30 text-red-200 text-xs">
            <XCircle size={10} className="mr-1" />
            Inasistencia ({estadisticas.inasistencias})
          </Badge>
          <Badge variant="outline" className="bg-purple-950/30 border-purple-600/30 text-purple-200 text-xs">
            <Stethoscope size={10} className="mr-1" />
            Incapacidad ({estadisticas.incapacidades})
          </Badge>
          <Badge variant="outline" className="bg-yellow-950/30 border-yellow-600/30 text-yellow-200 text-xs">
            <Umbrella size={10} className="mr-1" />
            Licencia ({estadisticas.licencias})
          </Badge>
          <Badge variant="outline" className="bg-blue-950/30 border-blue-600/30 text-blue-200 text-xs">
            <CalendarDays size={10} className="mr-1" />
            Festivo ({estadisticas.festivos})
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Grid de calendario */}
        <div className="grid grid-cols-7 gap-2">
          {/* Encabezados de días de la semana */}
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((dia) => (
            <div key={dia} className="text-center text-[#A0A0A0] text-xs py-2 font-medium">
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
            
            return (
              <button
                key={dia.fecha}
                onClick={() => handleClickDia(dia)}
                className={`
                  aspect-square rounded-lg border p-2 flex flex-col items-center justify-center
                  transition-all duration-200 hover:scale-105 hover:shadow-lg
                  ${styles}
                `}
              >
                <span className="text-lg font-semibold">{dia.diaMes}</span>
                <div className="flex items-center gap-1 mt-1">
                  {dia.asistencia && getEstadoIcono(dia.asistencia.estado)}
                  {tieneAlertas && <AlertTriangle size={12} className="text-amber-400" />}
                  {dia.asistencia?.calculo_diario?.horas_nocturnas > 0 && (
                    <Moon size={12} />
                  )}
                </div>
                {dia.asistencia?.estado === 'asistio' && (
                  <div className="text-[10px] mt-1 opacity-80">
                    {dia.asistencia.hora_entrada?.substring(0, 5)}-{dia.asistencia.hora_salida?.substring(0, 5)}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Nota informativa */}
        <p className="text-[#A0A0A0] text-xs mt-4 text-center">
          Haz clic en cualquier día para editar la asistencia. Los festivos y domingos se marcan automáticamente.
          Las horas nocturnas (21:00-06:00) se calculan automáticamente con recargo del 35%.
        </p>
      </CardContent>

      {/* Diálogo para editar día */}
      {mostrarDialogo && diaSeleccionado && (
        <DialogoDiaAsistencia
          dia={diaSeleccionado}
          empleado={empleado}
          onGuardar={handleGuardarDia}
          onCerrar={() => {
            setMostrarDialogo(false);
            setDiaSeleccionado(null);
          }}
        />
      )}
    </Card>
  );
}
