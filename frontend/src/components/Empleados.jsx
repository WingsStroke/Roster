import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Search, UserPlus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCOP, TIPOS_CONTRATO, NIVELES_ARL } from '@/lib/constants';

const emptyForm = {
  nombre: '', cedula: '', cargo: '', fecha_ingreso: '',
  tipo_contrato: 'indefinido', salario: '', riesgo_arl: 'I',
  auxilio_transporte: true, eps: '', afp: '', caja: '',
  cuenta_bancaria: '', estado: 'activo',
  // Horario contractual (opcional)
  hora_entrada_default: '',
  hora_salida_default: '',
  minutos_almuerzo_default: '',
  dias_laborales: [1, 2, 3, 4, 5], // Lun-Vie por defecto
  jornada_diaria_horas: '',
};

export default function Empleados({ empresaActiva, empleados, onRefresh }) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteEmpNombre, setDeleteEmpNombre] = useState('');

  const filtered = (empleados || []).filter(e =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.cedula.includes(search) ||
    e.cargo.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm({ ...emptyForm }); setEditingId(null); setDialogOpen(true); };
  const openEdit = (emp) => {
    const horario = emp.horario || {};
    setForm({
      ...emp,
      salario: String(emp.salario),
      auxilio_transporte: Boolean(emp.auxilio_transporte),
      // Cargar horario si existe
      hora_entrada_default: horario.hora_entrada_default || '',
      hora_salida_default: horario.hora_salida_default || '',
      minutos_almuerzo_default: horario.minutos_almuerzo_default ? String(horario.minutos_almuerzo_default) : '',
      dias_laborales: horario.dias_laborales || [1, 2, 3, 4, 5],
      jornada_diaria_horas: horario.jornada_diaria_horas ? String(horario.jornada_diaria_horas) : '',
    });
    setEditingId(emp.id);
    setDialogOpen(true);
  };

  const toggleDiaLaboral = (dia) => {
    setForm(prev => {
      const dias = prev.dias_laborales || [];
      if (dias.includes(dia)) {
        return { ...prev, dias_laborales: dias.filter(d => d !== dia) };
      } else {
        return { ...prev, dias_laborales: [...dias, dia].sort() };
      }
    });
  };

  const DIAS_SEMANA = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mié' },
    { value: 4, label: 'Jue' },
    { value: 5, label: 'Vie' },
    { value: 6, label: 'Sáb' },
    { value: 0, label: 'Dom' },
  ];

  const handleSave = async () => {
    if (!form.nombre || !form.cedula || !form.cargo || !form.salario) {
      toast.error('Complete los campos obligatorios (nombre, cédula, cargo, salario)');
      return;
    }
    try {
      const data = { ...form, salario: parseFloat(form.salario), empresa_id: empresaActiva.id };
      delete data.id;
      delete data._id;
      delete data.created_at;

      // Construir horario si hay datos configurados
      const tieneHorario = form.hora_entrada_default || form.hora_salida_default ||
                          form.minutos_almuerzo_default || form.jornada_diaria_horas;
      if (tieneHorario) {
        data.horario = {
          hora_entrada_default: form.hora_entrada_default || '08:00',
          hora_salida_default: form.hora_salida_default || '17:00',
          minutos_almuerzo_default: parseInt(form.minutos_almuerzo_default) || 60,
          dias_laborales: form.dias_laborales || [1, 2, 3, 4, 5],
          jornada_diaria_horas: parseInt(form.jornada_diaria_horas) || 8,
        };
      }

      // Eliminar campos sueltos de horario del data principal
      delete data.hora_entrada_default;
      delete data.hora_salida_default;
      delete data.minutos_almuerzo_default;
      delete data.dias_laborales;
      delete data.jornada_diaria_horas;

      if (editingId) {
        await api.updateEmpleado(editingId, data);
        toast.success('Empleado actualizado');
      } else {
        await api.createEmpleado(data);
        toast.success('Empleado creado exitosamente');
      }
      setDialogOpen(false);
      onRefresh();
    } catch (err) {
      toast.error('Error al guardar empleado');
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteEmpleado(deleteId);
      toast.success('Empleado eliminado');
      setDeleteId(null);
      onRefresh();
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const u = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const estadoBadge = (estado) => {
    const map = {
      activo: 'bg-[rgba(74,222,128,0.1)] text-[#4ADE80] border-[#4ADE80]/20',
      inactivo: 'bg-[rgba(251,191,36,0.1)] text-[#FBBF24] border-[#FBBF24]/20',
      retirado: 'bg-[rgba(248,113,113,0.1)] text-[#F87171] border-[#F87171]/20',
    };
    return <Badge variant="outline" className={`text-[11px] capitalize ${map[estado] || ''}`}>{estado}</Badge>;
  };

  return (
    <div data-testid="empleados-view" className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Empleados</h1>
          <p className="text-[#A0A0A0] text-sm mt-1">{(empleados || []).length} empleados registrados</p>
        </div>
        <Button data-testid="add-empleado-btn" onClick={openNew} className="bg-white text-black hover:bg-[#E0E0E0] rounded-[8px] text-sm font-medium">
          <UserPlus size={16} className="mr-2" /> Nuevo empleado
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
        <Input
          data-testid="search-empleados"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, cédula o cargo..."
          className="pl-9 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white"
        />
      </div>

      <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Nombre</TableHead>
                <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Cédula</TableHead>
                <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Cargo</TableHead>
                <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Salario</TableHead>
                <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Estado</TableHead>
                <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(emp => (
                <TableRow key={emp.id} className="border-[#2A2A2A] hover:bg-[#1E1E1E] transition-colors duration-200">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
                        {emp.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-white">{emp.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[#A0A0A0]">{emp.cedula}</TableCell>
                  <TableCell className="text-[#A0A0A0]">{emp.cargo}</TableCell>
                  <TableCell className="text-right font-medium">{formatCOP(emp.salario)}</TableCell>
                  <TableCell>{estadoBadge(emp.estado)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button data-testid={`edit-emp-${emp.id}`} variant="ghost" size="icon" onClick={() => openEdit(emp)} className="h-8 w-8 text-[#A0A0A0] hover:text-white">
                        <Edit size={14} />
                      </Button>
                      <Button data-testid={`delete-emp-${emp.id}`} variant="ghost" size="icon" onClick={() => { setDeleteId(emp.id); setDeleteEmpNombre(emp.nombre); }} className="h-8 w-8 text-[#A0A0A0] hover:text-[#F87171]">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-[#A0A0A0] py-10 text-sm">No se encontraron empleados</p>
        )}
      </Card>

      {/* Employee form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#141414] border-[#2A2A2A] rounded-[16px] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{editingId ? 'Editar' : 'Nuevo'} empleado</DialogTitle>
            <DialogDescription className="text-[#A0A0A0] text-sm">Complete los datos del empleado</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="sm:col-span-2">
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Nombre completo *</Label>
              <Input data-testid="emp-nombre" value={form.nombre} onChange={e => u('nombre', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Cédula *</Label>
              <Input data-testid="emp-cedula" value={form.cedula} onChange={e => u('cedula', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Cargo *</Label>
              <Input data-testid="emp-cargo" value={form.cargo} onChange={e => u('cargo', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Fecha ingreso</Label>
              <Input data-testid="emp-fecha" type="date" value={form.fecha_ingreso} onChange={e => u('fecha_ingreso', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Tipo contrato</Label>
              <Select value={form.tipo_contrato} onValueChange={v => u('tipo_contrato', v)}>
                <SelectTrigger data-testid="emp-contrato" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>{TIPOS_CONTRATO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Salario base *</Label>
              <Input data-testid="emp-salario" type="number" value={form.salario} onChange={e => u('salario', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Riesgo ARL</Label>
              <Select value={form.riesgo_arl} onValueChange={v => u('riesgo_arl', v)}>
                <SelectTrigger data-testid="emp-arl" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>{NIVELES_ARL.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">EPS</Label>
              <Input data-testid="emp-eps" value={form.eps} onChange={e => u('eps', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">AFP</Label>
              <Input data-testid="emp-afp" value={form.afp} onChange={e => u('afp', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Caja compensación</Label>
              <Input data-testid="emp-caja" value={form.caja} onChange={e => u('caja', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Cuenta bancaria</Label>
              <Input data-testid="emp-cuenta" value={form.cuenta_bancaria} onChange={e => u('cuenta_bancaria', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Estado</Label>
              <Select value={form.estado} onValueChange={v => u('estado', v)}>
                <SelectTrigger data-testid="emp-estado" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                  <SelectItem value="retirado">Retirado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3 pt-2">
              <Switch data-testid="emp-auxilio" checked={form.auxilio_transporte} onCheckedChange={v => u('auxilio_transporte', v)} />
              <Label className="text-sm text-[#A0A0A0]">Aplica auxilio de transporte</Label>
            </div>

            {/* Configuración de horario contractual (opcional) */}
            <div className="sm:col-span-2 pt-4 border-t border-[#2A2A2A]">
              <h4 className="text-white text-sm font-medium mb-3">Configuración de horario contractual (opcional)</h4>
              <p className="text-[#A0A0A0] text-xs mb-4">Si no configura, se usarán los valores por defecto (08:00 - 17:00, 60 min almuerzo)</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div>
                  <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Hora entrada</Label>
                  <Input type="time" value={form.hora_entrada_default} onChange={e => u('hora_entrada_default', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
                </div>
                <div>
                  <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Hora salida</Label>
                  <Input type="time" value={form.hora_salida_default} onChange={e => u('hora_salida_default', e.target.value)} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
                </div>
                <div>
                  <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Almuerzo (min)</Label>
                  <Input type="number" min="30" max="120" value={form.minutos_almuerzo_default} onChange={e => u('minutos_almuerzo_default', e.target.value)} placeholder="60" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
                </div>
                <div>
                  <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Jornada (horas)</Label>
                  <Input type="number" min="1" max="12" value={form.jornada_diaria_horas} onChange={e => u('jornada_diaria_horas', e.target.value)} placeholder="8" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
                </div>
              </div>

              <div>
                <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest mb-2 block">Días laborales</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map(dia => (
                    <button
                      key={dia.value}
                      type="button"
                      onClick={() => toggleDiaLaboral(dia.value)}
                      className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
                        form.dias_laborales?.includes(dia.value)
                          ? 'bg-white text-black'
                          : 'bg-[#0A0A0A] border border-[#2A2A2A] text-[#A0A0A0] hover:border-[#A0A0A0]'
                      }`}
                    >
                      {dia.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2A2A2A]">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-[#2A2A2A] rounded-[8px] text-[#A0A0A0]">Cancelar</Button>
            <Button data-testid="save-empleado-btn" onClick={handleSave} className="bg-white text-black hover:bg-[#E0E0E0] rounded-[8px]">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#141414] border-[#2A2A2A] rounded-[16px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Eliminar empleado</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A0A0A0]">
              Esta acción eliminará permanentemente a <span className="text-white font-medium">{deleteEmpNombre}</span> junto con todo su historial de liquidaciones mensuales y liquidaciones finales. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#2A2A2A] rounded-[8px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-emp" onClick={handleDelete} className="bg-[#F87171] text-white hover:bg-[#ef4444] rounded-[8px]">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
