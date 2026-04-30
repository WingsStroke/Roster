/**
 * Schemas de validación Zod para formularios de NóminaCol
 * Validación en frontend antes de enviar al backend
 */

import { z } from 'zod';

// ============================================================================
// HELPERS
// ============================================================================

const NIT_REGEX = /^(\d{9,12}|\d{1,3}(\.\d{3}){2}-\d{1})$/;
const CEDULA_REGEX = /^(\d{6,12}|\d{1,3}(\.?\d{3}){2,3})$/;
const TELEFONO_REGEX = /^[\d\s\-\(\)]+$/;
const PERIODO_REGEX = /^\d{4}-\d{2}$/;

// ============================================================================
// EMPRESA
// ============================================================================

export const empresaSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  
  nit: z
    .string()
    .min(5, 'NIT requerido')
    .max(20, 'NIT demasiado largo')
    .refine(
      (val) => {
        const limpio = val.replace(/[.\-]/g, '');
        return /^\d{9,12}$/.test(limpio);
      },
      { message: 'NIT debe tener entre 9 y 12 dígitos numéricos' }
    ),
  
  direccion: z
    .string()
    .max(200, 'Dirección no puede exceder 200 caracteres')
    .optional()
    .or(z.literal('')),
  
  telefono: z
    .string()
    .max(20, 'Teléfono demasiado largo')
    .refine(
      (val) => !val || TELEFONO_REGEX.test(val),
      { message: 'Teléfono solo puede contener números, espacios, guiones y paréntesis' }
    )
    .refine(
      (val) => !val || val.replace(/\D/g, '').length >= 7,
      { message: 'Teléfono debe tener al menos 7 dígitos' }
    )
    .optional()
    .or(z.literal('')),
  
  representante: z
    .string()
    .max(100, 'Nombre no puede exceder 100 caracteres')
    .optional()
    .or(z.literal('')),
});

// Schema para actualización (todos los campos opcionales)
export const empresaUpdateSchema = empresaSchema.partial();

// ============================================================================
// EMPLEADO
// ============================================================================

const hoy = new Date().toISOString().split('T')[0];

export const empleadoSchema = z.object({
  empresa_id: z.string().min(1, 'Empresa requerida'),
  
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  
  cedula: z
    .string()
    .min(6, 'Documento requerido')
    .max(15, 'Documento demasiado largo')
    .refine(
      (val) => {
        const limpio = val.replace(/[.\-,\s]/g, '');
        return /^\d{6,12}$/.test(limpio);
      },
      { message: 'Documento debe contener entre 6 y 12 dígitos numéricos' }
    ),
  
  cargo: z
    .string()
    .min(2, 'El cargo debe tener al menos 2 caracteres')
    .max(100, 'El cargo no puede exceder 100 caracteres'),
  
  fecha_ingreso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe tener formato YYYY-MM-DD')
    .refine(
      (val) => val <= hoy,
      { message: 'La fecha de ingreso no puede ser futura' }
    ),
  
  tipo_contrato: z.enum(['indefinido', 'fijo', 'obra'], {
    errorMap: () => ({ message: 'Tipo de contrato inválido' }),
  }),
  
  salario: z
    .number({ invalid_type_error: 'Salario debe ser un número' })
    .positive('El salario debe ser mayor a 0')
    .min(1_000_000, 'El salario mínimo debe ser al menos $1,000,000')
    .max(100_000_000, 'El salario no puede exceder $100,000,000'),
  
  riesgo_arl: z.enum(['I', 'II', 'III', 'IV', 'V'], {
    errorMap: () => ({ message: 'Nivel de riesgo ARL inválido' }),
  }),
  
  auxilio_transporte: z.boolean().default(true),
  
  eps: z
    .string()
    .max(50)
    .optional()
    .or(z.literal('')),
  
  afp: z
    .string()
    .max(50)
    .optional()
    .or(z.literal('')),
  
  caja: z
    .string()
    .max(50)
    .optional()
    .or(z.literal('')),
  
  cuenta_bancaria: z
    .string()
    .max(30)
    .refine(
      (val) => !val || val.replace(/[\s\-]/g, '').length >= 10,
      { message: 'Cuenta bancaria debe tener al menos 10 dígitos' }
    )
    .optional()
    .or(z.literal('')),
  
  estado: z
    .enum(['activo', 'retirado', 'vacaciones', 'incapacidad'])
    .default('activo'),
});

export const empleadoUpdateSchema = empleadoSchema.partial();

// ============================================================================
// LIQUIDACIÓN
// ============================================================================

export const novedadesSchema = z.object({
  horas_extra_diurna: z.number().min(0).optional(),
  horas_extra_nocturna: z.number().min(0).optional(),
  horas_extra_dom_diurna: z.number().min(0).optional(),
  horas_extra_dom_nocturna: z.number().min(0).optional(),
  horas_recargo_nocturno: z.number().min(0).optional(),
  horas_recargo_dominical: z.number().min(0).optional(),
  bonificaciones: z.number().min(0).optional(),
  comisiones: z.number().min(0).optional(),
  dias_incapacidad: z.number().int().min(0).max(30).optional(),
  dias_licencia: z.number().int().min(0).max(30).optional(),
  descuentos_adicionales: z.number().min(0).optional(),
  descripcion_descuentos: z.string().max(200).optional(),
});

export const liquidacionSchema = z.object({
  empresa_id: z.string().min(1, 'Empresa requerida'),
  empleado_id: z.string().min(1, 'Empleado requerido'),
  
  periodo: z
    .string()
    .regex(PERIODO_REGEX, 'Período debe tener formato YYYY-MM (ej: 2024-03)'),
  
  dias_trabajados: z
    .number({ invalid_type_error: 'Días debe ser un número' })
    .int('Días debe ser un número entero')
    .min(1, 'Mínimo 1 día trabajado')
    .max(30, 'Máximo 30 días por mes'),
  
  novedades: novedadesSchema.optional(),
  
  estado: z
    .enum(['pendiente', 'pagado', 'anulado'])
    .default('pendiente'),
});

export const liquidacionUpdateSchema = liquidacionSchema.partial();

// ============================================================================
// LIQUIDACIÓN FINAL (RETIRO)
// ============================================================================

export const liquidacionFinalSchema = z.object({
  empresa_id: z.string().min(1, 'Empresa requerida'),
  empleado_id: z.string().min(1, 'Empleado requerido'),
  
  fecha_retiro: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe tener formato YYYY-MM-DD'),
  
  causa: z.enum(
    ['renuncia', 'despido_justa_causa', 'despido_sin_justa_causa', 'mutuo_acuerdo', 'vencimiento_contrato'],
    { errorMap: () => ({ message: 'Causa de retiro inválida' }) }
  ),
  
  fecha_vencimiento_contrato: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe tener formato YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  
  dias_vacaciones_disfrutados: z
    .number()
    .int()
    .min(0, 'Días no pueden ser negativos')
    .default(0),
});

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

export const configuracionSchema = z.object({
  smmlv: z
    .number()
    .positive('SMMLV debe ser positivo')
    .min(1_000_000, 'SMMLV debe ser al menos $1,000,000'),
  
  auxilio_transporte: z
    .number()
    .min(0, 'Auxilio no puede ser negativo'),
  
  jornada_horas: z
    .number()
    .int()
    .min(1, 'Jornada mínima 1 hora')
    .max(48, 'Jornada máxima 48 horas'),
  
  ano: z
    .number()
    .int()
    .min(2020, 'Año mínimo 2020')
    .max(2100, 'Año máximo 2100'),
});

export const configuracionUpdateSchema = configuracionSchema.partial();
