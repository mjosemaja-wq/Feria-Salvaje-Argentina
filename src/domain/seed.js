// Semilla de datos sintéticos. Todo es de ejemplo: bodegas, personas, correos y
// teléfonos son inventados. La semilla se arma una sola vez (cuando no existe la
// clave de la app) y los 5 comandos de antecedente no se vuelven a ejecutar al cargar.
import { E, ACTORES, actorProductor, ZONA_HORARIA } from './constants.js'
import { ejecutar, nuevaPostulacion, totalesDeRegistros } from './engine.js'
import { clone } from './util.js'

export const CONV_ACTUAL = 'conv-2027'
export const CONV_ANTERIOR = 'conv-2026'
export const BODEGA_DEMO = 'bod-tranquera'

const LUCIA = ACTORES.organizacion[0]
const MATEO = ACTORES.organizacion[1]
const TOMAS = ACTORES.revisor[0]
const INES = ACTORES.revisor[1]

function requisitos(convId) {
  return [
    { id: `${convId}-r-uva`, clave: 'uva', tipo: 'manual', texto: 'Uva propia o de viñedo identificado en la ficha', version: 1 },
    { id: `${convId}-r-levaduras`, clave: 'levaduras', tipo: 'manual', texto: 'Fermentación con levaduras nativas', version: 1 },
    { id: `${convId}-r-correcciones`, clave: 'correcciones', tipo: 'manual', texto: 'Sin correcciones de acidez ni de azúcar', version: 1 },
    { id: `${convId}-r-sulfitos`, clave: 'sulfitos', tipo: 'auto', texto: 'Sulfitos totales de hasta 50 mg/l por etiqueta', param: { max: 50 }, version: 1 },
    { id: `${convId}-r-botellas`, clave: 'botellas', tipo: 'auto', texto: 'Producción total de hasta 30.000 botellas por año', param: { max: 30000 }, version: 1 },
    { id: `${convId}-r-etiquetas`, clave: 'etiquetas', tipo: 'auto', texto: 'Entre 1 y 6 etiquetas presentadas', param: { min: 1, max: 6 }, version: 1 },
  ]
}

