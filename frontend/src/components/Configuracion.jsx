import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Building2, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIPOS_EMPLEADOR } from '@/lib/constants';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function Configuracion({ config, onUpdate, empresaActiva, onEmpresaUpdate }) {
  const [cf, setCf] = useState({ smmlv: 0, auxilio_transporte: 0, jornada_horas: 44, ano: 2026 });
  const [ef, setEf] = useState({ nombre: '', nit: '', direccion: '', telefono: '', representante: '', tipo_empleador: 'juridica' });

  useEffect(() => {
    if (config) setCf({ smmlv: config.smmlv, auxilio_transporte: config.auxilio_transporte, jornada_horas: config.jornada_horas, ano: config.ano });
  }, [config]);

  useEffect(() => {
    if (empresaActiva) setEf({ nombre: empresaActiva.nombre || '', nit: empresaActiva.nit || '', direccion: empresaActiva.direccion || '', telefono: empresaActiva.telefono || '', representante: empresaActiva.representante || '', tipo_empleador: empresaActiva.tipo_empleador || 'juridica' });
  }, [empresaActiva]);

  const saveConfig = async () => {
    try {
      const updated = await api.updateConfiguracion({
        smmlv: parseFloat(cf.smmlv), auxilio_transporte: parseFloat(cf.auxilio_transporte),
        jornada_horas: parseInt(cf.jornada_horas), ano: parseInt(cf.ano),
      });
      onUpdate(updated);
      toast.success('Configuración actualizada');
    } catch (e) { toast.error('Error al actualizar'); }
  };

  const saveEmpresa = async () => {
    try {
      const updated = await api.updateEmpresa(empresaActiva.id, ef);
      onEmpresaUpdate(updated);
      toast.success('Empresa actualizada');
    } catch (e) { toast.error('Error al actualizar empresa'); }
  };

  return (
    <div data-testid="configuracion-view" className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Configuración</h1>

      {/* Legal constants */}
      <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6 space-y-4">
        <h3 className="font-heading text-base font-medium flex items-center gap-2 text-white">
          <Settings size={18} /> Constantes legales {cf.ano}
        </h3>
        <p className="text-xs text-[#A0A0A0]">Valores actualizados según normativa colombiana vigente</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">SMMLV ($)</Label>
            <Input data-testid="config-smmlv" type="number" value={cf.smmlv} onChange={e => setCf(p => ({ ...p, smmlv: e.target.value }))} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
          </div>
          <div>
            <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Auxilio transporte ($)</Label>
            <Input data-testid="config-auxilio" type="number" value={cf.auxilio_transporte} onChange={e => setCf(p => ({ ...p, auxilio_transporte: e.target.value }))} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
          </div>
          <div>
            <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Jornada semanal (hrs)</Label>
            <Input data-testid="config-jornada" type="number" value={cf.jornada_horas} onChange={e => setCf(p => ({ ...p, jornada_horas: e.target.value }))} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
          </div>
          <div>
            <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Año</Label>
            <Input data-testid="config-ano" type="number" value={cf.ano} onChange={e => setCf(p => ({ ...p, ano: e.target.value }))} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button data-testid="save-config-btn" onClick={saveConfig} className="bg-white text-black hover:bg-[#E0E0E0] rounded-[8px] text-sm">
            <Save size={16} className="mr-2" /> Guardar configuración
          </Button>
        </div>
      </Card>

      {/* Company settings */}
      {empresaActiva && (
        <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6 space-y-4">
          <h3 className="font-heading text-base font-medium flex items-center gap-2 text-white">
            <Building2 size={18} /> Empresa activa
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Nombre</Label>
              <Input data-testid="empresa-nombre" value={ef.nombre} onChange={e => setEf(p => ({ ...p, nombre: e.target.value }))} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">NIT</Label>
              <Input data-testid="empresa-nit" value={ef.nit} onChange={e => setEf(p => ({ ...p, nit: e.target.value }))} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div>
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Teléfono</Label>
              <Input data-testid="empresa-tel" value={ef.telefono} onChange={e => setEf(p => ({ ...p, telefono: e.target.value }))} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Dirección</Label>
              <Input data-testid="empresa-dir" value={ef.direccion} onChange={e => setEf(p => ({ ...p, direccion: e.target.value }))} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">Representante legal</Label>
              <Input data-testid="empresa-rep" value={ef.representante} onChange={e => setEf(p => ({ ...p, representante: e.target.value }))} className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[#A0A0A0] text-[10px] uppercase tracking-widest">
                Tipo de empleador
                <span className="ml-1 normal-case text-[#555555]">(afecta exoneración SENA e ICBF — Art. 114-1 ET)</span>
              </Label>
              <Select value={ef.tipo_empleador} onValueChange={v => setEf(p => ({ ...p, tipo_empleador: v }))}>
                <SelectTrigger data-testid="empresa-tipo-empleador" className="mt-1.5 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EMPLEADOR.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button data-testid="save-empresa-btn" onClick={saveEmpresa} className="bg-white text-black hover:bg-[#E0E0E0] rounded-[8px] text-sm">
              <Save size={16} className="mr-2" /> Guardar empresa
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
