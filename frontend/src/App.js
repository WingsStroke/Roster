import { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Menu } from 'lucide-react';
import { api } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import Empleados from '@/components/Empleados';
import NuevaLiquidacion from '@/components/NuevaLiquidacion';
import Historial from '@/components/Historial';
import LiquidacionFinal from '@/components/LiquidacionFinal';
import LiquidacionLote from '@/components/LiquidacionLote';
import Configuracion from '@/components/Configuracion';
import '@/App.css';

function App() {
  const [empresas, setEmpresas] = useState([]);
  const [empresaActiva, setEmpresaActiva] = useState(null);
  const [empleados, setEmpleados] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [config, setConfig] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const empresasList = await api.getEmpresas();
      setEmpresas(empresasList);
      if (empresasList.length > 0) setEmpresaActiva(empresasList[0]);
      const cfg = await api.getConfiguracion();
      setConfig(cfg);
    } catch (err) {
      console.error('Init error:', err);
      toast.error('Error al inicializar la aplicación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresaActiva) loadCompanyData();
  }, [empresaActiva?.id]);

  const loadCompanyData = async () => {
    try {
      const [emps, liqs] = await Promise.all([
        api.getEmpleados(empresaActiva.id),
        api.getLiquidaciones(empresaActiva.id),
      ]);
      setEmpleados(emps);
      setLiquidaciones(liqs);
    } catch (err) {
      toast.error('Error al cargar datos de la empresa');
    }
  };

  const refreshData = useCallback(() => {
    if (empresaActiva) loadCompanyData();
  }, [empresaActiva?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0A0A]">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-white mb-2">NóminaCol</h1>
          <p className="text-[#A0A0A0] text-sm">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const props = { empresaActiva, empleados, liquidaciones, config, onRefresh: refreshData, onNavigate: setActiveSection };
    switch (activeSection) {
      case 'dashboard': return <Dashboard {...props} />;
      case 'empleados': return <Empleados {...props} />;
      case 'liquidacion': return <NuevaLiquidacion {...props} />;
      case 'liquidacion-final': return <LiquidacionFinal {...props} />;
      case 'liquidacion-lote': return <LiquidacionLote {...props} />;
      case 'historial': return <Historial {...props} />;
      case 'configuracion': return <Configuracion {...props} onUpdate={setConfig} empresas={empresas} onEmpresaUpdate={(emp) => { setEmpresaActiva(emp); }} />;
      default: return <Dashboard {...props} />;
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen bg-[#0A0A0A] overflow-hidden">
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          toastOptions={{
            style: { background: '#141414', border: '1px solid #2A2A2A', color: '#F5F5F5' },
          }}
        />

        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          empresaActiva={empresaActiva}
          empresas={empresas}
          onEmpresaChange={setEmpresaActiva}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="lg:hidden flex items-center p-4 border-b border-[#2A2A2A]">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} data-testid="mobile-menu-btn" className="text-[#A0A0A0] hover:text-white transition-colors">
              <Menu size={22} />
            </button>
            <span className="ml-3 font-heading text-lg font-semibold">NóminaCol</span>
          </div>
          <div className="p-6 lg:p-8 animate-fadeIn">
            {renderContent()}
          </div>
        </main>

        {activeSection !== 'liquidacion' && activeSection !== 'liquidacion-final' && activeSection !== 'liquidacion-lote' && (
          <button
            data-testid="fab-nueva-liquidacion"
            onClick={() => setActiveSection('liquidacion')}
            className="fixed bottom-6 right-6 bg-white text-black rounded-full px-5 py-3.5 hover:bg-[#E0E0E0] transition-all duration-200 z-50 flex items-center gap-2 font-medium text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nueva liquidación</span>
          </button>
        )}
      </div>
    </TooltipProvider>
  );
}

export default App;