const NOMBRES = [
  ['La Tranquera Nativa', 'Mendoza', 'Lavalle'],
  ['Viñas del Zonda Viejo', 'San Juan', 'Zonda'],
  ['Finca Agua de Pozo', 'Mendoza', 'Tupungato'],
  ['Chacra Tres Lomas', 'Río Negro', 'Mainqué'],
  ['Bodega Piedra Mora', 'Salta', 'Cafayate'],
  ['Casa Jarillal', 'Mendoza', 'San Carlos'],
  ['Pago del Tero', 'Uruguay', 'Canelones'],
  ['Viña Cardón Alto', 'Salta', 'Cachi'],
  ['Huerta El Retamo', 'San Juan', 'Pedernal'],
  ['Cava La Acequia', 'Mendoza', 'Maipú'],
  ['Finca Los Chañares', 'Mendoza', 'Luján de Cuyo'],
  ['Bodega Barda Roja', 'Río Negro', 'General Roca'],
  ['Viñedos Ojo de Agua', 'Salta', 'Molinos'],
  ['Casa Calingasta Libre', 'San Juan', 'Calingasta'],
  ['Pago Arenoso', 'Uruguay', 'Maldonado'],
  ['Finca Monte Quemado', 'Mendoza', 'Lavalle'],
  ['Bodega Sauce Llorón', 'Río Negro', 'Allen'],
  ['Viña Pircas', 'Salta', 'Cafayate'],
  ['Chacra La Lechuza', 'Mendoza', 'Tupungato'],
  ['Huerta de los Molles', 'San Juan', 'Zonda'],
  ['Bodega Médano', 'Mendoza', 'San Carlos'],
  ['Casa Colonia Vieja', 'Uruguay', 'Colonia'],
  ['Finca El Algarrobo Mocho', 'Salta', 'Cachi'],
  ['Viñas Puelche', 'Río Negro', 'Mainqué'],
  ['Pago La Cañada', 'Mendoza', 'Maipú'],
  ['Bodega Cerro Blanco', 'San Juan', 'Pedernal'],
  ['Chacra Ruta Vieja', 'Río Negro', 'General Roca'],
  ['Finca Los Teros', 'Uruguay', 'Canelones'],
  ['Viña Quebrada Honda', 'Salta', 'Molinos'],
  ['Casa del Pedregal', 'Mendoza', 'Luján de Cuyo'],
  ['Bodega La Hornilla', 'San Juan', 'Calingasta'],
  ['Huerta Tres Acequias', 'Mendoza', 'Lavalle'],
  ['Viñedos Viento Zonda', 'San Juan', 'Zonda'],
  ['Finca Cañaveral', 'Uruguay', 'Maldonado'],
  ['Pago Los Membrillos', 'Mendoza', 'Tupungato'],
  ['Bodega Ñandú', 'Salta', 'Cafayate'],
  ['Chacra El Manzano', 'Río Negro', 'Allen'],
  ['Viña Las Totoras', 'Uruguay', 'Colonia'],
  ['Casa Tapial', 'Mendoza', 'San Carlos'],
  ['Finca Pozo Seco', 'San Juan', 'Pedernal'],
  ['Bodega Altas Cumbres', 'Salta', 'Cachi'],
  ['Viñas del Bajo', 'Río Negro', 'General Roca'],
  ['Pago Piedra Bola', 'Mendoza', 'Maipú'],
  ['Huerta La Jarilla', 'Mendoza', 'Luján de Cuyo'],
  ['Finca Garza Mora', 'Uruguay', 'Canelones'],
  ['Bodega Callejón Angosto', 'San Juan', 'Calingasta'],
  ['Viña Tolombón', 'Salta', 'Molinos'],
  ['Chacra Los Álamos', 'Río Negro', 'Mainqué'],
  ['Casa de Barro', 'Mendoza', 'Lavalle'],
  ['Finca Cuesta Chica', 'San Juan', 'Zonda'],
  ['Pago Sierra Baja', 'Uruguay', 'Maldonado'],
]
const CEPAS = ['Malbec', 'Criolla Grande', 'Torrontés', 'Bonarda', 'Cabernet Franc', 'Pinot Noir', 'Semillón', 'Moscatel de Alejandría', 'Tannat', 'Pedro Giménez', 'Garnacha', 'Sauvignon Blanc']
const NOMBRES_VINO = ['Polvo de Ruta', 'Siesta Larga', 'Vendimia Chica', 'Tierra Suelta', 'Ojo de Liebre', 'Pie de Cuba', 'Sol de Acequia', 'Rama Seca', 'Brote', 'Hollejo', 'Patio', 'Lagar', 'Sombra Fresca', 'Alpataco']
const CONTACTOS = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Facundo', 'Gabriela', 'Hernán', 'Julieta', 'Lautaro', 'Micaela', 'Nicolás', 'Paula', 'Ramiro']
const APELLIDOS = ['Ejemplo', 'Prueba', 'Muestra', 'Ficticio', 'Demo']

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function bodegaDe(i) {
  const [nombre, provincia, localidad] = NOMBRES[i]
  return { id: i === 0 ? BODEGA_DEMO : `bod-${slug(nombre)}`, nombre, provincia, localidad, creadaEn: '2026-11-01T12:00:00.000Z' }
}

function etiquetasDe(i, n) {
  return Array.from({ length: n }, (_, k) => ({
    id: `et-${i}-${k + 1}`,
    nombre: NOMBRES_VINO[(i * 3 + k) % NOMBRES_VINO.length],
    cepa: CEPAS[(i + k * 5) % CEPAS.length],
    cosecha: String(2022 + ((i + k) % 4)),
    sulfitos: 12 + ((i * 7 + k * 11) % 34),
  }))
}

function llenar(post, i, conv, { estado, mesa = null, orden = null, checklist = false, etiquetas, instante }) {
  const b = NOMBRES[i]
  const contacto = CONTACTOS[i % CONTACTOS.length]
  post.estado = estado
  post.rev = 3
  post.ficha = {
    nombre: b[0], provincia: b[1], localidad: b[2],
    hectareas: 1 + ((i * 3) % 9) + 0.5,
    uva: i % 5 === 4 ? 'comprada' : 'propia',
    vinedo: i % 5 === 4 ? `Viñedo de la familia ${APELLIDOS[i % APELLIDOS.length]}, ${b[2]}` : '',
    botellasAnio: 3000 + ((i * 1777) % 25000),
    contacto: { nombre: `${contacto} ${APELLIDOS[i % APELLIDOS.length]}`, email: `${slug(contacto)}@${slug(b[0])}.ejemplo`, telefono: `+54 9 261 000-${String(1000 + i).slice(-4)}` },
  }
  post.etiquetas = etiquetas ?? etiquetasDe(i, 1 + (i % 4))
  post.declaraciones = { uva: true, levaduras: true, correcciones: true, veracidad: true }
  if (checklist) {
    for (const r of conv.requisitos.filter((x) => x.tipo === 'manual')) {
      post.checklistManual[r.id] = { valor: true, version: r.version, actorId: LUCIA.id, instante }
    }
    post.reqVersionRevisada = conv.requisitosVersion
  }
  post.enviadaEn = estado === E.BORRADOR ? null : instante
  if (mesa != null) {
    post.mesa = mesa
    post.valorMesaCongelado = conv.valorMesa
    post.aprobadaEn = instante
  }
  post.ordenEspera = orden
  return post
}

