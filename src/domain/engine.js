// Motor de comandos. Función pura: recibe el estado confirmado y un comando,
// y devuelve un estado nuevo o un rechazo. No escribe en localStorage: eso lo
// hace la capa de persistencia, y solo si el motor aceptó el comando.
import {
  E, ESTADO_POR_ID, ESTADOS_EDITABLES_PRODUCTOR, ESTADOS_AFECTADOS_POR_REQUISITO, CAMPOS_CORREGIBLES, ACTOR_SISTEMA,
} from './constants.js'
import { DomainError, clone, huella, dentroDePlazo, formatoFecha } from './util.js'
import { convocatoria, mesas, pendientes, evaluarRequisitos, maxEtiquetas, minEtiquetas, valorCampo } from './selectors.js'

// Permisos de demo, aplicados en el motor (no solo ocultando botones).
export const PERMISOS = {
  POST_CREAR: ['productor'],
  POST_GUARDAR: ['productor'],
  POST_ENVIAR: ['productor'],
  POST_TOMAR: ['organizacion'],
  POST_CHECKLIST: ['organizacion'],
  POST_PEDIR_CAMBIOS: ['organizacion'],
  POST_RECHAZAR: ['organizacion'],
  POST_APROBAR: ['organizacion'],
  POST_COMENTAR: ['organizacion'],
  POST_BAJA: ['productor', 'organizacion'],
  POST_CONFIRMAR_REVISION: ['organizacion'],
  MESA_OFRECER: ['organizacion'],
  MESA_ENTREGAR: ['organizacion'],
  CONV_ACTUALIZAR: ['organizacion'],
  CONV_REQUISITO: ['organizacion'],
  PROP_CREAR: ['organizacion', 'revisor'],
  PROP_ACTUALIZAR: ['organizacion', 'revisor'],
  PROP_DECIDIR: ['revisor'],
  CIERRE_REGISTRAR: ['revisor'],
}

const err = (code, msg, detalle) => {
  throw new DomainError(code, msg, detalle)
}

export function huellaComando(cmd) {
  return huella({ tipo: cmd.tipo, actor: cmd.actor?.id, revisionEsperada: cmd.revisionEsperada ?? null, datos: cmd.datos })
}

/**
 * Aplica un comando.
 * @returns {{ok:true, state, respuesta, duplicado?:boolean} | {ok:false, error:{code,message,detalle}}}
 * Si el comando falla, el estado recibido no se toca.
 */
export function ejecutar(state, cmd, { now }) {
  try {
    if (!cmd || typeof cmd.id !== 'string' || !cmd.id) err('COMANDO_INVALIDO', 'El comando no tiene id.')
    if (!cmd.tipo || !HANDLERS[cmd.tipo]) err('COMANDO_INVALIDO', `Tipo de comando desconocido: ${cmd.tipo}`)
    if (!cmd.actor?.id || !cmd.actor?.rol) err('COMANDO_INVALIDO', 'El comando no indica quién lo hace.')
    if (!cmd.datos || typeof cmd.datos !== 'object') err('COMANDO_INVALIDO', 'El comando no trae datos.')

    const firma = huellaComando(cmd)
    const previo = state.comandos.find((c) => c.id === cmd.id)
    if (previo) {
      if (previo.huella === firma && previo.resultado === 'aplicado') {
        return { ok: true, state, respuesta: previo.respuesta, duplicado: true }
      }
      err('ID_REUSADO', 'Ese id de operación ya se usó con otros datos. No se aplicó nada.', { comandoId: cmd.id })
    }

    if (!PERMISOS[cmd.tipo].includes(cmd.actor.rol)) {
      err('SIN_PERMISO', `El perfil «${cmd.actor.rol}» no puede hacer esta operación (${cmd.tipo}).`)
    }

    const instante = new Date(now).toISOString()
    const draft = clone(state)
    const ctx = { state: draft, cmd, instante, now, rev: state.revision + 1, eventos: [] }
    const respuesta = HANDLERS[cmd.tipo](ctx) ?? {}

    draft.revision = ctx.rev
    draft.eventos.push(...ctx.eventos)
    draft.comandos.push({
      id: cmd.id,
      tipo: cmd.tipo,
      entidad: cmd.entidad ?? entidadDe(cmd.tipo),
      entidadId: entidadIdDe(cmd),
      actor: { id: cmd.actor.id, nombre: cmd.actor.nombre, rol: cmd.actor.rol },
      instante,
      revisionEsperada: cmd.revisionEsperada ?? null,
      revision: ctx.rev,
      datos: cmd.datos,
      huella: firma,
      resultado: 'aplicado',
      eventos: ctx.eventos.map((e) => e.id),
      respuesta,
    })
    return { ok: true, state: draft, respuesta }
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: { code: e.code, message: e.message, detalle: e.detalle } }
    throw e
  }
}

const entidadDe = (tipo) =>
  tipo.startsWith('POST_') || tipo.startsWith('MESA_ENTREGAR') ? 'postulacion'
    : tipo.startsWith('PROP_') ? 'propuesta'
      : tipo.startsWith('CIERRE') ? 'cierre' : 'convocatoria'
const entidadIdDe = (cmd) => cmd.datos.postulacionId ?? cmd.datos.propuestaId ?? cmd.datos.convocatoriaId ?? null

// ───────────────────────── ayudas internas ─────────────────────────

