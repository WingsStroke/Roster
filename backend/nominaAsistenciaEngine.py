"""
Motor de cálculo de nómina por asistencia diaria - Colombia 2026
Cálculo automático de horas ordinarias, nocturnas, extras y recargos según CST
"""

from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


# Constantes legales Colombia 2026
HORA_INICIO_NOCTURNA = 21  # 21:00 (9pm)
HORA_FIN_NOCTURNA = 6      # 06:00 (6am)
HORA_INICIO_DIURNA = 6     # 06:00 (6am)
HORA_FIN_DIURNA = 21       # 21:00 (9pm)

# Recargos
RECARGO_NOCTURNO = 0.35           # 35% sobre hora ordinaria
RECARGO_DOMINICAL_FESTIVO = 0.75  # 75% sobre hora ordinaria (día completo)
RECARGO_DOMINICAL_EXTRA = 1.00    # 100% sobre hora ordinaria para extras
RECARGO_NOCTURNO_EXTRA = 0.75     # 75% adicional sobre hora ordinaria para extras nocturnas
RECARGO_DIURNO_EXTRA = 0.25       # 25% adicional sobre hora ordinaria para extras diurnas

# Límites Ley 2101/2021
MAX_HORAS_EXTRAS_DIARIAS = 2
MAX_HORAS_EXTRAS_SEMANALES = 12

# Festivos Colombia 2026 (ISO format: YYYY-MM-DD)
FESTIVOS_2026 = [
    "2026-01-01",   # Año Nuevo
    "2026-01-12",   # Día de Reyes (lunes siguiente)
    "2026-03-23",   # Día de San José (lunes siguiente)
    "2026-04-02",   # Jueves Santo
    "2026-04-03",   # Viernes Santo
    "2026-05-01",   # Día del Trabajo
    "2026-05-18",   # Ascensión (lunes siguiente)
    "2026-06-08",   # Corpus Christi (lunes siguiente)
    "2026-06-15",   # Sagrado Corazón (lunes siguiente)
    "2026-06-29",   # San Pedro y San Pablo
    "2026-07-20",   # Independencia
    "2026-08-07",   # Batalla de Boyacá
    "2026-08-17",   # Asunción (lunes siguiente)
    "2026-10-12",   # Día de la Raza (lunes siguiente)
    "2026-11-02",   # Todos los Santos (lunes siguiente)
    "2026-11-16",   # Independencia de Cartagena (lunes siguiente)
    "2026-12-08",   # Inmaculada Concepción
    "2026-12-25",   # Navidad
]


@dataclass
class ResultadoDia:
    """Resultado del cálculo para un día específico."""
    fecha: str
    estado: str
    horas_ordinarias: float = 0
    horas_nocturnas: float = 0
    horas_extra_diurna: float = 0
    horas_extra_nocturna: float = 0
    es_dominical_festivo: bool = False
    alertas: List[str] = None
    
    def __post_init__(self):
        if self.alertas is None:
            self.alertas = []


@dataclass  
class ResultadoLiquidacionAsistencia:
    """Resultado completo de la liquidación por asistencia."""
    empleado_id: str
    empresa_id: str
    fecha_inicio: str
    fecha_fin: str
    dias_calculados: List[ResultadoDia]
    
    # Totales
    total_dias_asistidos: int = 0
    total_dias_incapacidad: int = 0
    total_dias_licencia: int = 0
    total_dias_vacaciones: int = 0
    total_dias_festivos: int = 0
    
    # Horas
    total_horas_ordinarias: float = 0
    total_horas_nocturnas: float = 0
    total_horas_extra_diurna: float = 0
    total_horas_extra_nocturna: float = 0
    
    # Valores (para cálculo posterior)
    valor_hora_ordinaria: float = 0
    valor_auxilio_transporte_diario: float = 0
    auxilio_transporte_total: float = 0
    
    # Alertas
    alertas_ley_2101: List[str] = None
    
    def __post_init__(self):
        if self.alertas_ley_2101 is None:
            self.alertas_ley_2101 = []


def es_festivo(fecha: date) -> bool:
    """Verifica si una fecha es festivo en Colombia 2026."""
    return fecha.isoformat() in FESTIVOS_2026


