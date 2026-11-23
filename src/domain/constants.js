// Modelo de dominio de Feria Salvaje. Nada de este archivo depende de React.

export const SCHEMA_VERSION = 2
export const STORAGE_KEY = 'feriaSalvaje.portal.estado'
export const PERFIL_KEY = 'feriaSalvaje.portal.perfil'
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires'

export const E = {
  BORRADOR: 'borrador',
  ENVIADA: 'enviada',
  EN_REVISION: 'en_revision',
  REQUIERE_CAMBIOS: 'requiere_cambios',
  APROBADA: 'aprobada',
  LISTA_ESPERA: 'lista_espera',
  RECHAZADA: 'rechazada',
  BAJA: 'baja',
}

// Orden y presentación de cada estado. El color es el mismo en todas las pantallas.
export const ESTADOS = [
  { id: E.BORRADOR, label: 'Borrador', color: '#8A8178', tinta: '#2B2520' },
  { id: E.ENVIADA, label: 'Enviada', color: '#C98B2B', tinta: '#2B2520' },
  { id: E.EN_REVISION, label: 'En revisión', color: '#5B4A7A', tinta: '#FFFFFF' },
  { id: E.REQUIERE_CAMBIOS, label: 'Requiere cambios', color: '#C4572A', tinta: '#FFFFFF' },
  { id: E.APROBADA, label: 'Aprobada', color: '#3F5A3A', tinta: '#FFFFFF' },
  { id: E.LISTA_ESPERA, label: 'Lista de espera', color: '#2F6670', tinta: '#FFFFFF' },
  { id: E.RECHAZADA, label: 'Rechazada', color: '#6B1E2E', tinta: '#FFFFFF' },
  { id: E.BAJA, label: 'Dada de baja', color: '#2B2520', tinta: '#F4EDE1' },
]
export const ESTADO_POR_ID = Object.fromEntries(ESTADOS.map((e) => [e.id, e]))

// Tabla de transiciones válidas: comando → estados de origen → estado destino.
// El motor rechaza cualquier transición que no figure acá.
export const TRANSICIONES = [
  { comando: 'POST_ENVIAR', desde: [E.BORRADOR, E.REQUIERE_CAMBIOS], hacia: E.ENVIADA, rol: 'productor' },
  { comando: 'POST_TOMAR', desde: [E.ENVIADA], hacia: E.EN_REVISION, rol: 'organizacion' },
  { comando: 'POST_PEDIR_CAMBIOS', desde: [E.EN_REVISION], hacia: E.REQUIERE_CAMBIOS, rol: 'organizacion' },
  { comando: 'POST_RECHAZAR', desde: [E.EN_REVISION], hacia: E.RECHAZADA, rol: 'organizacion' },
  { comando: 'POST_APROBAR', desde: [E.EN_REVISION], hacia: `${E.APROBADA} | ${E.LISTA_ESPERA}`, rol: 'organizacion' },
  { comando: 'POST_BAJA', desde: [E.APROBADA, E.LISTA_ESPERA], hacia: E.BAJA, rol: 'productor · organizacion' },
  { comando: 'MESA_OFRECER / promoción', desde: [E.LISTA_ESPERA], hacia: E.APROBADA, rol: 'organizacion · sistema' },
]
export const ESTADOS_FINALES = [E.RECHAZADA, E.BAJA]
export const ESTADOS_EDITABLES_PRODUCTOR = [E.BORRADOR, E.REQUIERE_CAMBIOS]
// Estados con una decisión tomada contra una versión de requisitos.
export const ESTADOS_AFECTADOS_POR_REQUISITO = [E.EN_REVISION, E.APROBADA, E.LISTA_ESPERA]

export const ROLES = {
  productor: { id: 'productor', label: 'Productor', descripcion: 'Una bodega que se postula y sigue su postulación.' },
  organizacion: { id: 'organizacion', label: 'Organización', descripcion: 'Revisa postulaciones, asigna mesas y propone correcciones.' },
  revisor: { id: 'revisor', label: 'Revisor', descripcion: 'Decide correcciones y cierres. No aprueba lo que propuso.' },
  auditor: { id: 'auditor', label: 'Auditor', descripcion: 'Consulta conciliación e historial. No cambia datos.' },
}

// Actores sintéticos de la demo. No son cuentas reales.
export const ACTORES = {
  organizacion: [
    { id: 'act-org-lucia', nombre: 'Lucía Paredes', rol: 'organizacion' },
    { id: 'act-org-mateo', nombre: 'Mateo Ibarra', rol: 'organizacion' },
  ],
  revisor: [
    { id: 'act-rev-tomas', nombre: 'Tomás Quiroga', rol: 'revisor' },
    { id: 'act-rev-ines', nombre: 'Inés Barrionuevo', rol: 'revisor' },
  ],
  auditor: [{ id: 'act-aud-sofia', nombre: 'Sofía Ledesma', rol: 'auditor' }],
}
export const ACTOR_SISTEMA = { id: 'sistema', nombre: 'Sistema', rol: 'sistema' }

export const actorProductor = (bodega) => ({
  id: `act-prod-${bodega.id}`,
  nombre: bodega.nombre,
  rol: 'productor',
  bodegaId: bodega.id,
})

export const PROVINCIAS = ['Mendoza', 'San Juan', 'Salta', 'Río Negro', 'Uruguay']

// Campos que una propuesta de corrección puede tocar.
export const CAMPOS_CORREGIBLES = {
  'ficha.botellasAnio': 'Botellas por año',
  'ficha.hectareas': 'Hectáreas',
  'ficha.localidad': 'Localidad',
  'ficha.vinedo': 'Viñedo identificado',
  'etiqueta.nombre': 'Nombre de etiqueta',
  'etiqueta.cepa': 'Cepa',
  'etiqueta.cosecha': 'Cosecha',
  'etiqueta.sulfitos': 'Sulfitos (mg/l)',
}