function emitir(ctx, ev) {
  const actor = ev.actor ?? ctx.cmd.actor
  ctx.eventos.push({
    id: `ev-${ctx.rev}-${ctx.eventos.length + 1}`,
    comandoId: ctx.cmd.id,
    revision: ctx.rev,
    instante: ctx.instante,
    actor: { id: actor.id, nombre: actor.nombre, rol: actor.rol },
    tipo: ev.tipo,
    entidad: ev.entidad ?? 'postulacion',
    entidadId: ev.entidadId,
    convocatoriaId: ev.convocatoriaId,
    estadoAnterior: ev.estadoAnterior ?? null,
    estadoNuevo: ev.estadoNuevo ?? null,
    efectos: ev.efectos ?? [],
    motivo: ev.motivo ?? null,
  })
}

function tocar(ctx, ent) {
  ent.rev = (ent.rev ?? 0) + 1
  ent.actualizadaEn = ctx.instante
}

function getPost(ctx, id) {
  const p = ctx.state.entities.postulaciones.find((x) => x.id === id)
  if (!p) err('NO_EXISTE', 'No encontramos esa postulación.')
  return p
}
function getConv(ctx, id) {
  const c = convocatoria(ctx.state, id)
  if (!c) err('NO_EXISTE', 'No encontramos esa convocatoria.')
  return c
}

function exigirRevision(ctx, ent, nombre = 'Esta postulación') {
  const esperada = ctx.cmd.revisionEsperada
  if (esperada === undefined || esperada === null) err('REVISION_FALTANTE', 'Falta la revisión esperada del registro.')
  if (ent.rev !== esperada) {
    err(
      'REVISION_DESACTUALIZADA',
      `${nombre} cambió mientras la tenías abierta: la revisión vigente es la ${ent.rev} y vos partiste de la ${esperada}. Actualizá los datos y volvé a revisar antes de confirmar.`,
      { vigente: ent.rev, esperada },
    )
  }
}

function exigirDuenio(ctx, post) {
  if (ctx.cmd.actor.rol === 'productor' && post.bodegaId !== ctx.cmd.actor.bodegaId) {
    err('SIN_PERMISO', 'Solo podés ver y editar la postulación de tu bodega.')
  }
}

function exigirAbierta(conv) {
  if (conv.cerrada) err('EDICION_CERRADA', `La edición «${conv.nombre}» está cerrada. Cualquier corrección va por propuesta de ajuste.`)
}

function exigirEstado(post, permitidos, accion) {
  if (!permitidos.includes(post.estado)) {
    const actual = ESTADO_POR_ID[post.estado]?.label ?? post.estado
    const msg = post.estado === E.BAJA && accion === 'dar de baja'
      ? 'Esta postulación ya está dada de baja. No se repite el efecto.'
      : `No se puede ${accion} una postulación en «${actual}». Se permite desde: ${permitidos.map((s) => ESTADO_POR_ID[s].label).join(', ')}.`
    err('TRANSICION_INVALIDA', msg, { estado: post.estado })
  }
}

function cambiarEstado(ctx, post, nuevo, extra = {}) {
  const anterior = post.estado
  post.estado = nuevo
  tocar(ctx, post)
  emitir(ctx, {
    tipo: 'cambio_estado',
    entidadId: post.id,
    convocatoriaId: post.convocatoriaId,
    estadoAnterior: anterior,
    estadoNuevo: nuevo,
    ...extra,
  })
}

function comentar(ctx, post, texto, tipo) {
  post.comentarios.push({
    id: `com-${ctx.rev}-${post.comentarios.length + 1}`,
    autor: ctx.cmd.actor.nombre,
    rol: ctx.cmd.actor.rol,
    texto,
    tipo,
    instante: ctx.instante,
  })
}

function exigirComentario(texto, accion) {
  const t = (texto ?? '').trim()
  if (t.length < 5) err('COMENTARIO_OBLIGATORIO', `Para ${accion} tenés que dejar un comentario que la bodega pueda leer (mínimo 5 caracteres).`)
  return t
}

// Asigna la primera mesa libre o, si no hay, manda a lista de espera.
function aprobarOEsperar(ctx, conv, post, actor) {
  const { libres, espera } = mesas(ctx.state, conv.id)
  post.reqVersionRevisada = conv.requisitosVersion
  post.paraRevisar = false
  if (libres.length) {
    const mesa = libres[0]
    const anterior = post.estado
    post.mesa = mesa
    post.ordenEspera = null
    post.valorMesaCongelado = conv.valorMesa
    post.aprobadaEn = ctx.instante
    cambiarEstado(ctx, post, E.APROBADA, { actor, efectos: [{ tipo: 'mesa_asignada', mesa }], motivo: anterior === E.LISTA_ESPERA ? 'Se liberó una mesa y pasa la primera de la lista de espera' : null })
    return { estado: E.APROBADA, mesa }
  }
  const orden = Math.max(0, ...ctx.state.entities.postulaciones.filter((p) => p.convocatoriaId === conv.id && p.ordenEspera != null).map((p) => p.ordenEspera)) + 1
  post.ordenEspera = orden
  cambiarEstado(ctx, post, E.LISTA_ESPERA, { actor, efectos: [{ tipo: 'espera_entrada', orden }] })
  return { estado: E.LISTA_ESPERA, posicion: espera.length + 1 }
}

function promoverPrimera(ctx, conv) {
  const { libres, espera } = mesas(ctx.state, conv.id)
  if (!libres.length || !espera.length) return null
  const primera = espera[0]
  const r = aprobarOEsperar(ctx, conv, primera, ACTOR_SISTEMA)
  return { postulacionId: primera.id, ...r }
}

// ───────────────────────── validaciones ─────────────────────────

