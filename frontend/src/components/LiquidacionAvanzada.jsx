import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { liquidacionAvanzadaSchema, batchAsistenciaSchema } from '@/lib/validationSchemas';
import { formatCOP } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Calendar as CalendarIcon, Calculator, FileText, Save } from 'lucide-react';
import CalendarioAsistencia from './CalendarioAsistencia';

/**
 * Componente principal para liquidación avanzada por asistencia diaria.
 * Permite seleccionar empleado, período (quincenal/mensual/personalizado),
 * registrar asistencia día por día, y calcular la liquidación.
 */
export default function LiquidacionAvanzada({ empresaActiva, empleados, config, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
  const [tipoPeriodo, setTipoPeriodo] = useState('mensual');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [asistencias, setAsistencias] = useState([]);
  const [liquidacionCalculada, setLiquidacionCalculada] = useState(null);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [festivos, setFestivos] = useState([]);

  // Obtener festivos al cargar
  useEffect(() => {
    const cargarFestivos = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/festivos?ano=2026`);
        if (response.ok) {
          const data = await response.json();
          setFestivos(data.festivos || []);
        }
      } catch (error) {
        console.error('Error cargando festivos:', error);
      }
    };
    cargarFestivos();
  }, []);

  // Calcular fechas automáticamente según tipo de período
  useEffect(() => {
    const hoy = new Date();
    const ano = hoy.getFullYear();
    const mes = hoy.getMonth();
    const dia = hoy.getDate();

    let inicio, fin;

    if (tipoPeriodo === 'quincenal') {
      if (dia <= 15) {
        // Primera quincena
        inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
        fin = `${ano}-${String(mes + 1).padStart(2, '0')}-15`;
      } else {
        // Segunda quincena
        const ultimoDia = new Date(ano, mes + 1, 0).getDate();
        inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-16`;
        fin = `${ano}-${String(mes + 1).padStart(2, '0')}-${ultimoDia}`;
      }
    } else if (tipoPeriodo === 'mensual') {
      const ultimoDia = new Date(ano, mes + 1, 0).getDate();
      inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
      fin = `${ano}-${String(mes + 1).padStart(2, '0')}-${ultimoDia}`;
    }
    // Si es personalizado, no auto-calcular

    if (inicio && fin) {
      setFechaInicio(inicio);
      setFechaFin(fin);
    }
  }, [tipoPeriodo]);

  // Cargar asistencias cuando cambia el empleado o el rango de fechas
  const cargarAsistencias = useCallback(async () => {
    if (!empleadoSeleccionado || !fechaInicio || !fechaFin) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/asistencias?empleado_id=${empleadoSeleccionado.id}&fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAsistencias(data);
        
        // Si no hay asistencias, ofrecer precargar con horario contractual
        if (data.length === 0) {
          await precargarAsistencias();
        }
      }
    } catch (error) {
      toast.error('Error al cargar asistencias');
    } finally {
      setLoading(false);
    }
  }, [empleadoSeleccionado, fechaInicio, fechaFin]);

  // Precargar asistencias con horario contractual
  const precargarAsistencias = async () => {
    if (!empleadoSeleccionado || !fechaInicio || !fechaFin) return;

    const horarioDefault = empleadoSeleccionado.horario || {
      hora_entrada_default: '08:00',
      hora_salida_default: '17:00',
      minutos_almuerzo_default: 60,
      dias_laborales: [1, 2, 3, 4, 5],
      jornada_diaria_horas: 8
    };

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/asistencias/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empleadoSeleccionado.id,
          empresa_id: empresaActiva.id,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          horario_default: horarioDefault
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`${result.registros_creados} días precargados con horario contractual`);
        await cargarAsistencias(); // Recargar
      }
    } catch (error) {
      console.error('Error precargando asistencias:', error);
    }
  };

  // Calcular liquidación
  const calcularLiquidacion = async () => {
    if (!empleadoSeleccionado || !fechaInicio || !fechaFin) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    // Validar con Zod
    const validation = liquidacionAvanzadaSchema.safeParse({
      empleado_id: empleadoSeleccionado.id,
      empresa_id: empresaActiva.id,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo_periodo: tipoPeriodo
    });

    if (!validation.success) {
      validation.error.errors.forEach(err => toast.error(err.message));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/liquidaciones-avanzadas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data)
      });

      if (response.ok) {
        const data = await response.json();
        setLiquidacionCalculada(data.resultado);
        toast.success('Liquidación calculada exitosamente');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error calculando liquidación');
      }
    } catch (error) {
      toast.error('Error de conexión al calcular liquidación');
    } finally {
      setLoading(false);
    }
  };

  // Actualizar una asistencia en el estado local
  const actualizarAsistenciaLocal = (asistenciaId, datosActualizados) => {
    setAsistencias(prev => prev.map(asis => 
      asis.id === asistenciaId ? { ...asis, ...datosActualizados } : asis
    ));
  };

  // Guardar cambios de asistencia en el backend
  const guardarAsistencia = async (asistenciaId, datos) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/asistencias/${asistenciaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });

      if (response.ok) {
        const asistenciaActualizada = await response.json();
        actualizarAsistenciaLocal(asistenciaId, asistenciaActualizada);
        toast.success('Asistencia actualizada');
        return true;
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error actualizando asistencia');
        return false;
      }
    } catch (error) {
      toast.error('Error de conexión');
      return false;
    }
  };

  // Crear nueva asistencia para un día sin registro
  const crearAsistencia = async (fecha, datos) => {
    try {
      const horarioDefault = empleadoSeleccionado.horario || {
        hora_entrada_default: '08:00',
        hora_salida_default: '17:00',
        minutos_almuerzo_default: 60,
        jornada_diaria_horas: 8
      };

      const payload = {
        empleado_id: empleadoSeleccionado.id,
        empresa_id: empresaActiva.id,
        fecha: fecha,
        estado: datos.estado,
        hora_entrada: datos.hora_entrada || horarioDefault.hora_entrada_default,
        hora_salida: datos.hora_salida || horarioDefault.hora_salida_default,
        minutos_almuerzo: datos.minutos_almuerzo ?? horarioDefault.minutos_almuerzo_default,
        novedades: datos.novedades || []
      };

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/asistencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const nuevaAsistencia = await response.json();
        // Agregar al estado local
        setAsistencias(prev => [...prev, nuevaAsistencia].sort((a, b) => a.fecha.localeCompare(b.fecha)));
        toast.success('Asistencia creada correctamente');
        return true;
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error creando asistencia');
        return false;
      }
    } catch (error) {
      toast.error('Error de conexión');
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-semibold text-white">
          Liquidación Avanzada por Asistencia
        </h1>
      </div>

      {/* Configuración del período */}
      <Card className="bg-[#141414] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white text-base font-medium flex items-center gap-2">
            <CalendarIcon size={18} />
            Configuración del Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Selección de empleado */}
            <div className="space-y-2">
              <Label className="text-[#A0A0A0]">Empleado</Label>
              <Select
                value={empleadoSeleccionado?.id || ''}
                onValueChange={(id) => {
                  const emp = empleados.find(e => e.id === id);
                  setEmpleadoSeleccionado(emp);
                  setAsistencias([]);
                  setLiquidacionCalculada(null);
                }}
              >
                <SelectTrigger className="bg-[#1A1A1A] border-[#2A2A2A] text-white">
                  <SelectValue placeholder="Seleccione un empleado" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                  {empleados
                    .filter(emp => emp.estado === 'activo')
                    .map(emp => (
                      <SelectItem key={emp.id} value={emp.id} className="text-white">
                        {emp.nombre} - {emp.cargo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de período */}
            <div className="space-y-2">
              <Label className="text-[#A0A0A0]">Tipo de Período</Label>
              <Select
                value={tipoPeriodo}
                onValueChange={setTipoPeriodo}
              >
                <SelectTrigger className="bg-[#1A1A1A] border-[#2A2A2A] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                  <SelectItem value="quincenal" className="text-white">Quincenal</SelectItem>
                  <SelectItem value="mensual" className="text-white">Mensual</SelectItem>
                  <SelectItem value="personalizado" className="text-white">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha inicio */}
            <div className="space-y-2">
              <Label className="text-[#A0A0A0]">Fecha Inicio</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
                disabled={tipoPeriodo !== 'personalizado'}
              />
            </div>

            {/* Fecha fin */}
            <div className="space-y-2">
              <Label className="text-[#A0A0A0]">Fecha Fin</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
                disabled={tipoPeriodo !== 'personalizado'}
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => {
                cargarAsistencias();
                setMostrarCalendario(true);
              }}
              disabled={!empleadoSeleccionado || loading}
              className="bg-white text-black hover:bg-[#E0E0E0]"
            >
              <CalendarIcon size={16} className="mr-2" />
              {asistencias.length > 0 ? 'Ver Calendario' : 'Cargar Calendario'}
            </Button>

            <Button
              onClick={calcularLiquidacion}
              disabled={!empleadoSeleccionado || asistencias.length === 0 || loading}
              className="bg-[#2A2A2A] text-white hover:bg-[#3A3A3A] border border-[#3A3A3A]"
            >
              <Calculator size={16} className="mr-2" />
              Calcular Liquidación
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendario de asistencia */}
      {mostrarCalendario && empleadoSeleccionado && (
        <CalendarioAsistencia
          empleado={empleadoSeleccionado}
          asistencias={asistencias}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          festivos={festivos}
          onActualizarAsistencia={guardarAsistencia}
          onCrearAsistencia={crearAsistencia}
          onRecargar={cargarAsistencias}
        />
      )}

      {/* Resultado de liquidación */}
      {liquidacionCalculada && (
        <Card className="bg-[#141414] border-[#2A2A2A]">
          <CardHeader>
            <CardTitle className="text-white text-base font-medium flex items-center gap-2">
              <FileText size={18} />
              Resultado de Liquidación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Alertas */}
            {liquidacionCalculada.alertas_ley_2101?.length > 0 && (
              <Alert className="bg-amber-950/30 border-amber-600/30 text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <AlertDescription>
                  <p className="font-medium mb-1">Alertas Ley 2101/2021:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {liquidacionCalculada.alertas_ley_2101.map((alerta, idx) => (
                      <li key={idx}>{alerta}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#1A1A1A] p-3 rounded border border-[#2A2A2A]">
                <p className="text-[#A0A0A0] text-xs">Días Asistidos</p>
                <p className="text-white text-lg font-semibold">{liquidacionCalculada.total_dias_asistidos}</p>
              </div>
              <div className="bg-[#1A1A1A] p-3 rounded border border-[#2A2A2A]">
                <p className="text-[#A0A0A0] text-xs">Horas Ordinarias</p>
                <p className="text-white text-lg font-semibold">{liquidacionCalculada.total_horas_ordinarias}h</p>
              </div>
              <div className="bg-[#1A1A1A] p-3 rounded border border-[#2A2A2A]">
                <p className="text-[#A0A0A0] text-xs">Horas Nocturnas</p>
                <p className="text-blue-400 text-lg font-semibold">{liquidacionCalculada.total_horas_nocturnas}h</p>
              </div>
              <div className="bg-[#1A1A1A] p-3 rounded border border-[#2A2A2A]">
                <p className="text-[#A0A0A0] text-xs">Horas Extras</p>
                <p className="text-orange-400 text-lg font-semibold">
                  {(liquidacionCalculada.total_horas_extra_diurna + liquidacionCalculada.total_horas_extra_nocturna).toFixed(2)}h
                </p>
              </div>
            </div>

            {/* Auxilio de transporte */}
            <div className="flex items-center justify-between bg-[#1A1A1A] p-3 rounded border border-[#2A2A2A]">
              <span className="text-[#A0A0A0]">Auxilio de Transporte</span>
              <span className="text-white font-medium">
                {formatCOP(liquidacionCalculada.auxilio_transporte_total)}
                <span className="text-[#A0A0A0] text-sm ml-2">
                  ({liquidacionCalculada.total_dias_asistidos} días × {formatCOP(liquidacionCalculada.valor_auxilio_transporte_diario)})
                </span>
              </span>
            </div>

            {/* Botón generar PDF */}
            <Button
              className="w-full bg-white text-black hover:bg-[#E0E0E0]"
              onClick={() => {
                // TODO: Implementar generación de PDF
                toast.info('Generación de PDF en desarrollo');
              }}
            >
              <FileText size={16} className="mr-2" />
              Generar Comprobante de Pago
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
