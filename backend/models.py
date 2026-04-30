"""
Modelos Pydantic para validación de datos de entrada.
NóminaCol - Validación de schemas para API
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import date
import re


# ============================================================================
# EMPRESAS
# ============================================================================

class EmpresaBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre de la empresa")
    nit: str = Field(..., min_length=5, max_length=20, description="NIT con dígito de verificación")
    direccion: Optional[str] = Field(None, max_length=200)
    telefono: Optional[str] = Field(None, max_length=20)
    representante: Optional[str] = Field(None, max_length=100)

    @field_validator('nit')
    @classmethod
    def validar_nit(cls, v: str) -> str:
        """Valida formato básico de NIT colombiano."""
        # Remover puntos y guiones para validación interna
        nit_limpio = re.sub(r'[.\-]', '', v)
        if not re.match(r'^\d{9,12}$', nit_limpio):
            raise ValueError('NIT debe contener entre 9 y 12 dígitos numéricos')
        return v

    @field_validator('telefono')
    @classmethod
    def validar_telefono(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Permitir solo dígitos, espacios, guiones y paréntesis
        if not re.match(r'^[\d\s\-\(\)]+$', v):
            raise ValueError('Teléfono solo debe contener números, espacios, guiones y paréntesis')
        digitos = re.sub(r'\D', '', v)
        if len(digitos) < 7 or len(digitos) > 15:
            raise ValueError('Teléfono debe tener entre 7 y 15 dígitos')
        return v


class EmpresaCreate(EmpresaBase):
    """Schema para crear nueva empresa."""
    pass


class EmpresaUpdate(BaseModel):
    """Schema para actualizar empresa - todos los campos opcionales."""
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    nit: Optional[str] = Field(None, min_length=5, max_length=20)
    direccion: Optional[str] = Field(None, max_length=200)
    telefono: Optional[str] = Field(None, max_length=20)
    representante: Optional[str] = Field(None, max_length=100)

    @field_validator('nit')
    @classmethod
    def validar_nit(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        nit_limpio = re.sub(r'[.\-]', '', v)
        if not re.match(r'^\d{9,12}$', nit_limpio):
            raise ValueError('NIT debe contener entre 9 y 12 dígitos numéricos')
        return v


# ============================================================================
# EMPLEADOS
# ============================================================================

TIPO_CONTRATO = Literal['indefinido', 'fijo', 'obra']
RIESGO_ARL = Literal['I', 'II', 'III', 'IV', 'V']
ESTADO_EMPLEADO = Literal['activo', 'retirado', 'vacaciones', 'incapacidad']


class EmpleadoBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    cedula: str = Field(..., min_length=6, max_length=15, description="Número de documento (CC, CE, etc.)")
    cargo: str = Field(..., min_length=2, max_length=100)
    fecha_ingreso: str = Field(..., description="Fecha en formato YYYY-MM-DD")
    tipo_contrato: TIPO_CONTRATO
    salario: float = Field(..., gt=0, description="Salario mensual en COP")
    riesgo_arl: RIESGO_ARL
    auxilio_transporte: bool = True
    eps: Optional[str] = Field(None, max_length=50)
    afp: Optional[str] = Field(None, max_length=50)
    caja: Optional[str] = Field(None, max_length=50)
    cuenta_bancaria: Optional[str] = Field(None, max_length=30)
    estado: ESTADO_EMPLEADO = 'activo'

    @field_validator('cedula')
    @classmethod
    def validar_cedula(cls, v: str) -> str:
        """Valida formato de documento de identidad."""
        cedula_limpia = re.sub(r'[.\-,\s]', '', v)
        if not re.match(r'^\d{6,12}$', cedula_limpia):
            raise ValueError('Cédula debe contener entre 6 y 12 dígitos numéricos')
        return v

    @field_validator('fecha_ingreso')
    @classmethod
    def validar_fecha_ingreso(cls, v: str) -> str:
        """Valida que la fecha tenga formato correcto y no sea futura."""
        try:
            fecha = date.fromisoformat(v)
        except ValueError:
            raise ValueError('Fecha de ingreso debe tener formato YYYY-MM-DD')
        
        if fecha > date.today():
            raise ValueError('Fecha de ingreso no puede ser futura')
        
        return v

    @field_validator('cuenta_bancaria')
    @classmethod
    def validar_cuenta(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return v
        # Cuentas bancarias colombianas: 10-20 dígitos
        cuenta_limpia = re.sub(r'[\s\-]', '', v)
        if not re.match(r'^\d{10,20}$', cuenta_limpia):
            raise ValueError('Cuenta bancaria debe tener entre 10 y 20 dígitos')
        return v


class EmpleadoCreate(EmpleadoBase):
    """Schema para crear nuevo empleado."""
    empresa_id: str = Field(..., min_length=1)


class EmpleadoUpdate(BaseModel):
    """Schema para actualizar empleado - campos opcionales."""
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    cedula: Optional[str] = Field(None, min_length=6, max_length=15)
    cargo: Optional[str] = Field(None, min_length=2, max_length=100)
    fecha_ingreso: Optional[str] = Field(None)
    tipo_contrato: Optional[TIPO_CONTRATO] = None
    salario: Optional[float] = Field(None, gt=0)
    riesgo_arl: Optional[RIESGO_ARL] = None
    auxilio_transporte: Optional[bool] = None
    eps: Optional[str] = Field(None, max_length=50)
    afp: Optional[str] = Field(None, max_length=50)
    caja: Optional[str] = Field(None, max_length=50)
    cuenta_bancaria: Optional[str] = Field(None, max_length=30)
    estado: Optional[ESTADO_EMPLEADO] = None

    @field_validator('cedula')
    @classmethod
    def validar_cedula(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cedula_limpia = re.sub(r'[.\-,\s]', '', v)
        if not re.match(r'^\d{6,12}$', cedula_limpia):
            raise ValueError('Cédula debe contener entre 6 y 12 dígitos numéricos')
        return v

    @field_validator('fecha_ingreso')
    @classmethod
    def validar_fecha_ingreso(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            fecha = date.fromisoformat(v)
        except ValueError:
            raise ValueError('Fecha de ingreso debe tener formato YYYY-MM-DD')
        if fecha > date.today():
            raise ValueError('Fecha de ingreso no puede ser futura')
        return v


# ============================================================================
# LIQUIDACIONES
# ============================================================================

ESTADO_LIQUIDACION = Literal['pendiente', 'pagado', 'anulado']


class NovedadesLiquidacion(BaseModel):
    """Novedades para cálculo de nómina."""
    horas_extra_diurna: Optional[float] = Field(None, ge=0)
    horas_extra_nocturna: Optional[float] = Field(None, ge=0)
    horas_extra_dom_diurna: Optional[float] = Field(None, ge=0)
    horas_extra_dom_nocturna: Optional[float] = Field(None, ge=0)
    horas_recargo_nocturno: Optional[float] = Field(None, ge=0)
    horas_recargo_dominical: Optional[float] = Field(None, ge=0)
    bonificaciones: Optional[float] = Field(None, ge=0)
    comisiones: Optional[float] = Field(None, ge=0)
    dias_incapacidad: Optional[int] = Field(None, ge=0, le=30)
    dias_licencia: Optional[int] = Field(None, ge=0, le=30)
    descuentos_adicionales: Optional[float] = Field(None, ge=0)
    descripcion_descuentos: Optional[str] = Field(None, max_length=200)


class LiquidacionCreate(BaseModel):
    """Schema para crear liquidación mensual."""
    empresa_id: str = Field(..., min_length=1)
    empleado_id: str = Field(..., min_length=1)
    periodo: str = Field(..., description="Formato: YYYY-MM")
    dias_trabajados: int = Field(..., ge=1, le=30)
    novedades: Optional[NovedadesLiquidacion] = None
    estado: ESTADO_LIQUIDACION = 'pendiente'

    @field_validator('periodo')
    @classmethod
    def validar_periodo(cls, v: str) -> str:
        """Valida formato de período YYYY-MM."""
        if not re.match(r'^\d{4}-\d{2}$', v):
            raise ValueError('Período debe tener formato YYYY-MM (ej: 2024-03)')
        return v


class LiquidacionUpdate(BaseModel):
    """Schema para actualizar liquidación."""
    periodo: Optional[str] = None
    dias_trabajados: Optional[int] = Field(None, ge=1, le=30)
    novedades: Optional[NovedadesLiquidacion] = None
    estado: Optional[ESTADO_LIQUIDACION] = None

    @field_validator('periodo')
    @classmethod
    def validar_periodo(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.match(r'^\d{4}-\d{2}$', v):
            raise ValueError('Período debe tener formato YYYY-MM')
        return v


# ============================================================================
# LIQUIDACIONES FINAL (RETIRO)
# ============================================================================

CAUSA_RETIRO = Literal['renuncia', 'despido_justa_causa', 'despido_sin_justa_causa', 'mutuo_acuerdo', 'vencimiento_contrato']


class LiquidacionFinalCreate(BaseModel):
    """Schema para crear liquidación de retiro."""
    empresa_id: str = Field(..., min_length=1)
    empleado_id: str = Field(..., min_length=1)
    fecha_retiro: str = Field(..., description="Formato: YYYY-MM-DD")
    causa: CAUSA_RETIRO
    fecha_vencimiento_contrato: Optional[str] = None
    dias_vacaciones_disfrutados: int = Field(0, ge=0)

    @field_validator('fecha_retiro')
    @classmethod
    def validar_fecha_retiro(cls, v: str) -> str:
        try:
            fecha = date.fromisoformat(v)
        except ValueError:
            raise ValueError('Fecha de retiro debe tener formato YYYY-MM-DD')
        return v

    @field_validator('fecha_vencimiento_contrato')
    @classmethod
    def validar_fecha_vencimiento(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError('Fecha de vencimiento debe tener formato YYYY-MM-DD')
        return v


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

class ConfiguracionUpdate(BaseModel):
    """Schema para actualizar configuración legal."""
    smmlv: Optional[float] = Field(None, gt=0)
    auxilio_transporte: Optional[float] = Field(None, ge=0)
    jornada_horas: Optional[int] = Field(None, ge=1, le=48)
    ano: Optional[int] = Field(None, ge=2020, le=2100)