export function validarEnvio(post, conv) {
  const errores = []
  const f = post.ficha
  const req = (campo, ok, mensaje) => !ok && errores.push({ campo, mensaje })
  req('ficha.nombre', str(f.nombre), 'Falta el nombre de la bodega')
  req('ficha.provincia', str(f.provincia), 'Falta la provincia')
  req('ficha.localidad', str(f.localidad), 'Falta la localidad')
  req('ficha.hectareas', num(f.hectareas) && Number(f.hectareas) > 0, 'Las hectáreas tienen que ser un número mayor a 0')
  req('ficha.uva', ['propia', 'comprada'].includes(f.uva), 'Indicá si la uva es propia o comprada')
  req('ficha.vinedo', f.uva !== 'comprada' || str(f.vinedo), 'Si la uva es comprada, identificá el viñedo de origen')
  req('ficha.botellasAnio', num(f.botellasAnio) && Number.isInteger(Number(f.botellasAnio)) && Number(f.botellasAnio) > 0, 'Las botellas por año tienen que ser un número entero')
  req('ficha.contacto.nombre', str(f.contacto?.nombre), 'Falta el nombre de contacto')
  req('ficha.contacto.email', /.+@.+\..+/.test(f.contacto?.email ?? ''), 'El correo de contacto no parece válido')

  const n = post.etiquetas.length
  const max = maxEtiquetas(conv)
  const min = minEtiquetas(conv)
  if (n < min) errores.push({ campo: 'etiquetas', mensaje: `Cargá al menos ${min} etiqueta(s)` })
  if (n > max) errores.push({ campo: 'etiquetas', mensaje: `Presentaste ${n} etiquetas y el máximo es ${max}. Sacá ${n - max}.` })
  post.etiquetas.forEach((e, i) => {
    const nom = e.nombre || `la etiqueta ${i + 1}`
    req(`etiquetas.${e.id}.nombre`, str(e.nombre), `Falta el nombre de la etiqueta ${i + 1}`)
    req(`etiquetas.${e.id}.cepa`, str(e.cepa), `Te falta la cepa de ${nom}`)
    req(`etiquetas.${e.id}.sulfitos`, num(e.sulfitos) && Number(e.sulfitos) >= 0, `Te faltan los sulfitos totales de ${nom}`)
    req(`etiquetas.${e.id}.cosecha`, !str(e.cosecha) || /^(19|20)\d\d$/.test(String(e.cosecha)), `La cosecha de ${nom} tiene que ser un año (por ejemplo 2024)`)
  })

  const d = post.declaraciones ?? {}
  const DECL = {
    uva: 'uva propia o de viñedo identificado',
    levaduras: 'fermentación con levaduras nativas',
    correcciones: 'sin correcciones de acidez ni de azúcar',
    veracidad: 'los datos cargados son reales',
  }
  for (const [k, txt] of Object.entries(DECL)) req(`declaraciones.${k}`, d[k] === true, `Falta confirmar: ${txt}`)
  return errores
}
const str = (v) => typeof v === 'string' && v.trim().length > 0
const num = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))

const CAMPOS_FICHA = ['nombre', 'provincia', 'localidad', 'hectareas', 'uva', 'vinedo', 'botellasAnio']

function limpiarFicha(actual, nueva) {
  const out = { ...actual }
  for (const k of CAMPOS_FICHA) if (nueva[k] !== undefined) out[k] = typeof nueva[k] === 'string' ? nueva[k].slice(0, 120) : nueva[k]
  if (nueva.contacto) {
    out.contacto = { ...actual.contacto }
    for (const k of ['nombre', 'email', 'telefono']) if (nueva.contacto[k] !== undefined) out.contacto[k] = String(nueva.contacto[k]).slice(0, 120)
  }
  return out
}
function limpiarEtiquetas(lista) {
  if (!Array.isArray(lista)) err('DATOS_INVALIDOS', 'Las etiquetas tienen que ser una lista.')
  if (lista.length > 20) err('DATOS_INVALIDOS', 'No se pueden cargar más de 20 etiquetas en el borrador.')
  const ids = new Set()
  return lista.map((e) => {
    if (!e.id || ids.has(e.id)) err('DATOS_INVALIDOS', 'Cada etiqueta necesita un id único.')
    ids.add(e.id)
    return {
      id: String(e.id),
      nombre: String(e.nombre ?? '').slice(0, 80),
      cepa: String(e.cepa ?? '').slice(0, 80),
      cosecha: e.cosecha === undefined || e.cosecha === null ? '' : String(e.cosecha).slice(0, 4),
      sulfitos: e.sulfitos === '' || e.sulfitos === null || e.sulfitos === undefined ? '' : Number(e.sulfitos),
    }
  })
}

function totalesDeRegistros(state, convId) {
  const posts = state.entities.postulaciones.filter((p) => p.convocatoriaId === convId)
  const porEstado = {}
  for (const p of posts) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1
  const m = mesas(state, convId)
  return {
    postulaciones: posts.length,
    porEstado,
    cupo: m.cupo,
    mesasAsignadas: m.asignadas.length,
    mesasEntregadas: m.entregadas.length,
    listaEspera: m.espera.length,
    valorMesasInformativo: m.asignadas.reduce((s, p) => s + (p.valorMesaCongelado ?? 0), 0),
  }
}
export { totalesDeRegistros }

// ───────────────────────── manejadores ─────────────────────────