def es_dominical(fecha: date) -> bool:
    """Verifica si una fecha es domingo (0 = domingo)."""
    return fecha.weekday() == 6


def es_dominical_o_festivo(fecha: date) -> bool:
    """Verifica si es domingo o festivo (aplica recargo)."""
    return es_dominical(fecha) or es_festivo(fecha)


def convertir_a_decimal(hora_str: str) -> float:
    """Convierte hora HH:MM a decimal (ej: '14:30' -> 14.5)."""
    hora, minuto = map(int, hora_str.split(':'))
    return hora + minuto / 60


def calcular_horas_nocturnas(hora_entrada_dec: float, hora_salida_dec: float) -> float:
    """
    Calcula las horas nocturnas trabajadas.
    Horario nocturno: 21:00 (21.0) a 06:00 (6.0)
    """
    horas_nocturnas = 0.0
    
    # Caso 1: Jornada dentro del horario nocturno (ej: 22:00 a 04:00)
    if hora_entrada_dec >= HORA_INICIO_NOCTURNA or hora_salida_dec <= HORA_FIN_NOCTURNA:
        if hora_salida_dec <= hora_entrada_dec:  # Cruza medianoche
            horas_nocturnas = (24 - hora_entrada_dec) + hora_salida_dec
        else:
            horas_nocturnas = hora_salida_dec - hora_entrada_dec
    # Caso 2: Jornada mixta (ej: 18:00 a 23:00)
    elif hora_entrada_dec < HORA_INICIO_NOCTURNA and hora_salida_dec > HORA_INICIO_NOCTURNA:
        horas_nocturnas = hora_salida_dec - HORA_INICIO_NOCTURNA
    # Caso 3: Jornada que cruza medianoche (ej: 20:00 a 02:00)
    elif hora_entrada_dec < HORA_INICIO_NOCTURNA and hora_salida_dec < HORA_ENTRADA_DEC and hora_salida_dec <= HORA_FIN_NOCTURNA:
        horas_nocturnas = (24 - HORA_INICIO_NOCTURNA) + hora_salida_dec
    
    return max(0, horas_nocturnas)


def calcular_jornada_diaria(
    hora_entrada: str,
    hora_salida: str,
    minutos_almuerzo: int,
    fecha: date,
    jornada_legal_diaria: float = 8.0
) -> Dict[str, Any]:
    """
    Calcula la jornada diaria desglosada según el Código Sustantivo del Trabajo.
    
    Returns:
        dict con horas_ordinarias, horas_nocturnas, horas_extra_diurna, horas_extra_nocturna,
        es_dominical_festivo, alertas
    """
    entrada_dec = convertir_a_decimal(hora_entrada)
    salida_dec = convertir_a_decimal(hora_salida)
    
    # Validación básica
    if salida_dec <= entrada_dec:
        raise ValueError("Hora de salida debe ser mayor a hora de entrada")
    
    # Tiempo total en la empresa
    if salida_dec > entrada_dec:
        tiempo_total = salida_dec - entrada_dec
    else:
        # Cruza medianoche
        tiempo_total = (24 - entrada_dec) + salida_dec
    
    # Tiempo efectivo de trabajo (restando almuerzo)
    horas_almuerzo = minutos_almuerzo / 60
    horas_trabajadas = max(0, tiempo_total - horas_almuerzo)
    
    # Calcular horas nocturnas (21:00 - 06:00)
    horas_nocturnas = calcular_horas_nocturnas(entrada_dec, salida_dec)
    horas_nocturnas = min(horas_nocturnas, horas_trabajadas)  # No puede exceder las trabajadas
    
    # Horas diurnas = total - nocturnas (aproximado, simplificado)
    horas_diurnas = max(0, horas_trabajadas - horas_nocturnas)
    
    # Determinar si es dominical/festivo
    es_dom_fest = es_dominical_o_festivo(fecha)
    
    # Cálculo de horas extras (sobre la jornada legal)
    horas_extra_total = max(0, horas_trabajadas - jornada_legal_diaria)
    
    # Distribuir extras entre diurnas y nocturnas proporcionalmente
    if horas_extra_total > 0 and horas_trabajadas > 0:
        proporcion_nocturna = horas_nocturnas / horas_trabajadas
        horas_extra_nocturna = round(horas_extra_total * proporcion_nocturna, 2)
        horas_extra_diurna = round(horas_extra_total - horas_extra_nocturna, 2)
    else:
        horas_extra_nocturna = 0
        horas_extra_diurna = 0
    
    # Horas ordinarias (dentro de la jornada legal)
    horas_ordinarias = min(horas_trabajadas, jornada_legal_diaria)
    
    # Alertas Ley 2101/2021
    alertas = []
    if horas_extra_total > MAX_HORAS_EXTRAS_DIARIAS:
        alertas.append(f"EXCESO_EXTRAS_DIARIAS: {horas_extra_total:.2f}h > {MAX_HORAS_EXTRAS_DIARIAS}h máximo legal")
    
    # Recargos para horas ordinarias en dominical/festivo
    # Nota: Los recargos se aplican como multiplicadores del valor de la hora,
    # aquí solo calculamos las horas base
    
    return {
        'horas_ordinarias': round(horas_ordinarias, 2),
        'horas_nocturnas': round(horas_nocturnas, 2),
        'horas_extra_diurna': horas_extra_diurna,
        'horas_extra_nocturna': horas_extra_nocturna,
        'es_dominical_festivo': es_dom_fest,
        'alertas': alertas,
        'total_horas_trabajadas': round(horas_trabajadas, 2)
    }