function convocatoriaBase(id, extra) {
  return {
    id,
    rev: 1,
    requisitosVersion: 1,
    requisitos: requisitos(id),
    historialRequisitos: [],
    zonaHoraria: ZONA_HORARIA,
    cerrada: false,
    cierreId: null,
    ...extra,
  }
}

// Estado previo a los comandos de antecedente (revisión 0).
export function estadoPrevio() {
  const convA = convocatoriaBase(CONV_ACTUAL, {
    nombre: 'Edición 2027',
    lugar: 'Galpón de ejemplo en Palermo, CABA',
    jornadas: 'Sábado y domingo, de 14 a 21',
    apertura: '2026-11-01',
    cierre: '2027-01-31',
    cupo: 36,
    valorMesa: 180000,
  })
  const convB = convocatoriaBase(CONV_ANTERIOR, {
    nombre: 'Edición 2026',
    lugar: 'Galpón de ejemplo en Palermo, CABA',
    jornadas: 'Sábado y domingo, de 14 a 21',
    apertura: '2026-07-01',
    cierre: '2026-08-31',
    cupo: 40,
    valorMesa: 150000,
  })
  const bodegas = NOMBRES.map((_, i) => bodegaDe(i))
  const posts = []
  const t = '2026-11-05T15:00:00.000Z'
  const mk = (i, conv, opts, id) => {
    const p = nuevaPostulacion({ id: id ?? `pos-${conv.id.slice(5)}-${String(i + 1).padStart(2, '0')}`, conv, bod: bodegas[i], instante: '2026-11-03T13:00:00.000Z' })
    posts.push(llenar(p, i, conv, { instante: t, ...opts }))
    return p
  }

  // Edición 2027 (convocatoria abierta).
  // 0: la bodega de Mendoza del escenario. Le falta la cosecha del blanco.
  mk(0, convA, {
    estado: E.EN_REVISION,
    checklist: true,
    etiquetas: [
      { id: 'et-0-1', nombre: 'Pájaro Criollo', cepa: 'Criolla Grande', cosecha: '2025', sulfitos: 22 },
      { id: 'et-0-2', nombre: 'Cal y Canto', cepa: 'Torrontés', cosecha: '', sulfitos: 18 },
      { id: 'et-0-3', nombre: 'Tierra Suelta', cepa: 'Malbec', cosecha: '2024', sulfitos: 30 },
    ],
  }, 'pos-2027-tranquera')
  // 1: una etiqueta pasada de sulfitos.
  mk(1, convA, {
    estado: E.EN_REVISION,
    checklist: true,
    etiquetas: [
      { id: 'et-1-1', nombre: 'Zonda Rosado', cepa: 'Garnacha', cosecha: '2025', sulfitos: 62 },
      { id: 'et-1-2', nombre: 'Piedra Caliente', cepa: 'Bonarda', cosecha: '2024', sulfitos: 35 },
    ],
  })
  // 2: borrador.
  mk(3, convA, { estado: E.BORRADOR, etiquetas: [] })
  posts[posts.length - 1].declaraciones = { uva: false, levaduras: false, correcciones: false, veracidad: false }
  // 3: rechazada.
  const rech = mk(2, convA, { estado: E.RECHAZADA, checklist: true })
  rech.comentarios.push({ id: 'com-seed-1', autor: LUCIA.nombre, rol: 'organizacion', texto: 'Declaraste corrección de acidez en dos etiquetas: con eso no entra en esta edición. Te esperamos la próxima.', tipo: 'rechazo', instante: t })
  // 36 aprobadas con mesas 1..36.
  let i = 4
  for (let mesa = 1; mesa <= 36; mesa++, i++) mk(i, convA, { estado: E.APROBADA, mesa, checklist: true })
  // 3 en lista de espera.
  for (let orden = 1; orden <= 3; orden++, i++) mk(i, convA, { estado: E.LISTA_ESPERA, orden, checklist: true })
  // 2 en revisión que aprueban los comandos de antecedente + 3 listas para el caso de aceptación.
  const enRevision = []
  for (let k = 0; k < 5; k++, i++) enRevision.push(mk(i, convA, { estado: E.EN_REVISION, checklist: true }))
  // 3 enviadas (una la toma un comando de antecedente).
  const enviadas = []
  for (let k = 0; k < 3; k++, i++) enviadas.push(mk(i, convA, { estado: E.ENVIADA }))

  // Edición 2026 (cerrada): 5 aprobadas y 1 rechazada. Sus documentos no se tocan.
  const postsB = []
  for (let k = 0; k < 6; k++) {
    const idx = 4 + k * 3
    const p = mk(idx, convB, k < 5 ? { estado: E.APROBADA, mesa: k + 1, checklist: true } : { estado: E.RECHAZADA, checklist: true }, `pos-2026-${String(k + 1).padStart(2, '0')}`)
    p.creadaEn = '2026-07-10T13:00:00.000Z'
    p.enviadaEn = '2026-07-12T13:00:00.000Z'
    if (p.mesa) p.aprobadaEn = '2026-08-20T13:00:00.000Z'
    if (k === 5) p.comentarios.push({ id: 'com-seed-2', autor: MATEO.nombre, rol: 'organizacion', texto: 'La producción declarada supera el tope de 30.000 botellas.', tipo: 'rechazo', instante: '2026-08-20T13:00:00.000Z' })
    postsB.push(p)
  }

  const state = {
    schemaVersion: 2,
    revision: 0,
    entities: { convocatorias: [convA, convB], bodegas, postulaciones: posts, propuestas: [], ajustes: [], cierres: [], aperturas: [] },
    eventos: [],
    comandos: [],
  }
  return { state, enRevision, enviadas, postsB }
}