const HANDLERS = {
  POST_CREAR(ctx) {
    const { postulacionId, convocatoriaId, bodega: nueva } = ctx.cmd.datos
    const { actor } = ctx.cmd
    const conv = getConv(ctx, convocatoriaId)
    exigirAbierta(conv)
    if (!postulacionId) err('DATOS_INVALIDOS', 'Falta el id de la postulación.')
    if (ctx.state.entities.postulaciones.some((p) => p.id === postulacionId)) err('DATOS_INVALIDOS', 'Ese id de postulación ya existe.')
    let bod = ctx.state.entities.bodegas.find((b) => b.id === actor.bodegaId)
    if (nueva) {
      if (bod) err('DATOS_INVALIDOS', 'Esa bodega ya existe.')
      if (nueva.id !== actor.bodegaId) err('SIN_PERMISO', 'Solo podés crear tu propia bodega.')
      if (!str(nueva.nombre)) err('DATOS_INVALIDOS', 'Falta el nombre de la bodega.')
      bod = { id: nueva.id, nombre: nueva.nombre.trim().slice(0, 80), provincia: nueva.provincia ?? '', localidad: nueva.localidad ?? '', creadaEn: ctx.instante }
      ctx.state.entities.bodegas.push(bod)
    }
    if (!bod) err('SIN_PERMISO', 'Tu perfil no corresponde a ninguna bodega.')
    if (ctx.state.entities.postulaciones.some((p) => p.bodegaId === bod.id && p.convocatoriaId === conv.id)) {
      err('YA_EXISTE', 'Tu bodega ya tiene una postulación en esta edición.')
    }
    const post = nuevaPostulacion({ id: postulacionId, conv, bod, instante: ctx.instante })
    ctx.state.entities.postulaciones.push(post)
    emitir(ctx, { tipo: 'creacion', entidadId: post.id, convocatoriaId: conv.id, estadoAnterior: null, estadoNuevo: E.BORRADOR })
    return { postulacionId: post.id }
  },

  POST_GUARDAR(ctx) {
    const { postulacionId, ficha, etiquetas, declaraciones } = ctx.cmd.datos
    const post = getPost(ctx, postulacionId)
    exigirDuenio(ctx, post)
    exigirAbierta(getConv(ctx, post.convocatoriaId))
    if (!ESTADOS_EDITABLES_PRODUCTOR.includes(post.estado)) {
      err('NO_EDITABLE', `Tu postulación está «${ESTADO_POR_ID[post.estado].label}». Solo se puede editar en Borrador o cuando te piden cambios.`)
    }
    exigirRevision(ctx, post, 'Tu postulación')
    if (ficha) post.ficha = limpiarFicha(post.ficha, ficha)
    if (etiquetas) post.etiquetas = limpiarEtiquetas(etiquetas)
    if (declaraciones) {
      for (const k of ['uva', 'levaduras', 'correcciones', 'veracidad']) if (declaraciones[k] !== undefined) post.declaraciones[k] = declaraciones[k] === true
    }
    tocar(ctx, post)
    emitir(ctx, { tipo: 'datos_editados', entidadId: post.id, convocatoriaId: post.convocatoriaId })
    return { rev: post.rev }
  },

  POST_ENVIAR(ctx) {
    const post = getPost(ctx, ctx.cmd.datos.postulacionId)
    exigirDuenio(ctx, post)
    const conv = getConv(ctx, post.convocatoriaId)
    exigirAbierta(conv)
    exigirEstado(post, [E.BORRADOR, E.REQUIERE_CAMBIOS], 'enviar')
    exigirRevision(ctx, post, 'Tu postulación')
    if (post.estado === E.BORRADOR) {
      const plazo = dentroDePlazo(conv, ctx.now)
      if (!plazo.ok) {
        err('FUERA_DE_PLAZO', plazo.motivo === 'cerro'
          ? `La convocatoria cerró el ${formatoFecha(conv.cierre)}. Ya no se aceptan envíos nuevos.`
          : `La convocatoria abre el ${formatoFecha(conv.apertura)}. Todavía no se puede enviar.`)
      }
    }
    const errores = validarEnvio(post, conv)
    if (errores.length) err('FALTAN_DATOS', `Todavía no se puede enviar: ${errores.length === 1 ? errores[0].mensaje.toLowerCase() : `hay ${errores.length} cosas por completar`}.`, { errores })
    const reenvio = post.estado === E.REQUIERE_CAMBIOS
    post.enviadaEn = ctx.instante
    cambiarEstado(ctx, post, E.ENVIADA, { motivo: reenvio ? 'Reenvío con los cambios pedidos' : null })
    return { estado: E.ENVIADA }
  },

  POST_TOMAR(ctx) {
    const post = getPost(ctx, ctx.cmd.datos.postulacionId)
    exigirAbierta(getConv(ctx, post.convocatoriaId))
    exigirEstado(post, [E.ENVIADA], 'tomar para revisión')
    exigirRevision(ctx, post)
    cambiarEstado(ctx, post, E.EN_REVISION)
    return { estado: E.EN_REVISION }
  },

  POST_CHECKLIST(ctx) {
    const { postulacionId, requisitoId, valor } = ctx.cmd.datos
    const post = getPost(ctx, postulacionId)
    const conv = getConv(ctx, post.convocatoriaId)
    exigirAbierta(conv)
    if (!(post.estado === E.EN_REVISION || ([E.APROBADA, E.LISTA_ESPERA].includes(post.estado) && post.paraRevisar))) {
      err('TRANSICION_INVALIDA', 'El checklist se marca con la postulación en revisión o marcada «Para revisar».')
    }
    exigirRevision(ctx, post)
    const req = conv.requisitos.find((r) => r.id === requisitoId)
    if (!req) err('NO_EXISTE', 'Ese requisito no existe en esta convocatoria.')
    if (req.tipo !== 'manual') err('DATOS_INVALIDOS', 'Ese requisito se calcula solo a partir de los datos.')
    post.checklistManual[req.id] = { valor: valor === true, version: req.version, actorId: ctx.cmd.actor.id, instante: ctx.instante }
    tocar(ctx, post)
    emitir(ctx, { tipo: 'checklist', entidadId: post.id, convocatoriaId: post.convocatoriaId, efectos: [{ tipo: 'checklist', requisitoId: req.id, valor: valor === true }] })
    return { rev: post.rev }
  },

  POST_PEDIR_CAMBIOS(ctx) {
    const post = getPost(ctx, ctx.cmd.datos.postulacionId)
    exigirAbierta(getConv(ctx, post.convocatoriaId))
    exigirEstado(post, [E.EN_REVISION], 'pedir cambios a')
    exigirRevision(ctx, post)
    const texto = exigirComentario(ctx.cmd.datos.comentario, 'pedir cambios')
    comentar(ctx, post, texto, 'cambios')
    cambiarEstado(ctx, post, E.REQUIERE_CAMBIOS, { motivo: texto })
    return { estado: E.REQUIERE_CAMBIOS }
  },

  POST_RECHAZAR(ctx) {
    const post = getPost(ctx, ctx.cmd.datos.postulacionId)
    exigirAbierta(getConv(ctx, post.convocatoriaId))
    exigirEstado(post, [E.EN_REVISION], 'rechazar')
    exigirRevision(ctx, post)
    const texto = exigirComentario(ctx.cmd.datos.comentario, 'rechazar')
    comentar(ctx, post, texto, 'rechazo')
    cambiarEstado(ctx, post, E.RECHAZADA, { motivo: texto })
    return { estado: E.RECHAZADA }
  },

  POST_COMENTAR(ctx) {
    const post = getPost(ctx, ctx.cmd.datos.postulacionId)
    if (post.estado === E.BORRADOR) err('TRANSICION_INVALIDA', 'Todavía no se puede comentar un borrador.')
    exigirRevision(ctx, post)
    const texto = exigirComentario(ctx.cmd.datos.comentario, 'comentar')
    comentar(ctx, post, texto, 'nota')
    tocar(ctx, post)
    emitir(ctx, { tipo: 'comentario', entidadId: post.id, convocatoriaId: post.convocatoriaId, motivo: texto })
    return { rev: post.rev }
  },

  POST_APROBAR(ctx) {
    const post = getPost(ctx, ctx.cmd.datos.postulacionId)
    const conv = getConv(ctx, post.convocatoriaId)
    exigirAbierta(conv)
    exigirEstado(post, [E.EN_REVISION], 'aprobar')
    exigirRevision(ctx, post)
    const faltan = pendientes(post, conv)
    if (faltan.length) {
      err('REQUISITOS_PENDIENTES', `No se puede aprobar: ${faltan.length === 1 ? 'falta 1 requisito' : `faltan ${faltan.length} requisitos`} (${faltan.map((f) => f.req.texto).join('; ')}).`, { pendientes: faltan.map((f) => ({ id: f.req.id, texto: f.req.texto, detalle: f.detalle })) })
    }
    if (str(ctx.cmd.datos.comentario)) comentar(ctx, post, ctx.cmd.datos.comentario.trim(), 'nota')
    return aprobarOEsperar(ctx, conv, post, ctx.cmd.actor)
  },

  POST_BAJA(ctx) {
    const post = getPost(ctx, ctx.cmd.datos.postulacionId)
    exigirDuenio(ctx, post)
    const conv = getConv(ctx, post.convocatoriaId)
    exigirAbierta(conv)
    exigirEstado(post, [E.APROBADA, E.LISTA_ESPERA], 'dar de baja')
    exigirRevision(ctx, post)
    const motivo = ctx.cmd.actor.rol === 'organizacion'
      ? exigirComentario(ctx.cmd.datos.motivo, 'dar de baja a una bodega')
      : (ctx.cmd.datos.motivo ?? '').trim() || 'La bodega se bajó de la feria'
    const efectos = []
    if (post.mesa != null) {
      efectos.push({ tipo: 'mesa_liberada', mesa: post.mesa })
      post.mesa = null
      post.mesaEntregada = false
    }
    if (post.estado === E.LISTA_ESPERA) {
      efectos.push({ tipo: 'espera_salida', orden: post.ordenEspera })
      post.ordenEspera = null
    }
    cambiarEstado(ctx, post, E.BAJA, { efectos, motivo })
    const promovida = promoverPrimera(ctx, conv)
    return { estado: E.BAJA, promovida }
  },

  POST_CONFIRMAR_REVISION(ctx) {
    const post = getPost(ctx, ctx.cmd.datos.postulacionId)
    const conv = getConv(ctx, post.convocatoriaId)
    exigirAbierta(conv)
    if (!post.paraRevisar) err('TRANSICION_INVALIDA', 'Esta postulación no está marcada «Para revisar».')
    exigirRevision(ctx, post)
    const faltan = pendientes(post, conv)
    if (faltan.length) {
      err('REQUISITOS_PENDIENTES', `Con los requisitos de la versión ${conv.requisitosVersion} todavía falta: ${faltan.map((f) => f.req.texto).join('; ')}.`, { pendientes: faltan.map((f) => ({ id: f.req.id, texto: f.req.texto, detalle: f.detalle })) })
    }
    post.paraRevisar = false
    post.reqVersionRevisada = conv.requisitosVersion
    tocar(ctx, post)
    emitir(ctx, { tipo: 'revision_confirmada', entidadId: post.id, convocatoriaId: conv.id, efectos: [{ tipo: 'revision_confirmada', version: conv.requisitosVersion }] })
    return { rev: post.rev }
  },

  MESA_OFRECER(ctx) {
    const conv = getConv(ctx, ctx.cmd.datos.convocatoriaId)
    exigirAbierta(conv)
    const r = promoverPrimera(ctx, conv)
    if (!r) err('SIN_MESA', 'No hay a quién ofrecer: hacen falta una mesa libre y alguien en lista de espera.')
    return r
  },

  MESA_ENTREGAR(ctx) {
    const post = getPost(ctx, ctx.cmd.datos.postulacionId)
    exigirAbierta(getConv(ctx, post.convocatoriaId))
    if (post.estado !== E.APROBADA || post.mesa == null) err('TRANSICION_INVALIDA', 'Solo se acredita una bodega aprobada con mesa.')
    if (post.mesaEntregada) err('YA_ENTREGADA', `La mesa ${post.mesa} ya está acreditada. No se repite el efecto.`)
    exigirRevision(ctx, post)
    post.mesaEntregada = true
    tocar(ctx, post)
    emitir(ctx, { tipo: 'mesa_entregada', entidadId: post.id, convocatoriaId: post.convocatoriaId, efectos: [{ tipo: 'mesa_entregada', mesa: post.mesa }] })
    return { mesa: post.mesa }
  },

  CONV_ACTUALIZAR(ctx) {
    const { convocatoriaId, cambios = {} } = ctx.cmd.datos
    const conv = getConv(ctx, convocatoriaId)
    exigirAbierta(conv)
    exigirRevision(ctx, conv, 'La convocatoria')
    const efectos = []
    if (cambios.cupo !== undefined) {
      const cupo = Number(cambios.cupo)
      if (!Number.isInteger(cupo) || cupo < 1 || cupo > 500) err('CUPO_INVALIDO', 'El cupo tiene que ser un número entero entre 1 y 500.')
      const m = mesas(ctx.state, conv.id)
      const minimo = Math.max(m.asignadas.length, m.mayorAsignada)
      if (cupo < minimo) {
        err('CUPO_INVALIDO', `No podés bajar el cupo a ${cupo}: hay ${m.asignadas.length} mesas asignadas y la más alta es la ${m.mayorAsignada}. El mínimo posible es ${minimo}.`, { minimo })
      }
      if (cupo !== conv.cupo) efectos.push({ tipo: 'cupo_cambiado', de: conv.cupo, a: cupo })
      conv.cupo = cupo
    }
    for (const k of ['apertura', 'cierre']) {
      if (cambios[k] !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cambios[k])) err('DATOS_INVALIDOS', 'Las fechas van con formato AAAA-MM-DD.')
        conv[k] = cambios[k]
      }
    }
    if (conv.apertura > conv.cierre) err('DATOS_INVALIDOS', 'La apertura tiene que ser anterior o igual al cierre.')
    if (cambios.valorMesa !== undefined) {
      const v = Number(cambios.valorMesa)
      if (!Number.isInteger(v) || v < 0) err('DATOS_INVALIDOS', 'El valor de mesa tiene que ser un número entero en pesos.')
      if (v !== conv.valorMesa) efectos.push({ tipo: 'valor_cambiado', de: conv.valorMesa, a: v })
      conv.valorMesa = v
    }
    for (const k of ['nombre', 'lugar', 'jornadas']) if (cambios[k] !== undefined) conv[k] = String(cambios[k]).slice(0, 120)
    tocar(ctx, conv)
    emitir(ctx, { tipo: 'convocatoria_actualizada', entidad: 'convocatoria', entidadId: conv.id, convocatoriaId: conv.id, efectos })
    return { rev: conv.rev }
  },

  CONV_REQUISITO(ctx) {
    const { convocatoriaId, requisitoId, param, texto, pideRevision, motivo } = ctx.cmd.datos
    const conv = getConv(ctx, convocatoriaId)
    exigirAbierta(conv)
    exigirRevision(ctx, conv, 'La convocatoria')
    const req = conv.requisitos.find((r) => r.id === requisitoId)
    if (!req) err('NO_EXISTE', 'Ese requisito no existe en esta convocatoria.')
    const mot = exigirComentario(motivo, 'cambiar un requisito')
    const antes = clone(req)
    if (texto !== undefined) {
      if (!str(texto)) err('DATOS_INVALIDOS', 'El texto del requisito no puede quedar vacío.')
      req.texto = texto.trim().slice(0, 160)
    }
    if (param !== undefined) {
      if (req.clave === 'sulfitos' || req.clave === 'botellas') {
        const max = Number(param.max)
        if (!Number.isFinite(max) || max <= 0) err('DATOS_INVALIDOS', 'El tope tiene que ser un número mayor a 0.')
        req.param = { max }
      } else if (req.clave === 'etiquetas') {
        const min = Number(param.min)
        const max = Number(param.max)
        if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 20) err('DATOS_INVALIDOS', 'Las etiquetas van de 1 a 20 y el mínimo no puede superar al máximo.')
        req.param = { min, max }
      } else err('DATOS_INVALIDOS', 'Este requisito no tiene parámetros.')
    }
    if (JSON.stringify(antes) === JSON.stringify(req)) err('SIN_CAMBIOS', 'No cambiaste nada del requisito.')
    const version = conv.requisitosVersion + 1
    conv.requisitosVersion = version
    req.version = version
    conv.historialRequisitos.push({ version, requisitoId, antes, despues: clone(req), pideRevision: pideRevision === true, motivo: mot, actorId: ctx.cmd.actor.id, instante: ctx.instante })
    tocar(ctx, conv)
    emitir(ctx, { tipo: 'requisito_cambiado', entidad: 'convocatoria', entidadId: conv.id, convocatoriaId: conv.id, motivo: mot, efectos: [{ tipo: 'requisito_cambiado', requisitoId, version, pideRevision: pideRevision === true }] })
    const afectadas = []
    if (pideRevision === true) {
      for (const p of ctx.state.entities.postulaciones) {
        if (p.convocatoriaId !== conv.id) continue
        if (!ESTADOS_AFECTADOS_POR_REQUISITO.includes(p.estado)) continue
        if ((p.reqVersionRevisada ?? 0) >= version) continue
        p.paraRevisar = true
        p.paraRevisarDesde = version
        tocar(ctx, p)
        emitir(ctx, { tipo: 'para_revisar', entidadId: p.id, convocatoriaId: conv.id, motivo: mot, efectos: [{ tipo: 'para_revisar', version, requisitoId }] })
        afectadas.push(p.id)
      }
    }
    return { version, afectadas }
  },

  PROP_CREAR(ctx) {
    const { propuestaId, postulacionId, cambios, motivo } = ctx.cmd.datos
    const post = getPost(ctx, postulacionId)
    if (post.estado === E.BORRADOR) err('TRANSICION_INVALIDA', 'Un borrador se corrige directamente; las propuestas son para registros confirmados.')
    exigirRevision(ctx, post)
    if (!propuestaId || ctx.state.entities.propuestas.some((p) => p.id === propuestaId)) err('DATOS_INVALIDOS', 'Falta un id de propuesta nuevo.')
    const mot = exigirComentario(motivo, 'proponer una corrección')
    const limpios = validarCambios(post, cambios)
    const prop = {
      id: propuestaId,
      postulacionId,
      convocatoriaId: post.convocatoriaId,
      revisionPartida: post.rev,
      cambios: limpios,
      valoresPartida: Object.fromEntries(Object.keys(limpios).map((r) => [r, valorCampo(post, r) ?? null])),
      recursosAfectados: recursosAfectados(post, limpios),
      motivo: mot,
      creador: { id: ctx.cmd.actor.id, nombre: ctx.cmd.actor.nombre, rol: ctx.cmd.actor.rol },
      creadaEn: ctx.instante,
      estado: 'pendiente',
      decisor: null,
      decision: null,
      motivoDecision: null,
      decididaEn: null,
      rev: 1,
    }
    ctx.state.entities.propuestas.push(prop)
    emitir(ctx, { tipo: 'propuesta_creada', entidad: 'propuesta', entidadId: prop.id, convocatoriaId: post.convocatoriaId, motivo: mot, efectos: [{ tipo: 'propuesta_creada', postulacionId }] })
    return { propuestaId: prop.id }
  },

  PROP_ACTUALIZAR(ctx) {
    const prop = ctx.state.entities.propuestas.find((p) => p.id === ctx.cmd.datos.propuestaId)
    if (!prop) err('NO_EXISTE', 'No encontramos esa propuesta.')
    if (prop.estado !== 'pendiente') err('YA_DECIDIDA', 'La propuesta ya fue decidida.')
    exigirRevision(ctx, prop, 'La propuesta')
    const post = getPost(ctx, prop.postulacionId)
    prop.revisionPartida = post.rev
    prop.valoresPartida = Object.fromEntries(Object.keys(prop.cambios).map((r) => [r, valorCampo(post, r) ?? null]))
    prop.recursosAfectados = recursosAfectados(post, prop.cambios)
    tocar(ctx, prop)
    emitir(ctx, { tipo: 'propuesta_actualizada', entidad: 'propuesta', entidadId: prop.id, convocatoriaId: prop.convocatoriaId, efectos: [{ tipo: 'propuesta_rebasada', revisionPartida: post.rev }] })
    return { revisionPartida: post.rev }
  },

  PROP_DECIDIR(ctx) {
    const { propuestaId, decision, motivo } = ctx.cmd.datos
    const prop = ctx.state.entities.propuestas.find((p) => p.id === propuestaId)
    if (!prop) err('NO_EXISTE', 'No encontramos esa propuesta.')
    if (prop.estado !== 'pendiente') err('YA_DECIDIDA', `La propuesta ya fue ${prop.estado}. No se repite el efecto.`)
    if (prop.creador.id === ctx.cmd.actor.id) err('AUTOAPROBACION', 'No podés decidir una propuesta que creaste vos. Tiene que decidirla otra persona de revisión.')
    if (!['aprobar', 'rechazar'].includes(decision)) err('DATOS_INVALIDOS', 'La decisión es aprobar o rechazar.')
    exigirRevision(ctx, prop, 'La propuesta')
    const mot = decision === 'rechazar' ? exigirComentario(motivo, 'rechazar una propuesta') : (motivo ?? '').trim() || null
    const post = getPost(ctx, prop.postulacionId)
    const conv = getConv(ctx, post.convocatoriaId)
    if (decision === 'aprobar') {
      if (post.rev !== prop.revisionPartida) {
        err('PROPUESTA_DESACTUALIZADA', `La postulación cambió desde que se armó la propuesta (revisión ${prop.revisionPartida} → ${post.rev}). Hay que actualizar la propuesta y revisarla de nuevo.`, { vigente: post.rev, partida: prop.revisionPartida })
      }
      const detalle = Object.entries(prop.cambios).map(([ruta, despues]) => ({ ruta, antes: valorCampo(post, ruta) ?? null, despues }))
      aplicarCambios(post, prop.cambios)
      tocar(ctx, post)
      const ajuste = {
        id: `aj-${prop.id}`,
        propuestaId: prop.id,
        postulacionId: post.id,
        convocatoriaId: post.convocatoriaId,
        cambios: detalle,
        creador: prop.creador,
        decisor: { id: ctx.cmd.actor.id, nombre: ctx.cmd.actor.nombre, rol: ctx.cmd.actor.rol },
        instante: ctx.instante,
        posteriorAlCierre: conv.cerrada === true,
        motivo: prop.motivo,
      }
      ctx.state.entities.ajustes.push(ajuste)
      const efectos = [{ tipo: 'ajuste_aplicado', ajusteId: ajuste.id }]
      if ([E.APROBADA, E.LISTA_ESPERA].includes(post.estado) && evaluarRequisitos(post, conv).some((r) => r.automatico && !r.cumple)) {
        post.paraRevisar = true
        efectos.push({ tipo: 'para_revisar' })
      }
      emitir(ctx, { tipo: 'ajuste_aplicado', entidadId: post.id, convocatoriaId: post.convocatoriaId, motivo: prop.motivo, efectos })
    }
    prop.estado = decision === 'aprobar' ? 'aprobada' : 'rechazada'
    prop.decision = decision
    prop.motivoDecision = mot
    prop.decisor = { id: ctx.cmd.actor.id, nombre: ctx.cmd.actor.nombre, rol: ctx.cmd.actor.rol }
    prop.decididaEn = ctx.instante
    tocar(ctx, prop)
    emitir(ctx, { tipo: 'propuesta_decidida', entidad: 'propuesta', entidadId: prop.id, convocatoriaId: prop.convocatoriaId, estadoAnterior: 'pendiente', estadoNuevo: prop.estado, motivo: mot })
    return { estado: prop.estado }
  },

  CIERRE_REGISTRAR(ctx) {
    const { convocatoriaId, cierreId, nota } = ctx.cmd.datos
    const conv = getConv(ctx, convocatoriaId)
    if (conv.cerrada) err('YA_CERRADA', `«${conv.nombre}» ya tiene cierre registrado. Un segundo cierre no cambia nada.`)
    if (!cierreId || ctx.state.entities.cierres.some((c) => c.id === cierreId)) err('DATOS_INVALIDOS', 'Falta un id de cierre nuevo.')
    const cierre = {
      id: cierreId,
      convocatoriaId,
      instante: ctx.instante,
      actor: { id: ctx.cmd.actor.id, nombre: ctx.cmd.actor.nombre, rol: ctx.cmd.actor.rol },
      revision: ctx.rev,
      nota: (nota ?? '').trim() || null,
      totales: totalesDeRegistros(ctx.state, convocatoriaId),
    }
    ctx.state.entities.cierres.push(cierre)
    conv.cerrada = true
    conv.cierreId = cierreId
    tocar(ctx, conv)
    emitir(ctx, { tipo: 'cierre_registrado', entidad: 'convocatoria', entidadId: conv.id, convocatoriaId, efectos: [{ tipo: 'cierre_registrado', cierreId }] })
    return { cierreId }
  },
}