def calcular_liquidacion_asistencia(
    empleado_id: str,
    empresa_id: str,
    fecha_inicio: date,
    fecha_fin: date,
    asistencias: List[Dict[str, Any]],
    salario_mensual: float,
    auxilio_transporte_mensual: float,
    jornada_diaria_horas: float = 8.0,
    config: Optional[Dict] = None
) -> ResultadoLiquidacionAsistencia:
    """
    Calcula la liquidación completa basada en asistencia diaria.
    
    Args:
        empleado_id: ID del empleado
        empresa_id: ID de la empresa
        fecha_inicio: Fecha inicial del período
        fecha_fin: Fecha final del período
        asistencias: Lista de registros de asistencia
        salario_mensual: Salario base mensual
        auxilio_transporte_mensual: Valor mensual del auxilio de transporte
        jornada_diaria_horas: Horas de jornada legal diaria
        config: Configuración adicional
    
    Returns:
        ResultadoLiquidacionAsistencia con totales y desglose diario
    """
    resultado = ResultadoLiquidacionAsistencia(
        empleado_id=empleado_id,
        empresa_id=empresa_id,
        fecha_inicio=fecha_inicio.isoformat(),
        fecha_fin=fecha_fin.isoformat(),
        dias_calculados=[]
    )
    
    # Calcular valor hora ordinaria
    # Base: 30 días, horas mensuales = jornada_diaria * (52/12 semanas)
    horas_mes = jornada_diaria_horas * 52 / 12
    valor_hora = salario_mensual / horas_mes
    resultado.valor_hora_ordinaria = round(valor_hora, 2)
    
    # Auxilio de transporte diario
    auxilio_diario = auxilio_transporte_mensual / 30
    resultado.valor_auxilio_transporte_diario = round(auxilio_diario, 2)
    
    # Contador de extras semanales para alertas
    extras_semanales = 0
    semana_actual = None
    
    for asistencia in asistencias:
        fecha_str = asistencia.get('fecha')
        fecha = date.fromisoformat(fecha_str)
        estado = asistencia.get('estado', 'asistio')
        
        resultado_dia = ResultadoDia(
            fecha=fecha_str,
            estado=estado
        )
        
        # Contar días por estado
        if estado == 'asistio':
            resultado.total_dias_asistidos += 1
        elif estado == 'incapacidad':
            resultado.total_dias_incapacidad += 1
        elif estado == 'licencia':
            resultado.total_dias_licencia += 1
        elif estado == 'vacaciones':
            resultado.total_dias_vacaciones += 1
        elif estado == 'festivo':
            resultado.total_dias_festivos += 1
        
        # Calcular solo si asistió y tiene horas registradas
        if estado == 'asistio' and asistencia.get('hora_entrada') and asistencia.get('hora_salida'):
            try:
                minutos_almuerzo = asistencia.get('minutos_almuerzo', 60)
                
                calculo = calcular_jornada_diaria(
                    asistencia['hora_entrada'],
                    asistencia['hora_salida'],
                    minutos_almuerzo,
                    fecha,
                    jornada_diaria_horas
                )
                
                resultado_dia.horas_ordinarias = calculo['horas_ordinarias']
                resultado_dia.horas_nocturnas = calculo['horas_nocturnas']
                resultado_dia.horas_extra_diurna = calculo['horas_extra_diurna']
                resultado_dia.horas_extra_nocturna = calculo['horas_extra_nocturna']
                resultado_dia.es_dominical_festivo = calculo['es_dominical_festivo']
                resultado_dia.alertas = calculo['alertas']
                
                # Acumular totales
                resultado.total_horas_ordinarias += calculo['horas_ordinarias']
                resultado.total_horas_nocturnas += calculo['horas_nocturnas']
                resultado.total_horas_extra_diurna += calculo['horas_extra_diurna']
                resultado.total_horas_extra_nocturna += calculo['horas_extra_nocturna']
                
                # Control de extras semanales (Ley 2101/2021)
                semana_num = fecha.isocalendar()[1]
                if semana_num != semana_actual:
                    semana_actual = semana_num
                    extras_semanales = 0
                
                extras_dia = calculo['horas_extra_diurna'] + calculo['horas_extra_nocturna']
                extras_semanales += extras_dia
                
                if extras_semanales > MAX_HORAS_EXTRAS_SEMANALES:
                    alerta_semanal = f"EXCESO_EXTRAS_SEMANAL_S{semana_num}: {extras_semanales:.2f}h > {MAX_HORAS_EXTRAS_SEMANALES}h máximo"
                    if alerta_semanal not in resultado.alertas_ley_2101:
                        resultado.alertas_ley_2101.append(alerta_semanal)
                
            except ValueError as e:
                resultado_dia.alertas.append(f"ERROR_CALCULO: {str(e)}")
        
        resultado.dias_calculados.append(resultado_dia)
    
    # Calcular auxilio de transporte proporcional
    # Solo días donde el empleado asistió físicamente
    resultado.auxilio_transporte_total = round(
        resultado.total_dias_asistidos * auxilio_diario, 2
    )
    
    # Redondear totales
    resultado.total_horas_ordinarias = round(resultado.total_horas_ordinarias, 2)
    resultado.total_horas_nocturnas = round(resultado.total_horas_nocturnas, 2)
    resultado.total_horas_extra_diurna = round(resultado.total_horas_extra_diurna, 2)
    resultado.total_horas_extra_nocturna = round(resultado.total_horas_extra_nocturna, 2)
    
    return resultado


