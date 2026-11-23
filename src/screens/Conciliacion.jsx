import { useState } from 'react'
import { useDominio } from '../store.js'
import { conciliar, evidencias, aCSV } from '../domain/conciliacion.js'
import { pendientes, posicionEspera, postulacion, convocatoria } from '../domain/selectors.js'
import { CONV_ACTUAL } from '../domain/seed.js'
import { formatoInstante, formatoPct, formatoPesos, ratio } from '../domain/util.js'
import { ESTADO_POR_ID, ESTADOS, PROVINCIAS, E } from '../domain/constants.js'
import { etiquetaCampo, valorTexto } from '../operacion.jsx'
import { Seccion, Aviso, EstadoChip, descargar } from '../ui.jsx'

export default function Conciliacion() {
  const state = useDominio()
  const [convId, setConvId] = useState(CONV_ACTUAL)
  const [estado, setEstado] = useState('')
  const [provincia, setProvincia] = useState('')
  const conv = convocatoria(state, convId)
  const c = conciliar(state, convId)
  const ev = evidencias(state, convId)

  // Detalle filtrado: el resumen del filtro y el CSV salen de estas mismas filas.
  const filas = state.entities.postulaciones
    .filter((p) => p.convocatoriaId === convId && (!estado || p.estado === estado) && (!provincia || p.ficha.provincia === provincia))
    .sort((a, b) => a.ficha.nombre.localeCompare(b.ficha.nombre, 'es'))
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e.id, filas.filter((p) => p.estado === e.id).length]))
  const conMesa = filas.filter((p) => p.mesa != null)
  const decididas = porEstado[E.APROBADA] + porEstado[E.LISTA_ESPERA] + porEstado[E.RECHAZADA] + porEstado[E.BAJA]
  const sulfitos = filas.flatMap((p) => p.etiquetas.map((e) => e.sulfitos)).filter((s) => s !== '' && s != null).map(Number)
  const promedioSulfitos = sulfitos.length ? `${(sulfitos.reduce((a, b) => a + b, 0) / sulfitos.length).toFixed(1)} mg/l` : 'Sin datos'
  const ajustes = state.entities.ajustes.filter((a) => a.convocatoriaId === convId)

  function exportar() {
    const csv = aCSV(filas, [
      { label: 'id', valor: (p) => p.id },
      { label: 'bodega', valor: (p) => p.ficha.nombre },
      { label: 'provincia', valor: (p) => p.ficha.provincia },
      { label: 'localidad', valor: (p) => p.ficha.localidad },
      { label: 'estado', valor: (p) => ESTADO_POR_ID[p.estado].label },
      { label: 'para_revisar', valor: (p) => (p.paraRevisar ? 'sí' : 'no') },
      { label: 'mesa', valor: (p) => p.mesa ?? '' },
      { label: 'mesa_acreditada', valor: (p) => (p.mesaEntregada ? 'sí' : 'no') },
      { label: 'posicion_espera', valor: (p) => posicionEspera(state, p) ?? '' },
      { label: 'valor_mesa_congelado', valor: (p) => p.valorMesaCongelado ?? '' },
      { label: 'etiquetas', valor: (p) => p.etiquetas.length },
      { label: 'requisitos_pendientes', valor: (p) => pendientes(p, conv).map((r) => r.req.texto).join(' | ') },
    ])
    descargar(`conciliacion-${convId}${estado ? `-${estado}` : ''}${provincia ? `-${provincia}` : ''}.csv`, `${csv}\nTOTAL,${filas.length} postulaciones,,,,,${conMesa.length} con mesa`)
  }
  function exportarEventos() {
    const evs = state.eventos.filter((e) => e.convocatoriaId === convId)
    descargar(`eventos-${convId}.csv`, aCSV(evs, [
      { label: 'id', valor: (e) => e.id },
      { label: 'comando', valor: (e) => e.comandoId },
      { label: 'revision', valor: (e) => e.revision },
      { label: 'instante', valor: (e) => e.instante },
      { label: 'actor', valor: (e) => e.actor.nombre },
      { label: 'tipo', valor: (e) => e.tipo },
      { label: 'entidad', valor: (e) => `${e.entidad}:${e.entidadId}` },
      { label: 'estado_anterior', valor: (e) => e.estadoAnterior ?? '' },
      { label: 'estado_nuevo', valor: (e) => e.estadoNuevo ?? '' },
      { label: 'efectos', valor: (e) => e.efectos.map((f) => `${f.tipo}${f.mesa ? `:${f.mesa}` : ''}`).join(' | ') },
      { label: 'motivo', valor: (e) => e.motivo ?? '' },
    ]))
  }

  return (
    <Seccion
      titulo="Conciliación"
      bajada="Los totales se reconstruyen desde la instantánea de apertura más los eventos confirmados y se comparan con los registros. Una diferencia se muestra tal cual, sin taparla con cero."
      extra={
        <select className="campo" aria-label="Edición" value={convId} onChange={(e) => setConvId(e.target.value)}>
          {state.entities.convocatorias.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
      }
    >
      {c.cuadra ? <Aviso tono="ok" titulo="Cuadra: eventos y registros dan lo mismo" /> : <Aviso tono="error" titulo="No cuadra: hay diferencias entre eventos y registros">Las filas marcadas muestran cuánto difieren.</Aviso>}
      <p className="text-sm text-tinta-suave">Punto de partida: apertura del {formatoInstante(c.apertura?.instante)} (revisión {c.apertura?.revision ?? '—'}).</p>

      <div className="etiqueta overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-papel-oscuro text-left">
            <tr><th className="p-2">Indicador</th><th className="p-2 text-right">Por eventos</th><th className="p-2 text-right">Por registros</th><th className="p-2 text-right">Diferencia</th></tr>
          </thead>
          <tbody>
            {c.filas.map((f) => (
              <tr key={f.clave} className={`border-t border-papel-oscuro ${f.diferencia ? 'bg-[#FFF1EF]' : ''}`}>
                <td className="p-2">{f.estado && <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: ESTADO_POR_ID[f.estado].color }} />}{f.label}</td>
                <td className="p-2 text-right tabular-nums">{f.eventos}</td>
                <td className="p-2 text-right tabular-nums">{f.registros}</td>
                <td className={`p-2 text-right font-semibold tabular-nums ${f.diferencia ? 'text-[#B3261E]' : 'text-vina'}`}>{f.diferencia > 0 ? `+${f.diferencia}` : f.diferencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="etiqueta space-y-3 p-4">
        <h2 className="text-2xl font-semibold">Detalle con filtros</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Estado
            <select className="campo mt-1" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </label>
          <label className="text-sm">Provincia
            <select className="campo mt-1" value={provincia} onChange={(e) => setProvincia(e.target.value)}>
              <option value="">Todas</option>
              {PROVINCIAS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button className="btn btn-primario" onClick={exportar}>Exportar CSV del filtro</button>
            <button className="btn btn-secundario" onClick={exportarEventos}>CSV de eventos</button>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-tinta-suave">Postulaciones del filtro</dt><dd className="tiza text-2xl">{filas.length}</dd></div>
          <div><dt className="text-tinta-suave">Con mesa asignada</dt><dd className="tiza text-2xl">{conMesa.length}</dd></div>
          <div><dt className="text-tinta-suave">Aprobación (aprobadas + espera / decididas)</dt><dd className="tiza text-2xl">{formatoPct(ratio(porEstado[E.APROBADA] + porEstado[E.LISTA_ESPERA], decididas))}</dd></div>
          <div><dt className="text-tinta-suave">Sulfitos promedio</dt><dd className="tiza text-2xl">{promedioSulfitos}</dd></div>
          <div><dt className="text-tinta-suave">Valor informativo de mesas del filtro</dt><dd className="font-semibold">{conMesa.length ? formatoPesos(conMesa.reduce((s, p) => s + (p.valorMesaCongelado ?? 0), 0)) : 'Sin datos'}</dd></div>
          <div><dt className="text-tinta-suave">Acreditadas / asignadas</dt><dd className="font-semibold">{formatoPct(ratio(conMesa.filter((p) => p.mesaEntregada).length, conMesa.length))}</dd></div>
        </dl>
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="sticky top-0 bg-papel-oscuro text-left"><tr><th className="p-1.5">Bodega</th><th className="p-1.5">Estado</th><th className="p-1.5 text-right">Mesa</th><th className="p-1.5 text-right">Pendientes</th></tr></thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id} className="border-t border-papel-oscuro">
                  <td className="p-1.5"><a className="underline-offset-2 hover:underline" href={`#/ficha/${p.id}`}>{p.ficha.nombre}</a> <span className="text-xs text-tinta-suave">{p.ficha.provincia}</span></td>
                  <td className="p-1.5"><EstadoChip estado={p.estado} paraRevisar={p.paraRevisar} /></td>
                  <td className="p-1.5 text-right tabular-nums">{p.mesa ?? (posicionEspera(state, p) ? `espera #${posicionEspera(state, p)}` : '—')}</td>
                  <td className="p-1.5 text-right tabular-nums">{pendientes(p, conv).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="etiqueta p-4">
        <h2 className="text-2xl font-semibold">Historial de ajustes</h2>
        {ajustes.length === 0 ? <p className="mt-2 text-sm text-tinta-suave">Sin ajustes aplicados en esta edición.</p> : (
          <ul className="mt-2 space-y-2 text-sm">
            {ajustes.map((a) => {
              const p = postulacion(state, a.postulacionId)
              return (
                <li key={a.id} className="border-l-4 border-vina pl-2">
                  <strong>{p.ficha.nombre}</strong> · {formatoInstante(a.instante)}{a.posteriorAlCierre ? ' · posterior al cierre' : ''}
                  <span className="block">{a.cambios.map((x) => `${etiquetaCampo(p, x.ruta)}: ${valorTexto(x.antes)} → ${valorTexto(x.despues)}`).join(' · ')}</span>
                  <span className="block text-xs text-tinta-suave">Propuesta {a.propuestaId} · creó {a.creador.nombre} · decidió {a.decisor.nombre} · «{a.motivo}»</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="etiqueta p-4">
        <h2 className="text-2xl font-semibold">Repetir no duplica</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {ev.map((e) => (
            <li key={e.label} className="flex items-center justify-between gap-3 border-b border-papel-oscuro py-1.5">
              <span>{e.label} <span className="text-tinta-suave">(esperado: {e.esperado})</span></span>
              <span className={`font-semibold ${e.ok ? 'text-vina' : 'text-[#B3261E]'}`}>{e.valor} {e.ok ? '✓' : '✗'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-tinta-suave">Intentos repetidos de baja, acreditación o cierre se rechazan en el motor sin escribir; por eso no aparecen como eventos.</p>
      </div>
    </Seccion>
  )
}
