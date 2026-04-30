import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Search, Trash2, Eye, FileText, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCOP } from '@/lib/constants';
import { generarDesprendiblePDF } from '@/lib/pdfGenerator';

export default function Historial({ empleados, liquidaciones, empresaActiva, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [detailLiq, setDetailLiq] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const filtered = (liquidaciones || []).filter(l => {
    const matchSearch = !search ||
      (l.empleado_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
      l.periodo?.includes(search);
    const matchEstado = filterEstado === 'todos' || l.estado === filterEstado;
    return matchSearch && matchEstado;
  });

  const handleDelete = async () => {
    try {
      await api.deleteLiquidacion(deleteId);
      toast.success('Liquidación eliminada');
      setDeleteId(null);
      onRefresh();
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

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
    <div data-testid="historial-view" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Historial</h1>
        <p className="text-[#A0A0A0] text-sm mt-1">{filtered.length} liquidaciones encontradas</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
          <Input
            data-testid="search-historial"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por empleado o período..."
            className="pl-9 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px] focus:border-white"
          />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger data-testid="filter-estado" className="w-40 bg-[#0A0A0A] border-[#2A2A2A] rounded-[8px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pagada">Pagada</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-[#141414] border-[#2A2A2A] rounded-[12px] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList size={40} className="mx-auto text-[#2A2A2A] mb-3" />
            <p className="text-[#A0A0A0] text-sm">No hay liquidaciones en el historial</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Empleado</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Período</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Devengado</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Deducciones</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Neto</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider">Estado</TableHead>
                  <TableHead className="text-[#A0A0A0] text-xs uppercase tracking-wider text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(liq => (
                  <TableRow key={liq.id} className="border-[#2A2A2A] hover:bg-[#1E1E1E] transition-colors duration-200">
                    <TableCell className="font-medium text-white">{liq.empleado_nombre || '—'}</TableCell>
                    <TableCell className="text-[#A0A0A0]">{liq.periodo}</TableCell>
                    <TableCell className="text-right">{formatCOP(liq.devengado?.total || 0)}</TableCell>
                    <TableCell className="text-right text-[#F87171]">-{formatCOP(liq.deducciones?.total || 0)}</TableCell>
                    <TableCell className="text-right font-medium text-[#4ADE80]">{formatCOP(liq.neto || 0)}</TableCell>
                    <TableCell>{statusBadge(liq.estado)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button data-testid={`view-liq-${liq.id}`} variant="ghost" size="icon" onClick={() => setDetailLiq(liq)} className="h-8 w-8 text-[#A0A0A0] hover:text-white"><Eye size={14} /></Button>
                        <Button data-testid={`pdf-liq-${liq.id}`} variant="ghost" size="icon" onClick={() => generarDesprendiblePDF(liq, empresaActiva)} className="h-8 w-8 text-[#A0A0A0] hover:text-white"><FileText size={14} /></Button>
                        <Button data-testid={`del-liq-${liq.id}`} variant="ghost" size="icon" onClick={() => setDeleteId(liq.id)} className="h-8 w-8 text-[#A0A0A0] hover:text-[#F87171]"><Trash2 size={14} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailLiq} onOpenChange={open => !open && setDetailLiq(null)}>
        <DialogContent className="bg-[#141414] border-[#2A2A2A] rounded-[16px] max-w-lg max-h-[85vh] overflow-y-auto">
          {detailLiq && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading text-lg">Detalle de liquidación</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2 text-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-white">{detailLiq.empleado_nombre}</p>
                    <p className="text-xs text-[#A0A0A0]">{detailLiq.empleado_cargo} — C.C. {detailLiq.empleado_cedula}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#A0A0A0] text-xs">{detailLiq.periodo}</p>
                    {statusBadge(detailLiq.estado)}
                  </div>
                </div>
                <Separator className="bg-[#2A2A2A]" />
                <div>
                  <h4 className="text-[10px] text-[#A0A0A0] uppercase tracking-widest mb-2">Devengados</h4>
                  {detailLiq.devengado && Object.entries(detailLiq.devengado)
                    .filter(([k, v]) => k !== 'total' && k !== 'detalle_extras' && v !== 0)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5">
                        <span className="text-[#A0A0A0] capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className={v < 0 ? 'text-[#F87171]' : ''}>{formatCOP(v)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between font-medium mt-1 pt-1 border-t border-[#2A2A2A] text-white">
                    <span>Total</span><span>{formatCOP(detailLiq.devengado?.total || 0)}</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] text-[#A0A0A0] uppercase tracking-widest mb-2">Deducciones</h4>
                  <div className="flex justify-between py-0.5"><span className="text-[#A0A0A0]">Salud</span><span className="text-[#F87171]">-{formatCOP(detailLiq.deducciones?.salud || 0)}</span></div>
                  <div className="flex justify-between py-0.5"><span className="text-[#A0A0A0]">Pensión</span><span className="text-[#F87171]">-{formatCOP(detailLiq.deducciones?.pension || 0)}</span></div>
                  {detailLiq.deducciones?.descuentos_adicionales > 0 && (
                    <div className="flex justify-between py-0.5"><span className="text-[#A0A0A0]">Otros</span><span className="text-[#F87171]">-{formatCOP(detailLiq.deducciones.descuentos_adicionales)}</span></div>
                  )}
                  <div className="flex justify-between font-medium mt-1 pt-1 border-t border-[#2A2A2A]">
                    <span className="text-white">Total</span><span className="text-[#F87171]">-{formatCOP(detailLiq.deducciones?.total || 0)}</span>
                  </div>
                </div>
                <Separator className="bg-[#2A2A2A]" />
                <div className="flex justify-between text-lg font-heading font-semibold">
                  <span className="text-white">Neto a pagar</span>
                  <span className="text-[#4ADE80]">{formatCOP(detailLiq.neto || 0)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#141414] border-[#2A2A2A] rounded-[16px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Eliminar liquidación</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A0A0A0]">Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#2A2A2A] rounded-[8px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-liq" onClick={handleDelete} className="bg-[#F87171] text-white hover:bg-[#ef4444] rounded-[8px]">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