def obtener_festivos_2026() -> List[str]:
    """Retorna la lista de festivos Colombia 2026."""
    return FESTIVOS_2026.copy()


def generar_precarga_asistencia(
    fecha_inicio: date,
    fecha_fin: date,
    horario: Dict[str, Any],
    empleado_id: str,
    empresa_id: str
) -> List[Dict[str, Any]]:
    """
    Genera registros de asistencia precargados con horario contractual.
    Marca automáticamente festivos y días no laborales.
    """
    registros = []
    dias_laborales = set(horario.get('dias_laborales', [1, 2, 3, 4, 5]))
    
    fecha_actual = fecha_inicio
    while fecha_actual <= fecha_fin:
        dia_semana = fecha_actual.weekday()
        es_laboral = dia_semana in dias_laborales
        es_festivo_dia = es_festivo(fecha_actual)
        
        if es_festivo_dia:
            estado = 'festivo'
        elif es_laboral:
            estado = 'asistio'
        else:
            estado = 'inasistencia'  # Fin de semana no laboral
        
        registro = {
            'empleado_id': empleado_id,
            'empresa_id': empresa_id,
            'fecha': fecha_actual.isoformat(),
            'estado': estado,
            'hora_entrada': horario.get('hora_entrada_default') if estado == 'asistio' else None,
            'hora_salida': horario.get('hora_salida_default') if estado == 'asistio' else None,
            'minutos_almuerzo': horario.get('minutos_almuerzo_default', 60) if estado == 'asistio' else None,
        }
        
        registros.append(registro)
        fecha_actual += timedelta(days=1)
    
    return registros
