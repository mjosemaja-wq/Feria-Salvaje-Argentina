// Pruebas de dominio. Se corren con Vitest (npm test) y también desde la
// pantalla Diagnóstico, en el navegador. Reloj fijo: nada depende de la fecha real.
import { E, ACTORES, actorProductor } from './constants.js'
import { ejecutar } from './engine.js'
import { crearSemilla, CONV_ACTUAL, CONV_ANTERIOR, BODEGA_DEMO } from './seed.js'
import { mesas, posicionEspera, evaluarRequisitos, postulacion, pendientes } from './selectors.js'
import { validarSnapshot, migrarV1aV2, leerCopia } from './migracion.js'
import { crearAdaptador, crearRepositorio, memoriaStorage } from './repositorio.js'
import { conciliar, evidencias } from './conciliacion.js'
import { ratio, formatoPct, clone } from './util.js'

const RELOJ = '2026-11-20T15:00:00.000Z'
const LUCIA = ACTORES.organizacion[0]
const TOMAS = ACTORES.revisor[0]
const INES = ACTORES.revisor[1]
const SOFIA = ACTORES.auditor[0]

function ok(cond, msg) {
  if (!cond) throw new Error(msg)
}
function igual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: esperaba ${JSON.stringify(b)} y obtuve ${JSON.stringify(a)}`)
}

let n = 0
const cid = () => `cmd-test-${++n}`

// Ejecuta y exige éxito.
function correr(s, cmd, now = RELOJ) {
  const r = ejecutar(s, { id: cid(), ...cmd }, { now })
  if (!r.ok) throw new Error(`${cmd.tipo} falló: ${r.error.message}`)
  return r.state
}
const rev = (s, id) => postulacion(s, id).rev
const aprobar = (s, id, actor = LUCIA) => correr(s, { tipo: 'POST_APROBAR', actor, revisionEsperada: rev(s, id), datos: { postulacionId: id } })
const listasParaAprobar = (s) =>
  s.entities.postulaciones.filter((p) => p.convocatoriaId === CONV_ACTUAL && p.estado === E.EN_REVISION && p.id !== 'pos-2027-tranquera' && !pendientes(p, s.entities.convocatorias[0]).length)

export const PRUEBAS = [
  {
    nombre: 'Semilla: 6 comandos (5 aplicados con revisiones 1–5, 1 rechazado sin evento), 3 propuestas, 1 cierre, y válida',
    fn() {
      const s = crearSemilla()
      ok(validarSnapshot(s).ok, `La semilla no valida: ${validarSnapshot(s).errores.join(' | ')}`)
      igual(s.comandos.length, 6, 'comandos')
      const apl = s.comandos.filter((c) => c.resultado === 'aplicado')
      igual(apl.map((c) => c.revision), [1, 2, 3, 4, 5], 'revisiones consecutivas')
      const rech = s.comandos.find((c) => c.resultado === 'rechazado')
      igual(rech.eventos.length, 0, 'el rechazado no tiene eventos')
      ok(!s.eventos.some((e) => e.comandoId === rech.id), 'ningún evento apunta al rechazado')
      igual(s.revision, 5, 'revisión global')
      igual(s.entities.propuestas.map((p) => p.estado).sort(), ['pendiente', 'pendiente', 'rechazada'], 'propuestas')
      igual(s.entities.cierres.length, 1, 'cierres')
      const p1 = s.entities.propuestas.find((p) => p.estado === 'rechazada')
      ok(p1.creador.id !== p1.decisor.id, 'creador y decisor distintos')
      igual(mesas(s, CONV_ACTUAL).asignadas.length, 38, 'mesas ocupadas en la semilla')
      igual(mesas(s, CONV_ACTUAL).espera.length, 3, 'lista de espera en la semilla')
      ok(conciliar(s, CONV_ACTUAL).cuadra && conciliar(s, CONV_ANTERIOR).cuadra, 'la conciliación de la semilla cuadra')
    },
  },
  {
    nombre: 'Caso de aceptación: con 38 ocupadas, tres aprobaciones → mesas 39 y 40, la tercera a espera en posición 4; una baja la corre a la 3',
    fn() {
      let s = crearSemilla()
      const [a, b, c] = listasParaAprobar(s)
      ok(c, 'hacen falta tres postulaciones listas para aprobar')
      s = aprobar(s, a.id)
      s = aprobar(s, b.id)
      s = aprobar(s, c.id)
      igual(postulacion(s, a.id).mesa, 39, 'primera')
      igual(postulacion(s, b.id).mesa, 40, 'segunda')
      igual(postulacion(s, c.id).estado, E.LISTA_ESPERA, 'tercera en espera')
      igual(posicionEspera(s, postulacion(s, c.id)), 4, 'posición de la tercera')
      igual(mesas(s, CONV_ACTUAL).libres.length, 0, 'sin mesas libres')
      const primera = mesas(s, CONV_ACTUAL).espera[0]
      const sale = s.entities.postulaciones.find((p) => p.convocatoriaId === CONV_ACTUAL && p.mesa === 17)
      s = correr(s, { tipo: 'POST_BAJA', actor: LUCIA, revisionEsperada: rev(s, sale.id), datos: { postulacionId: sale.id, motivo: 'La bodega avisó que no llega con el vino.' } })
      igual(postulacion(s, primera.id).estado, E.APROBADA, 'la primera de la lista pasa a Aprobada')
      igual(postulacion(s, primera.id).mesa, 17, 'toma la mesa liberada')
      igual(posicionEspera(s, postulacion(s, c.id)), 3, 'la tercera pasa a la posición 3')
      ok(conciliar(s, CONV_ACTUAL).cuadra, 'la conciliación cuadra después del caso')
    },
  },
  {
    nombre: 'Requisito por convocatoria: una aprobada con el requisito anterior queda «Para revisar»; la otra convocatoria conserva estado y documentos',
    fn() {
      let s = crearSemilla()
      const antesB = clone(s.entities.postulaciones.filter((p) => p.convocatoriaId === CONV_ANTERIOR))
      const conv = s.entities.convocatorias.find((c) => c.id === CONV_ACTUAL)
      const aprobada = s.entities.postulaciones.find((p) => p.convocatoriaId === CONV_ACTUAL && p.mesa === 3)
      s = correr(s, {
        tipo: 'CONV_REQUISITO', actor: LUCIA, revisionEsperada: conv.rev,
        datos: { convocatoriaId: CONV_ACTUAL, requisitoId: `${CONV_ACTUAL}-r-sulfitos`, param: { max: 40 }, texto: 'Sulfitos totales de hasta 40 mg/l por etiqueta', pideRevision: true, motivo: 'Bajamos el tope de sulfitos para esta edición.' },
      })
      const despues = postulacion(s, aprobada.id)
      ok(despues.paraRevisar, 'la aprobada queda Para revisar')
      igual(despues.estado, E.APROBADA, 'no se borra la decisión anterior')
      igual(despues.mesa, 3, 'conserva la mesa')
      igual(s.entities.postulaciones.filter((p) => p.convocatoriaId === CONV_ANTERIOR), antesB, 'la otra convocatoria no cambia')
      igual(s.entities.convocatorias.find((c) => c.id === CONV_ANTERIOR).requisitosVersion, 1, 'versión de requisitos de la otra convocatoria')
    },
  },
  {
    nombre: 'Adverso 1 · mismo id dos veces: un solo efecto y el mismo resultado; mismo id con otros datos se rechaza sin tocar nada',
    fn() {
      const s0 = crearSemilla()
      const [a] = listasParaAprobar(s0)
      const cmd = { id: 'cmd-idem', tipo: 'POST_APROBAR', actor: LUCIA, revisionEsperada: a.rev, datos: { postulacionId: a.id } }
      const r1 = ejecutar(s0, cmd, { now: RELOJ })
      ok(r1.ok, 'primera vez')
      const r2 = ejecutar(r1.state, cmd, { now: RELOJ })
      ok(r2.ok && r2.duplicado, 'la segunda se reconoce como duplicada')
      ok(r2.state === r1.state, 'sin estado nuevo')
      igual(r2.respuesta, r1.respuesta, 'mismo resultado')
      igual(r1.state.eventos.filter((e) => e.comandoId === 'cmd-idem').length, 1, 'un solo evento')
      const r3 = ejecutar(r1.state, { ...cmd, datos: { postulacionId: listasParaAprobar(s0)[1].id } }, { now: RELOJ })
      ok(!r3.ok && r3.error.code === 'ID_REUSADO', 'otros datos con el mismo id')
    },
  },
  {
    nombre: 'Adverso 2 · revisión desactualizada: conflicto explícito, ninguna escritura; con datos actualizados se confirma',
    fn() {
      let s = crearSemilla()
      const [a] = listasParaAprobar(s)
      const vieja = a.rev
      s = correr(s, { tipo: 'POST_COMENTAR', actor: LUCIA, revisionEsperada: vieja, datos: { postulacionId: a.id, comentario: 'Probamos el vino en la visita, todo bien.' } })
      const antes = JSON.stringify(s)
      const r = ejecutar(s, { id: cid(), tipo: 'POST_APROBAR', actor: LUCIA, revisionEsperada: vieja, datos: { postulacionId: a.id } }, { now: RELOJ })
      ok(!r.ok && r.error.code === 'REVISION_DESACTUALIZADA', 'conflicto')
      ok(/revisión vigente/.test(r.error.message), 'el mensaje explica la condición')
      igual(JSON.stringify(s), antes, 'estado intacto')
      s = aprobar(s, a.id)
      igual(postulacion(s, a.id).estado, E.APROBADA, 'con la revisión vigente se aprueba')
    },
  },
  {
    nombre: 'Adverso 3 · fallo del adaptador antes del commit: estado anterior intacto; reintentar con el mismo id guarda una sola operación',
    fn() {
      const storage = memoriaStorage()
      const ad = crearAdaptador(storage, 'test')
      const repo = crearRepositorio(ad, { reloj: () => RELOJ })
      repo.iniciar()
      const antes = storage.getItem('test')
      const [a] = listasParaAprobar(repo.state)
      const cmd = { id: 'cmd-retry', tipo: 'POST_APROBAR', actor: LUCIA, revisionEsperada: a.rev, datos: { postulacionId: a.id } }
      ad.simularFallo(1)
      const r1 = repo.despachar(cmd)
      ok(!r1.ok && r1.error.code === 'GUARDADO', 'falla el guardado')
      igual(postulacion(repo.state, a.id).estado, E.EN_REVISION, 'estado en memoria intacto')
      igual(storage.getItem('test'), antes, 'almacén intacto')
      const r2 = repo.despachar(cmd)
      ok(r2.ok, 'reintento')
      const r3 = repo.despachar(cmd)
      ok(r3.duplicado, 'un tercer envío es duplicado')
      igual(repo.state.comandos.filter((c) => c.id === 'cmd-retry').length, 1, 'una sola operación guardada')
      igual(JSON.parse(storage.getItem('test')).comandos.filter((c) => c.id === 'cmd-retry').length, 1, 'una sola en el almacén')
    },
  },
  {
    nombre: 'Adverso 4 · migración v1 → v2 conserva ids y cantidades; copia con referencia inexistente o truncada deja el estado previo',
    fn() {
      const s = crearSemilla()
      const v1 = { schemaVersion: 1, entities: clone(s.entities) }
      const m = migrarV1aV2(v1)
      ok(m.ok, `migra: ${m.errores?.join(' | ')}`)
      igual(m.state.revision, 1, 'revision 1')
      igual(m.state.eventos.length + m.state.comandos.length, 0, 'eventos y comandos vacíos')
      for (const c of Object.keys(s.entities)) igual(m.state.entities[c].map((x) => x.id), s.entities[c].map((x) => x.id), `ids de ${c}`)
      igual(mesas(m.state, CONV_ACTUAL).asignadas.length, 38, 'cantidad de mesas')

      const storage = memoriaStorage()
      const repo = crearRepositorio(crearAdaptador(storage, 'test'), { reloj: () => RELOJ })
      repo.iniciar()
      const antes = storage.getItem('test')
      const roto = clone(v1)
      roto.entities.postulaciones[0].bodegaId = 'bod-que-no-existe'
      ok(!repo.importar(JSON.stringify(roto)).ok, 'referencia inexistente rechazada')
      ok(!repo.importar(JSON.stringify(v1).slice(0, 500)).ok, 'copia truncada rechazada')
      const dup = clone(v1)
      dup.entities.bodegas.push(clone(dup.entities.bodegas[0]))
      ok(!repo.importar(JSON.stringify(dup)).ok, 'ids duplicados rechazados')
      ok(!leerCopia(JSON.stringify({ schemaVersion: 9 })).ok, 'formato desconocido rechazado')
      igual(storage.getItem('test'), antes, 'el almacén no cambió')
      ok(repo.importar(JSON.stringify(v1)).ok, 'la v1 válida se importa')
    },
  },
  {
    nombre: 'Adverso 5 · reloj fijo: el día de cierre cuenta (inclusivo) y el siguiente ya no; sin denominador → «Sin datos»',
    fn() {
      let s = crearSemilla()
      const bod = s.entities.bodegas.find((b) => b.id === BODEGA_DEMO)
      const prod = actorProductor(bod)
      const borrador = s.entities.postulaciones.find((p) => p.convocatoriaId === CONV_ACTUAL && p.estado === E.BORRADOR)
      const duenio = actorProductor(s.entities.bodegas.find((b) => b.id === borrador.bodegaId))
      s = correr(s, {
        tipo: 'POST_GUARDAR', actor: duenio, revisionEsperada: borrador.rev,
        datos: {
          postulacionId: borrador.id,
          ficha: { hectareas: 3, uva: 'propia', botellasAnio: 8000, contacto: { nombre: 'Rocío Ejemplo', email: 'rocio@chacra.ejemplo' } },
          etiquetas: [{ id: 'e1', nombre: 'Barda', cepa: 'Pinot Noir', cosecha: '2025', sulfitos: 20 }],
          declaraciones: { uva: true, levaduras: true, correcciones: true, veracidad: true },
        },
      })
      const enviar = (now) => ejecutar(s, { id: cid(), tipo: 'POST_ENVIAR', actor: duenio, revisionEsperada: rev(s, borrador.id), datos: { postulacionId: borrador.id } }, { now })
      ok(enviar('2027-02-01T02:30:00.000Z').ok, 'el 31/1 a las 23:30 de Argentina todavía entra')
      const tarde = enviar('2027-02-01T03:10:00.000Z')
      ok(!tarde.ok && tarde.error.code === 'FUERA_DE_PLAZO', 'el 1/2 a las 00:10 ya cerró')
      igual(formatoPct(ratio(0, 0)), 'Sin datos', 'sin denominador')
      igual(formatoPct(ratio(1, 4)), '25%', 'con denominador')
      ok(prod.bodegaId === BODEGA_DEMO, 'actor de demo')
    },
  },
  {
    nombre: 'Criterio 1 · no se envía con casillas del paso 3 sin marcar ni con más etiquetas que el máximo',
    fn() {
      let s = crearSemilla()
      const post = postulacion(s, 'pos-2027-tranquera')
      const prod = actorProductor(s.entities.bodegas.find((b) => b.id === BODEGA_DEMO))
      const etiquetas = post.etiquetas.map((e) => (e.cosecha ? e : { ...e, cosecha: '2025' }))
      s = correr(s, { tipo: 'POST_GUARDAR', actor: prod, revisionEsperada: post.rev, datos: { postulacionId: post.id, etiquetas, declaraciones: { levaduras: false } } })
      let r = ejecutar(s, { id: cid(), tipo: 'POST_ENVIAR', actor: prod, revisionEsperada: rev(s, post.id), datos: { postulacionId: post.id } }, { now: RELOJ })
      ok(!r.ok && r.error.code === 'FALTAN_DATOS' && r.error.detalle.errores.some((e) => e.campo === 'declaraciones.levaduras'), 'falta una casilla')
      const siete = Array.from({ length: 7 }, (_, i) => ({ id: `x${i}`, nombre: `Vino ${i}`, cepa: 'Malbec', cosecha: '2024', sulfitos: 20 }))
      s = correr(s, { tipo: 'POST_GUARDAR', actor: prod, revisionEsperada: rev(s, post.id), datos: { postulacionId: post.id, etiquetas: siete, declaraciones: { levaduras: true } } })
      r = ejecutar(s, { id: cid(), tipo: 'POST_ENVIAR', actor: prod, revisionEsperada: rev(s, post.id), datos: { postulacionId: post.id } }, { now: RELOJ })
      ok(!r.ok && r.error.detalle.errores.some((e) => e.campo === 'etiquetas'), 'más etiquetas que el máximo')
    },
  },
  {
    nombre: 'Criterio 2 · un vino por encima del tope de sulfitos queda como requisito no cumplido y no se puede aprobar',
    fn() {
      const s = crearSemilla()
      const p = s.entities.postulaciones.find((x) => x.etiquetas.some((e) => e.sulfitos > 50))
      const conv = s.entities.convocatorias.find((c) => c.id === p.convocatoriaId)
      const sulf = evaluarRequisitos(p, conv).find((r) => r.req.clave === 'sulfitos')
      ok(sulf.cumple === false && /62/.test(sulf.detalle), 'sulfitos no cumplido')
      const r = ejecutar(s, { id: cid(), tipo: 'POST_APROBAR', actor: LUCIA, revisionEsperada: p.rev, datos: { postulacionId: p.id } }, { now: RELOJ })
      ok(!r.ok && r.error.code === 'REQUISITOS_PENDIENTES', 'no se aprueba')
    },
  },
  {
    nombre: 'Criterio 3 · el productor solo edita su postulación y solo en Borrador o «Requiere cambios»',
    fn() {
      const s = crearSemilla()
      const prod = actorProductor(s.entities.bodegas.find((b) => b.id === BODEGA_DEMO))
      const ajena = s.entities.postulaciones.find((p) => p.bodegaId !== BODEGA_DEMO && p.estado === E.ENVIADA)
      let r = ejecutar(s, { id: cid(), tipo: 'POST_GUARDAR', actor: prod, revisionEsperada: ajena.rev, datos: { postulacionId: ajena.id, ficha: { localidad: 'X' } } }, { now: RELOJ })
      ok(!r.ok && r.error.code === 'SIN_PERMISO', 'ajena')
      const duenio = actorProductor(s.entities.bodegas.find((b) => b.id === ajena.bodegaId))
      r = ejecutar(s, { id: cid(), tipo: 'POST_GUARDAR', actor: duenio, revisionEsperada: ajena.rev, datos: { postulacionId: ajena.id, ficha: { localidad: 'X' } } }, { now: RELOJ })
      ok(!r.ok && r.error.code === 'NO_EDITABLE', 'enviada no se edita')
    },
  },
  {
    nombre: 'Criterio 4 · pedir cambios o rechazar exige comentario, y el comentario queda en el detalle del productor',
    fn() {
      let s = crearSemilla()
      const p = postulacion(s, 'pos-2027-tranquera')
      ok(p.comentarios.some((c) => /cosecha del blanco/.test(c.texto)), 'el comentario de la semilla está')
      const otra = listasParaAprobar(s)[0]
      for (const tipo of ['POST_PEDIR_CAMBIOS', 'POST_RECHAZAR']) {
        const r = ejecutar(s, { id: cid(), tipo, actor: LUCIA, revisionEsperada: otra.rev, datos: { postulacionId: otra.id, comentario: '  ' } }, { now: RELOJ })
        ok(!r.ok && r.error.code === 'COMENTARIO_OBLIGATORIO', `${tipo} sin comentario`)
      }
      s = correr(s, { tipo: 'POST_RECHAZAR', actor: LUCIA, revisionEsperada: otra.rev, datos: { postulacionId: otra.id, comentario: 'No presentaste análisis de sulfitos.' } })
      ok(postulacion(s, otra.id).comentarios.some((c) => c.texto === 'No presentaste análisis de sulfitos.'), 'comentario guardado')
    },
  },
  {
    nombre: 'Criterio 9 · el cupo no baja por debajo de las mesas asignadas',
    fn() {
      const s = crearSemilla()
      const conv = s.entities.convocatorias.find((c) => c.id === CONV_ACTUAL)
      const r = ejecutar(s, { id: cid(), tipo: 'CONV_ACTUALIZAR', actor: LUCIA, revisionEsperada: conv.rev, datos: { convocatoriaId: CONV_ACTUAL, cambios: { cupo: 37 } } }, { now: RELOJ })
      ok(!r.ok && r.error.code === 'CUPO_INVALIDO', 'rechazado')
      ok(correr(s, { tipo: 'CONV_ACTUALIZAR', actor: LUCIA, revisionEsperada: conv.rev, datos: { convocatoriaId: CONV_ACTUAL, cambios: { cupo: 45 } } }), 'subirlo sí')
    },
  },
  {
    nombre: 'Criterio 17 · una propuesta no mueve recursos; su creador no la aprueba; Auditor y Organización no deciden, ni llamando al motor',
    fn() {
      let s = crearSemilla()
      const post = s.entities.postulaciones.find((p) => p.convocatoriaId === CONV_ACTUAL && p.mesa === 8)
      const antes = clone(post)
      const mesasAntes = clone(mesas(s, CONV_ACTUAL))
      s = correr(s, { tipo: 'PROP_CREAR', actor: TOMAS, revisionEsperada: post.rev, datos: { propuestaId: 'prop-t1', postulacionId: post.id, cambios: { 'ficha.botellasAnio': 9999 }, motivo: 'Dato de producción corregido.' } })
      igual(postulacion(s, post.id), antes, 'la postulación no cambia')
      igual(mesas(s, CONV_ACTUAL), mesasAntes, 'las mesas no cambian')
      const prop = s.entities.propuestas.find((p) => p.id === 'prop-t1')
      const decidir = (actor, extra = {}) => ejecutar(s, { id: cid(), tipo: 'PROP_DECIDIR', actor, revisionEsperada: prop.rev, datos: { propuestaId: 'prop-t1', decision: 'aprobar', ...extra } }, { now: RELOJ })
      igual(decidir(TOMAS).error?.code, 'AUTOAPROBACION', 'el creador no aprueba')
      igual(decidir(LUCIA).error?.code, 'SIN_PERMISO', 'Organización no decide')
      igual(decidir(SOFIA).error?.code, 'SIN_PERMISO', 'Auditor no decide')
      const aud = ejecutar(s, { id: cid(), tipo: 'POST_COMENTAR', actor: SOFIA, revisionEsperada: post.rev, datos: { postulacionId: post.id, comentario: 'Hola, soy auditoría.' } }, { now: RELOJ })
      igual(aud.error?.code, 'SIN_PERMISO', 'Auditor no escribe')
      const r = decidir(INES)
      ok(r.ok, 'otra revisora aprueba')
      s = r.state
      igual(postulacion(s, post.id).ficha.botellasAnio, 9999, 'se aplicó')
      const aj = s.entities.ajustes.find((a) => a.propuestaId === 'prop-t1')
      ok(aj && aj.creador.id === TOMAS.id && aj.decisor.id === INES.id, 'ajuste vinculado con creador y decisor distintos')
      igual(aj.cambios[0].antes, antes.ficha.botellasAnio, 'el ajuste guarda el valor anterior')
    },
  },
  {
    nombre: 'Control de revisiones · una propuesta desactualizada no se aprueba hasta actualizarla y revisarla de nuevo',
    fn() {
      let s = crearSemilla()
      const prop = s.entities.propuestas.find((p) => p.id === 'prop-seed-1')
      s = correr(s, { tipo: 'POST_COMENTAR', actor: LUCIA, revisionEsperada: rev(s, prop.postulacionId), datos: { postulacionId: prop.postulacionId, comentario: 'Nota interna de la visita.' } })
      const r = ejecutar(s, { id: cid(), tipo: 'PROP_DECIDIR', actor: TOMAS, revisionEsperada: prop.rev, datos: { propuestaId: prop.id, decision: 'aprobar' } }, { now: RELOJ })
      igual(r.error?.code, 'PROPUESTA_DESACTUALIZADA', 'desactualizada')
      s = correr(s, { tipo: 'PROP_ACTUALIZAR', actor: LUCIA, revisionEsperada: prop.rev, datos: { propuestaId: prop.id } })
      const stale = ejecutar(s, { id: cid(), tipo: 'PROP_DECIDIR', actor: TOMAS, revisionEsperada: prop.rev, datos: { propuestaId: prop.id, decision: 'aprobar' } }, { now: RELOJ })
      igual(stale.error?.code, 'REVISION_DESACTUALIZADA', 'hay que volver a mirarla')
      const nueva = s.entities.propuestas.find((p) => p.id === prop.id)
      s = correr(s, { tipo: 'PROP_DECIDIR', actor: TOMAS, revisionEsperada: nueva.rev, datos: { propuestaId: prop.id, decision: 'aprobar' } })
      igual(s.entities.propuestas.find((p) => p.id === prop.id).estado, 'aprobada', 'aprobada tras revisar de nuevo')
    },
  },
  {
    nombre: 'Cierres y bajas repetidos no duplican efectos; la conciliación cuadra',
    fn() {
      let s = crearSemilla()
      const conv = s.entities.convocatorias.find((c) => c.id === CONV_ANTERIOR)
      const r = ejecutar(s, { id: cid(), tipo: 'CIERRE_REGISTRAR', actor: TOMAS, datos: { convocatoriaId: conv.id, cierreId: 'cie-x' } }, { now: RELOJ })
      igual(r.error?.code, 'YA_CERRADA', 'segundo cierre')
      const ap = s.entities.postulaciones.find((p) => p.convocatoriaId === CONV_ACTUAL && p.mesa === 20)
      s = correr(s, { tipo: 'POST_BAJA', actor: LUCIA, revisionEsperada: ap.rev, datos: { postulacionId: ap.id, motivo: 'Se baja por cosecha perdida.' } })
      const r2 = ejecutar(s, { id: cid(), tipo: 'POST_BAJA', actor: LUCIA, revisionEsperada: rev(s, ap.id), datos: { postulacionId: ap.id, motivo: 'Se baja por cosecha perdida.' } }, { now: RELOJ })
      igual(r2.error?.code, 'TRANSICION_INVALIDA', 'segunda baja')
      s = correr(s, { tipo: 'CIERRE_REGISTRAR', actor: TOMAS, datos: { convocatoriaId: CONV_ACTUAL, cierreId: 'cie-2027' } })
      const r3 = ejecutar(s, { id: cid(), tipo: 'CIERRE_REGISTRAR', actor: INES, datos: { convocatoriaId: CONV_ACTUAL, cierreId: 'cie-2027b' } }, { now: RELOJ })
      igual(r3.error?.code, 'YA_CERRADA', 'cierre repetido')
      ok(conciliar(s, CONV_ACTUAL).cuadra, 'cuadra')
      ok(evidencias(s, CONV_ACTUAL).every((e) => e.ok), 'evidencias en verde')
    },
  },
  {
    nombre: 'Escenario de la bodega de Mendoza: corrige la cosecha del blanco, reenvía y sale aprobada con número de mesa',
    fn() {
      let s = crearSemilla()
      const prod = actorProductor(s.entities.bodegas.find((b) => b.id === BODEGA_DEMO))
      const id = 'pos-2027-tranquera'
      igual(postulacion(s, id).estado, E.REQUIERE_CAMBIOS, 'arranca en Requiere cambios')
      const etiquetas = postulacion(s, id).etiquetas.map((e) => (e.nombre === 'Cal y Canto' ? { ...e, cosecha: '2025' } : e))
      s = correr(s, { tipo: 'POST_GUARDAR', actor: prod, revisionEsperada: rev(s, id), datos: { postulacionId: id, etiquetas } })
      s = correr(s, { tipo: 'POST_ENVIAR', actor: prod, revisionEsperada: rev(s, id), datos: { postulacionId: id } })
      s = correr(s, { tipo: 'POST_TOMAR', actor: LUCIA, revisionEsperada: rev(s, id), datos: { postulacionId: id } })
      s = aprobar(s, id)
      igual(postulacion(s, id).estado, E.APROBADA, 'aprobada')
      igual(postulacion(s, id).mesa, 39, 'mesa 39')
      igual(postulacion(s, id).valorMesaCongelado, 180000, 'valor congelado')
      const estados = s.eventos.filter((e) => e.entidadId === id && e.estadoNuevo).map((e) => e.estadoNuevo)
      igual(estados, [E.REQUIERE_CAMBIOS, E.ENVIADA, E.EN_REVISION, E.APROBADA], 'historial')
    },
  },
]

export function correrPruebas() {
  return PRUEBAS.map((p) => {
    const t0 = Date.now()
    try {
      p.fn()
      return { nombre: p.nombre, ok: true, ms: Date.now() - t0 }
    } catch (e) {
      return { nombre: p.nombre, ok: false, error: e.message, ms: Date.now() - t0 }
    }
  })
}
