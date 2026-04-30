from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
import uuid
from datetime import datetime, timezone, date, timedelta

from models import (
    EmpresaCreate, EmpresaUpdate,
    EmpleadoCreate, EmpleadoUpdate,
    EmpleadoConHorarioCreate, EmpleadoConHorarioUpdate,
    LiquidacionCreate, LiquidacionUpdate,
    LiquidacionFinalCreate,
    ConfiguracionUpdate,
    AsistenciaDiariaCreate, AsistenciaDiariaUpdate,
    BatchAsistenciaCreate,
    LiquidacionAvanzadaCreate
)

from nominaAsistenciaEngine import (
    calcular_liquidacion_asistencia,
    obtener_festivos_2026,
    generar_precarga_asistencia,
    es_festivo
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# --- Health check ---
@api_router.get("/")
async def root():
    return {"message": "NóminaCol API v1.0"}


# --- Empresas ---
@api_router.post("/empresas")
async def crear_empresa(data: EmpresaCreate):
    doc = {**data.model_dump(), "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.empresas.insert_one(doc)
    return await db.empresas.find_one({"id": doc["id"]}, {"_id": 0})


@api_router.get("/empresas")
async def listar_empresas():
    return await db.empresas.find({}, {"_id": 0}).to_list(100)


@api_router.put("/empresas/{empresa_id}")
async def actualizar_empresa(empresa_id: str, data: EmpresaUpdate):
    update_dict = data.model_dump(exclude_unset=True, exclude={"id", "_id"})
    if not update_dict:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    await db.empresas.update_one({"id": empresa_id}, {"$set": update_dict})
    result = await db.empresas.find_one({"id": empresa_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return result


@api_router.delete("/empresas/{empresa_id}")
async def eliminar_empresa(empresa_id: str):
    await db.empresas.delete_one({"id": empresa_id})
    await db.empleados.delete_many({"empresa_id": empresa_id})
    await db.liquidaciones.delete_many({"empresa_id": empresa_id})
    await db.liquidaciones_final.delete_many({"empresa_id": empresa_id})
    return {"ok": True}


# --- Empleados ---
@api_router.post("/empleados")
async def crear_empleado(data: EmpleadoCreate):
    doc = {**data.model_dump(), "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.empleados.insert_one(doc)
    return await db.empleados.find_one({"id": doc["id"]}, {"_id": 0})


@api_router.get("/empleados")
async def listar_empleados(empresa_id: str):
    return await db.empleados.find({"empresa_id": empresa_id}, {"_id": 0}).to_list(1000)


@api_router.get("/empleados/{empleado_id}")
async def obtener_empleado(empleado_id: str):
    emp = await db.empleados.find_one({"id": empleado_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return emp


@api_router.put("/empleados/{empleado_id}")
async def actualizar_empleado(empleado_id: str, data: EmpleadoUpdate):
    update_dict = data.model_dump(exclude_unset=True, exclude={"id", "_id"})
    if not update_dict:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    await db.empleados.update_one({"id": empleado_id}, {"$set": update_dict})
    result = await db.empleados.find_one({"id": empleado_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return result


@api_router.delete("/empleados/{empleado_id}")
async def eliminar_empleado(empleado_id: str):
    await db.empleados.delete_one({"id": empleado_id})
    await db.liquidaciones.delete_many({"empleado_id": empleado_id})
    await db.liquidaciones_final.delete_many({"empleado_id": empleado_id})
    return {"ok": True}


# --- Liquidaciones ---
@api_router.post("/liquidaciones")
async def crear_liquidacion(data: LiquidacionCreate):
    doc = {**data.model_dump(), "id": str(uuid.uuid4()), "fecha_creacion": datetime.now(timezone.utc).isoformat()}
    await db.liquidaciones.insert_one(doc)
    return await db.liquidaciones.find_one({"id": doc["id"]}, {"_id": 0})


@api_router.get("/liquidaciones")
async def listar_liquidaciones(empresa_id: str):
    return await db.liquidaciones.find(
        {"empresa_id": empresa_id}, {"_id": 0}
    ).sort("fecha_creacion", -1).to_list(1000)


@api_router.get("/liquidaciones/{liquidacion_id}")
async def obtener_liquidacion(liquidacion_id: str):
    liq = await db.liquidaciones.find_one({"id": liquidacion_id}, {"_id": 0})
    if not liq:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    return liq


@api_router.put("/liquidaciones/{liquidacion_id}")
async def actualizar_liquidacion(liquidacion_id: str, data: LiquidacionUpdate):
    update_dict = data.model_dump(exclude_unset=True, exclude={"id", "_id"})
    if not update_dict:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    await db.liquidaciones.update_one({"id": liquidacion_id}, {"$set": update_dict})
    result = await db.liquidaciones.find_one({"id": liquidacion_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    return result


@api_router.delete("/liquidaciones/{liquidacion_id}")
async def eliminar_liquidacion(liquidacion_id: str):
    await db.liquidaciones.delete_one({"id": liquidacion_id})
    return {"ok": True}


# --- Liquidaciones Final (retiro) ---
@api_router.post("/liquidaciones-final")
async def crear_liquidacion_final(data: LiquidacionFinalCreate):
    doc = {**data.model_dump(), "id": str(uuid.uuid4()), "fecha_creacion": datetime.now(timezone.utc).isoformat()}
    await db.liquidaciones_final.insert_one(doc)
    # Cambiar estado del empleado a 'retirado'
    await db.empleados.update_one({"id": data.empleado_id}, {"$set": {"estado": "retirado"}})
    return await db.liquidaciones_final.find_one({"id": doc["id"]}, {"_id": 0})


@api_router.get("/liquidaciones-final")
async def listar_liquidaciones_final(empresa_id: str):
    return await db.liquidaciones_final.find(
        {"empresa_id": empresa_id}, {"_id": 0}
    ).sort("fecha_creacion", -1).to_list(1000)


@api_router.get("/liquidaciones-final/{liquidacion_id}")
async def obtener_liquidacion_final(liquidacion_id: str):
    liq = await db.liquidaciones_final.find_one({"id": liquidacion_id}, {"_id": 0})
    if not liq:
        raise HTTPException(status_code=404, detail="Liquidación final no encontrada")
    return liq


@api_router.delete("/liquidaciones-final/{liquidacion_id}")
async def eliminar_liquidacion_final(liquidacion_id: str):
    await db.liquidaciones_final.delete_one({"id": liquidacion_id})
    return {"ok": True}


# --- Configuración ---
@api_router.get("/configuracion")
async def obtener_configuracion():
    config = await db.configuracion.find_one({}, {"_id": 0})
    if not config:
        default = {"smmlv": 1750905, "auxilio_transporte": 249095, "jornada_horas": 44, "ano": 2026}
        await db.configuracion.insert_one(default)
        config = await db.configuracion.find_one({}, {"_id": 0})
    return config


@api_router.put("/configuracion")
async def actualizar_configuracion(data: ConfiguracionUpdate):
    update_dict = data.model_dump(exclude_unset=True, exclude={"_id"})
    if not update_dict:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    existing = await db.configuracion.find_one({})
    if existing:
        await db.configuracion.update_one({"_id": existing["_id"]}, {"$set": update_dict})
    else:
        await db.configuracion.insert_one(update_dict)
    return await db.configuracion.find_one({}, {"_id": 0})


# --- Dashboard ---
@api_router.get("/dashboard")
async def obtener_dashboard(empresa_id: str):
    empleados = await db.empleados.find(
        {"empresa_id": empresa_id, "estado": "activo"}, {"_id": 0}
    ).to_list(1000)
    liquidaciones = await db.liquidaciones.find(
        {"empresa_id": empresa_id}, {"_id": 0}
    ).sort("fecha_creacion", -1).to_list(20)

    now = datetime.now(timezone.utc)
    periodo_actual = f"{now.year}-{now.month:02d}"
    liqs_mes = [l for l in liquidaciones if l.get("periodo") == periodo_actual]
    total_nomina = sum(l.get("neto", 0) for l in liqs_mes)
    pendientes = [l for l in liquidaciones if l.get("estado") == "pendiente"]

    return {
        "total_empleados_activos": len(empleados),
        "total_nomina_mes": total_nomina,
        "periodo_actual": periodo_actual,
        "liquidaciones_pendientes": len(pendientes),
        "ultimas_liquidaciones": liquidaciones[:5],
    }


# --- Seed demo data ---
@api_router.post("/seed")
async def seed_data():
    count = await db.empresas.count_documents({})
    if count > 0:
        return {"message": "Ya existen datos", "seeded": False}

    empresa_id = str(uuid.uuid4())
    empresa = {
        "id": empresa_id,
        "nombre": "Café Colombiano S.A.S",
        "nit": "900.123.456-7",
        "direccion": "Calle 72 #10-34, Bogotá D.C.",
        "telefono": "601-3456789",
        "representante": "María Fernanda López",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.empresas.insert_one(empresa)

    empleados_data = [
        {
            "nombre": "Carlos Andrés Martínez", "cedula": "1.024.567.890",
            "cargo": "Administrador de Tienda", "fecha_ingreso": "2023-03-15",
            "tipo_contrato": "indefinido", "salario": 2800000, "riesgo_arl": "I",
            "auxilio_transporte": True, "eps": "Sura EPS", "afp": "Protección",
            "caja": "Compensar", "cuenta_bancaria": "4567-8901-2345", "estado": "activo",
        },
        {
            "nombre": "Laura Valentina Rodríguez", "cedula": "1.098.765.432",
            "cargo": "Barista Senior", "fecha_ingreso": "2024-01-10",
            "tipo_contrato": "indefinido", "salario": 1750905, "riesgo_arl": "I",
            "auxilio_transporte": True, "eps": "Nueva EPS", "afp": "Porvenir",
            "caja": "Cafam", "cuenta_bancaria": "7890-1234-5678", "estado": "activo",
        },
        {
            "nombre": "Juan Sebastián Gómez", "cedula": "79.456.123",
            "cargo": "Contador", "fecha_ingreso": "2022-06-01",
            "tipo_contrato": "fijo", "salario": 4200000, "riesgo_arl": "I",
            "auxilio_transporte": False, "eps": "Sanitas", "afp": "Colfondos",
            "caja": "Colsubsidio", "cuenta_bancaria": "1234-5678-9012", "estado": "activo",
        },
        {
            "nombre": "Ana María Herrera", "cedula": "52.789.456",
            "cargo": "Mesera", "fecha_ingreso": "2025-02-20",
            "tipo_contrato": "indefinido", "salario": 1750905, "riesgo_arl": "II",
            "auxilio_transporte": True, "eps": "Famisanar", "afp": "Protección",
            "caja": "Compensar", "cuenta_bancaria": "", "estado": "activo",
        },
        {
            "nombre": "Diego Alejandro Ruiz", "cedula": "80.234.567",
            "cargo": "Repartidor", "fecha_ingreso": "2024-08-05",
            "tipo_contrato": "obra", "salario": 1750905, "riesgo_arl": "IV",
            "auxilio_transporte": True, "eps": "Sura EPS", "afp": "Porvenir",
            "caja": "Cafam", "cuenta_bancaria": "3456-7890-1234", "estado": "activo",
        },
    ]

    for emp in empleados_data:
        doc = {**emp, "id": str(uuid.uuid4()), "empresa_id": empresa_id, "created_at": datetime.now(timezone.utc).isoformat()}
        await db.empleados.insert_one(doc)

    config = {"smmlv": 1750905, "auxilio_transporte": 249095, "jornada_horas": 44, "ano": 2026}
    await db.configuracion.insert_one(config)

    return {"message": "Datos de prueba creados exitosamente", "seeded": True, "empresa_id": empresa_id}


# ============================================================================
# ASISTENCIA DIARIA (LIQUIDACIÓN AVANZADA)
# ============================================================================

@api_router.post("/asistencias")
async def crear_asistencia(data: AsistenciaDiariaCreate):
    """Crear registro diario de asistencia."""
    # Verificar que el empleado existe
    empleado = await db.empleados.find_one({"id": data.empleado_id}, {"_id": 0})
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    
    # Verificar que no exista ya un registro para esta fecha
    existente = await db.asistencias.find_one({
        "empleado_id": data.empleado_id,
        "fecha": data.fecha
    })
    if existente:
        raise HTTPException(status_code=400, detail=f"Ya existe registro de asistencia para la fecha {data.fecha}")
    
    doc = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.asistencias.insert_one(doc)
    return await db.asistencias.find_one({"id": doc["id"]}, {"_id": 0})


@api_router.post("/asistencias/batch")
async def crear_asistencias_batch(data: BatchAsistenciaCreate):
    """Crear múltiples registros de asistencia (precarga de período)."""
    # Verificar que el empleado existe
    empleado = await db.empleados.find_one({"id": data.empleado_id}, {"_id": 0})
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    
    # Verificar que no existan registros en el rango
    fecha_inicio = date.fromisoformat(data.fecha_inicio)
    fecha_fin = date.fromisoformat(data.fecha_fin)
    
    existentes = await db.asistencias.count_documents({
        "empleado_id": data.empleado_id,
        "fecha": {"$gte": data.fecha_inicio, "$lte": data.fecha_fin}
    })
    
    if existentes > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Ya existen {existentes} registros de asistencia en el rango de fechas especificado"
        )
    
    # Generar registros precargados
    horario_dict = data.horario_default.model_dump()
    registros = generar_precarga_asistencia(
        fecha_inicio, fecha_fin, horario_dict, data.empleado_id, data.empresa_id
    )
    
    # Agregar IDs y timestamps
    docs = []
    for reg in registros:
        docs.append({
            **reg,
            "id": str(uuid.uuid4()),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    
    if docs:
        await db.asistencias.insert_many(docs)
    
    return {
        "message": f"{len(docs)} registros de asistencia creados",
        "empleado_id": data.empleado_id,
        "fecha_inicio": data.fecha_inicio,
        "fecha_fin": data.fecha_fin,
        "registros_creados": len(docs)
    }


@api_router.get("/asistencias")
async def listar_asistencias(empleado_id: str, fecha_inicio: str = None, fecha_fin: str = None):
    """Listar registros de asistencia de un empleado en un rango de fechas."""
    query = {"empleado_id": empleado_id}
    
    if fecha_inicio and fecha_fin:
        query["fecha"] = {"$gte": fecha_inicio, "$lte": fecha_fin}
    elif fecha_inicio:
        query["fecha"] = {"$gte": fecha_inicio}
    elif fecha_fin:
        query["fecha"] = {"$lte": fecha_fin}
    
    asistencias = await db.asistencias.find(
        query, {"_id": 0}
    ).sort("fecha", 1).to_list(1000)
    
    return asistencias


@api_router.get("/asistencias/{asistencia_id}")
async def obtener_asistencia(asistencia_id: str):
    """Obtener un registro de asistencia específico."""
    asistencia = await db.asistencias.find_one({"id": asistencia_id}, {"_id": 0})
    if not asistencia:
        raise HTTPException(status_code=404, detail="Registro de asistencia no encontrado")
    return asistencia


@api_router.put("/asistencias/{asistencia_id}")
async def actualizar_asistencia(asistencia_id: str, data: AsistenciaDiariaUpdate):
    """Actualizar un registro de asistencia."""
    update_dict = data.model_dump(exclude_unset=True, exclude={"id", "_id"})
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.asistencias.update_one({"id": asistencia_id}, {"$set": update_dict})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Registro de asistencia no encontrado")
    
    return await db.asistencias.find_one({"id": asistencia_id}, {"_id": 0})


@api_router.delete("/asistencias/{asistencia_id}")
async def eliminar_asistencia(asistencia_id: str):
    """Eliminar un registro de asistencia."""
    result = await db.asistencias.delete_one({"id": asistencia_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro de asistencia no encontrado")
    
    return {"ok": True, "message": "Registro de asistencia eliminado"}


# ============================================================================
# LIQUIDACIÓN AVANZADA POR ASISTENCIA
# ============================================================================

@api_router.post("/liquidaciones-avanzadas")
async def crear_liquidacion_avanzada(data: LiquidacionAvanzadaCreate):
    """
    Crear liquidación basada en asistencia diaria.
    Calcula automáticamente horas ordinarias, nocturnas, extras y recargos.
    """
    # Verificar que el empleado existe
    empleado = await db.empleados.find_one({"id": data.empleado_id}, {"_id": 0})
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    
    # Obtener configuración
    config = await db.configuracion.find_one({}, {"_id": 0})
    if not config:
        config = {"smmlv": 1750905, "auxilio_transporte": 249095, "jornada_horas": 44, "ano": 2026}
    
    # Obtener registros de asistencia del período
    fecha_inicio = date.fromisoformat(data.fecha_inicio)
    fecha_fin = date.fromisoformat(data.fecha_fin)
    
    asistencias_raw = await db.asistencias.find({
        "empleado_id": data.empleado_id,
        "fecha": {"$gte": data.fecha_inicio, "$lte": data.fecha_fin}
    }, {"_id": 0}).sort("fecha", 1).to_list(1000)
    
    if not asistencias_raw:
        raise HTTPException(
            status_code=400, 
            detail=f"No hay registros de asistencia para el empleado en el período {data.fecha_inicio} a {data.fecha_fin}"
        )
    
    # Obtener horario del empleado
    horario = empleado.get("horario", {
        "hora_entrada_default": "08:00",
        "hora_salida_default": "17:00",
        "minutos_almuerzo_default": 60,
        "dias_laborales": [1, 2, 3, 4, 5],
        "jornada_diaria_horas": 8
    })
    
    # Calcular liquidación
    jornada_diaria = horario.get("jornada_diaria_horas", 8)
    
    resultado = calcular_liquidacion_asistencia(
        empleado_id=data.empleado_id,
        empresa_id=data.empresa_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        asistencias=asistencias_raw,
        salario_mensual=empleado.get("salario", 0),
        auxilio_transporte_mensual=config.get("auxilio_transporte", 249095),
        jornada_diaria_horas=jornada_diaria,
        config=config
    )
    
    # Guardar resultado en base de datos
    liquidacion_doc = {
        "id": str(uuid.uuid4()),
        "empleado_id": data.empleado_id,
        "empresa_id": data.empresa_id,
        "fecha_inicio": data.fecha_inicio,
        "fecha_fin": data.fecha_fin,
        "tipo_periodo": data.tipo_periodo,
        "resultado": resultado.__dict__,
        "estado": "calculada",
        "fecha_calculo": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.liquidaciones_avanzadas.insert_one(liquidacion_doc)
    
    return {
        "liquidacion_id": liquidacion_doc["id"],
        "resultado": resultado.__dict__,
        "estado": "calculada"
    }


@api_router.get("/liquidaciones-avanzadas")
async def listar_liquidaciones_avanzadas(empresa_id: str, empleado_id: str = None):
    """Listar liquidaciones avanzadas de una empresa o empleado específico."""
    query = {"empresa_id": empresa_id}
    if empleado_id:
        query["empleado_id"] = empleado_id
    
    liquidaciones = await db.liquidaciones_avanzadas.find(
        query, {"_id": 0}
    ).sort("fecha_calculo", -1).to_list(100)
    
    return liquidaciones


# ============================================================================
# FESTIVOS
# ============================================================================

@api_router.get("/festivos")
async def obtener_festivos(ano: int = 2026):
    """Obtener lista de festivos colombianos."""
    if ano != 2026:
        raise HTTPException(status_code=400, detail="Solo disponible para año 2026")
    
    return {
        "ano": ano,
        "festivos": obtener_festivos_2026(),
        "total": len(obtener_festivos_2026())
    }


@api_router.get("/festivos/verificar")
async def verificar_festivo(fecha: str):
    """Verificar si una fecha específica es festivo."""
    try:
        fecha_obj = date.fromisoformat(fecha)
        es_fest = es_festivo(fecha_obj)
        return {
            "fecha": fecha,
            "es_festivo": es_fest,
            "es_domingo": fecha_obj.weekday() == 6,
            "dia_semana": fecha_obj.strftime("%A")
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha debe tener formato YYYY-MM-DD")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
