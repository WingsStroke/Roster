import { LayoutDashboard, Users, Calculator, ClipboardList, Settings, ChevronLeft, ChevronRight, Building2, UserX, Layers, CalendarClock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'empleados', label: 'Empleados', icon: Users },
  { id: 'liquidacion', label: 'Liquidar Nómina', icon: Calculator },
  { id: 'liquidacion-lote', label: 'Liquidar por lotes', icon: Layers },
  { id: 'liquidacion-avanzada', label: 'Liquidación por Asistencia', icon: CalendarClock },
  { id: 'liquidacion-final', label: 'Liquidación Final', icon: UserX },
  { id: 'historial', label: 'Historial', icon: ClipboardList },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

export default function Sidebar({ activeSection, onSectionChange, isOpen, onToggle, empresaActiva, empresas, onEmpresaChange }) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onToggle}
          data-testid="sidebar-overlay"
        />
      )}
      <aside
        data-testid="sidebar"
        className={`fixed lg:relative inset-y-0 left-0 z-40 flex flex-col bg-[#0A0A0A] border-r border-[#2A2A2A] transition-all duration-200 ${
          isOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-4 border-b border-[#2A2A2A] shrink-0">
          {isOpen && (
            <span className="font-heading text-xl font-bold tracking-tight text-white">
              NóminaCol
            </span>
          )}
          <button
            data-testid="sidebar-toggle"
            onClick={onToggle}
            className="ml-auto text-[#A0A0A0] hover:text-white transition-colors duration-200"
          >
            {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Company selector */}
        {isOpen && empresaActiva && (
          <div className="p-3 border-b border-[#2A2A2A] shrink-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Building2 size={12} className="text-[#A0A0A0]" />
              <span className="text-[10px] text-[#A0A0A0] uppercase tracking-widest">Empresa</span>
            </div>
            <Select value={empresaActiva.id} onValueChange={v => onEmpresaChange(empresas.find(e => e.id === v))}>
              <SelectTrigger data-testid="empresa-selector" className="h-9 bg-[#141414] border-[#2A2A2A] text-sm rounded-[8px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {empresas.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                data-testid={`nav-${id}`}
                onClick={() => {
                  onSectionChange(id);
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-sm transition-all duration-200 ${
                  active
                    ? 'bg-white text-black font-medium'
                    : 'text-[#A0A0A0] hover:text-white hover:bg-[#1E1E1E]'
                }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                {isOpen && <span>{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        {isOpen && (
          <div className="p-3 border-t border-[#2A2A2A] shrink-0">
            <p className="text-[10px] text-[#555555] text-center tracking-wider">
              NOMINACOL v1.0 — COL 2026
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
