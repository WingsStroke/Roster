import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Users, AlertTriangle, Calendar } from 'lucide-react';
import { formatCOP, MESES } from '@/lib/constants';

export default function Dashboard({ empresaActiva, empleados, liquidaciones, onNavigate }) {
  const empleadosActivos = (empleados || []).filter(e => e.estado === 'activo');
  const now = new Date();
  const periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const liqsMes = (liquidaciones || []).filter(l => l.periodo === periodoActual);
  const totalNomina = liqsMes.reduce((sum, l) => sum + (l.neto || 0), 0);
  const pendientes = (liquidaciones || []).filter(l => l.estado === 'pendiente');

  const cards = [
    { label: 'Nómina del mes', value: formatCOP(totalNomina), icon: DollarSign, accent: '#4ADE80' },
    { label: 'Empleados activos', value: empleadosActivos.length, icon: Users, accent: '#FFFFFF' },
    { label: 'Pendientes', value: pendientes.length, icon: AlertTriangle, accent: pendientes.length > 0 ? '#FBBF24' : '#4ADE80' },
    { label: 'Período actual', value: `${MESES[now.getMonth()]} ${now.getFullYear()}`, icon: Calendar, accent: '#FFFFFF' },
  ];

  const statusBadge = (estado) => {
    const map = {
      pagada: 'bg-[rgba(74,222,128,0.1)] text-[#4ADE80] border-[#4ADE80]/20',
      pendiente: 'bg-[rgba(251,191,36,0.1)] text-[#FBBF24] border-[#FBBF24]/20',
      borrador: 'bg-[rgba(160,160,160,0.1)] text-[#A0A0A0] border-[#A0A0A0]/20',
    };
    const labels = { pagada: 'Pagada', pendiente: 'Pendiente', borrador: 'Borrador' };
    return <Badge variant="outline" className={`text-[11px] ${map[estado] || map.borrador}`}>{labels[estado] || estado}</Badge>;
  };

  return (
    <div data-testid="dashboard-view" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="text-[#A0A0A0] text-sm mt-1">{empresaActiva?.nombre} — Resumen general</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <Card
            key={i}
            data-testid={`dashboard-card-${i}`}
            className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6 hover:bg-[#1E1E1E] transition-colors duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-[#A0A0A0] uppercase tracking-widest">{c.label}</span>
              <c.icon size={18} style={{ color: c.accent }} />
            </div>
            <span className="font-heading text-2xl font-semibold text-white">{c.value}</span>
          </Card>
        ))}
      </div>

      <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-medium text-white">Últimas liquidaciones</h2>
          <button
            data-testid="ver-historial-btn"
            onClick={() => onNavigate('historial')}
            className="text-xs text-[#A0A0A0] hover:text-white transition-colors duration-200 uppercase tracking-wider"
          >
            Ver todo
          </button>
        </div>

        {(!liquidaciones || liquidaciones.length === 0) ? (
          <div className="text-center py-12">
            <DollarSign size={40} className="mx-auto text-[#2A2A2A] mb-3" />
            <p className="text-[#A0A0A0] text-sm">No hay liquidaciones registradas</p>
            <p className="text-[#555555] text-xs mt-1">Cree su primera liquidación usando el botón +</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Empleado</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Período</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Neto</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidaciones.slice(0, 5).map(liq => {
                  const emp = (empleados || []).find(e => e.id === liq.empleado_id);
                  return (
                    <TableRow key={liq.id} className="border-[#2A2A2A] hover:bg-[#1E1E1E] transition-colors duration-200">
                      <TableCell className="font-medium">{liq.empleado_nombre || emp?.nombre || '—'}</TableCell>
                      <TableCell className="text-[#A0A0A0]">{liq.periodo}</TableCell>
                      <TableCell className="text-right font-medium text-[#4ADE80]">{formatCOP(liq.neto || 0)}</TableCell>
                      <TableCell>{statusBadge(liq.estado)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