export function crearSemilla() {
  const { state: previo, enRevision, enviadas, postsB } = estadoPrevio()
  // Instantánea de apertura: punto de partida de la conciliación.
  previo.entities.aperturas = previo.entities.convocatorias.map((c) => ({
    id: `ap-${c.id}`, convocatoriaId: c.id, revision: 0, instante: '2026-11-05T15:00:00.000Z', totales: totalesDeRegistros(previo, c.id),
  }))
  let s = previo
  const correr = (cmd, instante) => {
    const r = ejecutar(s, cmd, { now: instante })
    if (!r.ok) throw new Error(`Semilla: el comando ${cmd.id} falló: ${r.error.message}`)
    s = r.state
  }
  const rev = (id) => s.entities.postulaciones.find((p) => p.id === id).rev
  const convRev = (id) => s.entities.convocatorias.find((c) => c.id === id).rev

  correr({ id: 'cmd-seed-1', tipo: 'CONV_ACTUALIZAR', actor: LUCIA, revisionEsperada: convRev(CONV_ACTUAL), datos: { convocatoriaId: CONV_ACTUAL, cambios: { cupo: 40 } } }, '2026-11-06T13:00:00.000Z')
  correr({ id: 'cmd-seed-2', tipo: 'POST_APROBAR', actor: LUCIA, revisionEsperada: rev(enRevision[0].id), datos: { postulacionId: enRevision[0].id } }, '2026-11-06T14:00:00.000Z')
  correr({ id: 'cmd-seed-3', tipo: 'POST_APROBAR', actor: MATEO, revisionEsperada: rev(enRevision[1].id), datos: { postulacionId: enRevision[1].id } }, '2026-11-06T14:30:00.000Z')
  correr({ id: 'cmd-seed-4', tipo: 'POST_PEDIR_CAMBIOS', actor: LUCIA, revisionEsperada: rev('pos-2027-tranquera'), datos: { postulacionId: 'pos-2027-tranquera', comentario: 'Te falta la cosecha del blanco «Cal y Canto». Cargala y reenviá, así lo cerramos.' } }, '2026-11-07T15:00:00.000Z')
  correr({ id: 'cmd-seed-5', tipo: 'POST_TOMAR', actor: MATEO, revisionEsperada: rev(enviadas[0].id), datos: { postulacionId: enviadas[0].id } }, '2026-11-08T13:00:00.000Z')

  // Sexto comando: rechazado, sin evento de dominio. Se intentó bajar el cupo por debajo de las mesas asignadas.
  const rechazado = { id: 'cmd-seed-6', tipo: 'CONV_ACTUALIZAR', actor: MATEO, revisionEsperada: convRev(CONV_ACTUAL), datos: { convocatoriaId: CONV_ACTUAL, cambios: { cupo: 30 } } }
  const r6 = ejecutar(s, rechazado, { now: '2026-11-08T14:00:00.000Z' })
  if (r6.ok) throw new Error('Semilla: el comando 6 tenía que rechazarse')
  s = clone(s)
  s.comandos.push({
    id: rechazado.id, tipo: rechazado.tipo, entidad: 'convocatoria', entidadId: CONV_ACTUAL,
    actor: { id: MATEO.id, nombre: MATEO.nombre, rol: MATEO.rol }, instante: '2026-11-08T14:00:00.000Z',
    revisionEsperada: rechazado.revisionEsperada, revision: null, datos: rechazado.datos, huella: null,
    resultado: 'rechazado', error: r6.error, eventos: [], respuesta: null,
  })

  // Registros de antecedente cargados tal cual (no pasan por el motor y no mueven recursos).
  const aprobadaA1 = s.entities.postulaciones.find((p) => p.convocatoriaId === CONV_ACTUAL && p.mesa === 5)
  const aprobadaA2 = s.entities.postulaciones.find((p) => p.convocatoriaId === CONV_ACTUAL && p.mesa === 12)
  const aprobadaB = postsB[1]
  const et2 = aprobadaA2.etiquetas[0]
  const etB = aprobadaB.etiquetas[0]
  s.entities.propuestas.push(
    {
      id: 'prop-seed-1', postulacionId: aprobadaA1.id, convocatoriaId: CONV_ACTUAL, revisionPartida: aprobadaA1.rev,
      cambios: { 'ficha.botellasAnio': aprobadaA1.ficha.botellasAnio + 2500 },
      valoresPartida: { 'ficha.botellasAnio': aprobadaA1.ficha.botellasAnio },
      recursosAfectados: [`Mesa ${aprobadaA1.mesa}`, 'Requisitos automáticos'],
      motivo: 'La bodega avisó por teléfono que sumó una partida de Criolla: la producción anual sube.',
      creador: { id: LUCIA.id, nombre: LUCIA.nombre, rol: 'organizacion' }, creadaEn: '2026-11-09T13:00:00.000Z',
      estado: 'pendiente', decisor: null, decision: null, motivoDecision: null, decididaEn: null, rev: 1,
    },
    {
      id: 'prop-seed-2', postulacionId: aprobadaA2.id, convocatoriaId: CONV_ACTUAL, revisionPartida: aprobadaA2.rev,
      cambios: { [`etiqueta.sulfitos.${et2.id}`]: et2.sulfitos - 8 },
      valoresPartida: { [`etiqueta.sulfitos.${et2.id}`]: et2.sulfitos },
      recursosAfectados: [`Mesa ${aprobadaA2.mesa}`, 'Requisitos automáticos', 'Etiquetas presentadas'],
      motivo: 'Corrección del análisis de sulfitos de la primera etiqueta.',
      creador: { id: MATEO.id, nombre: MATEO.nombre, rol: 'organizacion' }, creadaEn: '2026-11-09T14:00:00.000Z',
      estado: 'rechazada', decisor: { id: TOMAS.id, nombre: TOMAS.nombre, rol: 'revisor' }, decision: 'rechazar',
      motivoDecision: 'Falta el análisis de laboratorio que respalde el valor nuevo.', decididaEn: '2026-11-10T13:00:00.000Z', rev: 2,
    },
    {
      id: 'prop-seed-3', postulacionId: aprobadaB.id, convocatoriaId: CONV_ANTERIOR, revisionPartida: aprobadaB.rev,
      cambios: { [`etiqueta.cosecha.${etB.id}`]: String(Number(etB.cosecha) - 1) },
      valoresPartida: { [`etiqueta.cosecha.${etB.id}`]: etB.cosecha },
      recursosAfectados: [`Mesa ${aprobadaB.mesa}`, 'Etiquetas presentadas'],
      motivo: 'Ajuste posterior al cierre: la cosecha impresa en el catálogo de la edición 2026 estaba corrida un año.',
      creador: { id: LUCIA.id, nombre: LUCIA.nombre, rol: 'organizacion' }, creadaEn: '2026-11-10T15:00:00.000Z',
      estado: 'pendiente', decisor: null, decision: null, motivoDecision: null, decididaEn: null, rev: 1,
    },
  )
  const convB = s.entities.convocatorias.find((c) => c.id === CONV_ANTERIOR)
  s.entities.cierres.push({
    id: 'cie-conv-2026', convocatoriaId: CONV_ANTERIOR, instante: '2026-09-15T13:00:00.000Z',
    actor: { id: INES.id, nombre: INES.nombre, rol: 'revisor' }, revision: 0, nota: 'Cierre de la edición 2026.',
    totales: totalesDeRegistros(s, CONV_ANTERIOR),
  })
  convB.cerrada = true
  convB.cierreId = 'cie-conv-2026'
  return s
}

export const bodegaDemo = (state) => state.entities.bodegas.find((b) => b.id === BODEGA_DEMO)
export const actorDemoProductor = (state) => actorProductor(bodegaDemo(state))