export function nuevaPostulacion({ id, conv, bod, instante }) {
  return {
    id,
    convocatoriaId: conv.id,
    bodegaId: bod.id,
    estado: E.BORRADOR,
    rev: 1,
    ficha: {
      nombre: bod.nombre, provincia: bod.provincia ?? '', localidad: bod.localidad ?? '', hectareas: '', uva: '', vinedo: '', botellasAnio: '',
      contacto: { nombre: '', email: '', telefono: '' },
    },
    etiquetas: [],
    declaraciones: { uva: false, levaduras: false, correcciones: false, veracidad: false },
    checklistManual: {},
    comentarios: [],
    reqVersionRevisada: null,
    paraRevisar: false,
    mesa: null,
    mesaEntregada: false,
    ordenEspera: null,
    valorMesaCongelado: null,
    creadaEn: instante,
    actualizadaEn: instante,
    enviadaEn: null,
    aprobadaEn: null,
  }
}

function validarCambios(post, cambios) {
  if (!cambios || typeof cambios !== 'object' || !Object.keys(cambios).length) err('SIN_CAMBIOS', 'La propuesta no trae cambios.')
  const out = {}
  for (const [ruta, valor] of Object.entries(cambios)) {
    const [grupo, campo, etiquetaId] = ruta.split('.')
    if (!CAMPOS_CORREGIBLES[`${grupo}.${campo}`]) err('DATOS_INVALIDOS', `El campo ${ruta} no se puede corregir por propuesta.`)
    if (grupo === 'etiqueta' && !post.etiquetas.some((e) => e.id === etiquetaId)) err('NO_EXISTE', 'La etiqueta indicada no existe en la postulación.')
    let v = valor
    if (['sulfitos', 'botellasAnio', 'hectareas'].includes(campo)) {
      v = Number(valor)
      if (!Number.isFinite(v) || v < 0) err('DATOS_INVALIDOS', `${CAMPOS_CORREGIBLES[`${grupo}.${campo}`]} tiene que ser un número.`)
    } else v = String(valor ?? '').trim()
    if (campo === 'cosecha' && v && !/^(19|20)\d\d$/.test(v)) err('DATOS_INVALIDOS', 'La cosecha tiene que ser un año.')
    if (String(valorCampo(post, ruta) ?? '') === String(v)) continue
    out[ruta] = v
  }
  if (!Object.keys(out).length) err('SIN_CAMBIOS', 'Los valores propuestos son iguales a los actuales.')
  return out
}

function recursosAfectados(post, cambios) {
  const r = []
  if (post.mesa != null) r.push(`Mesa ${post.mesa}`)
  if (post.estado === E.LISTA_ESPERA) r.push('Lugar en lista de espera')
  if (Object.keys(cambios).some((k) => k.startsWith('etiqueta.sulfitos') || k === 'ficha.botellasAnio')) r.push('Requisitos automáticos')
  if (Object.keys(cambios).some((k) => k.startsWith('etiqueta.'))) r.push('Etiquetas presentadas')
  return r
}

function aplicarCambios(post, cambios) {
  for (const [ruta, v] of Object.entries(cambios)) {
    const [grupo, campo, etiquetaId] = ruta.split('.')
    if (grupo === 'ficha') post.ficha[campo] = v
    else post.etiquetas.find((e) => e.id === etiquetaId)[campo] = v
  }
}
