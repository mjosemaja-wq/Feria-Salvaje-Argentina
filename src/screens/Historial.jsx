// Historial de comandos y eventos: lo que pasó, quién, cuándo y con qué revisión.
import { useState } from 'react'
import { useDominio } from '../store.js'
import { aCSV } from '../domain/conciliacion.js'
import { formatoInstante } from '../domain/util.js'
import { ESTADO_POR_ID } from '../domain/constants.js'
import { Seccion, descargar } from '../ui.jsx'

export default function Historial() {
  const state = useDominio()
  const [vista, setVista] = useState('comandos')
  const [texto, setTexto] = useState('')
  const q = texto.toLowerCase()
  const comandos = [...state.comandos].reverse().filter((c) => !q || `${c.id} ${c.tipo} ${c.actor.nombre} ${c.entidadId}`.toLowerCase().includes(q))
  const eventos = [...state.eventos].reverse().filter((e) => !q || `${e.id} ${e.tipo} ${e.actor.nombre} ${e.entidadId} ${e.comandoId}`.toLowerCase().includes(q))

  function exportar() {
    if (vista === 'comandos') {
      descargar('comandos.csv', aCSV(comandos, [
        { label: 'id', valor: (c) => c.id }, { label: 'tipo', valor: (c) => c.tipo }, { label: 'entidad', valor: (c) => `${c.entidad}:${c.entidadId}` },
        { label: 'actor', valor: (c) => c.actor.nombre }, { label: 'rol', valor: (c) => c.actor.rol }, { label: 'instante', valor: (c) => c.instante },
        { label: 'revision_esperada', valor: (c) => c.revisionEsperada ?? '' }, { label: 'revision', valor: (c) => c.revision ?? '' },
        { label: 'resultado', valor: (c) => c.resultado }, { label: 'eventos', valor: (c) => c.eventos.join(' ') }, { label: 'datos', valor: (c) => JSON.stringify(c.datos) },
      ]))
    } else {
      descargar('eventos.csv', aCSV(eventos, [
        { label: 'id', valor: (e) => e.id }, { label: 'comando', valor: (e) => e.comandoId }, { label: 'revision', valor: (e) => e.revision },
        { label: 'instante', valor: (e) => e.instante }, { label: 'actor', valor: (e) => e.actor.nombre }, { label: 'tipo', valor: (e) => e.tipo },
        { label: 'entidad', valor: (e) => `${e.entidad}:${e.entidadId}` }, { label: 'estado_anterior', valor: (e) => e.estadoAnterior ?? '' },
        { label: 'estado_nuevo', valor: (e) => e.estadoNuevo ?? '' }, { label: 'efectos', valor: (e) => JSON.stringify(e.efectos) }, { label: 'motivo', valor: (e) => e.motivo ?? '' },
      ]))
    }
  }

  const etiquetaEstado = (s) => ESTADO_POR_ID[s]?.label ?? s ?? '—'

  return (
    <Seccion titulo="Historial" bajada={`Revisión vigente ${state.revision}. ${state.comandos.length} comandos y ${state.eventos.length} eventos guardados en este navegador.`}>
      <div className="flex flex-wrap items-end gap-2">
        <div role="group" aria-label="Vista" className="flex gap-2">
          <button className={`btn ${vista === 'comandos' ? 'btn-primario' : 'btn-secundario'}`} aria-pressed={vista === 'comandos'} onClick={() => setVista('comandos')}>Comandos</button>
          <button className={`btn ${vista === 'eventos' ? 'btn-primario' : 'btn-secundario'}`} aria-pressed={vista === 'eventos'} onClick={() => setVista('eventos')}>Eventos</button>
        </div>
        <label className="min-w-48 flex-1 text-sm">Buscar
          <input className="campo mt-1" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Tipo, actor, id…" />
        </label>
        <button className="btn btn-secundario" onClick={exportar}>Exportar CSV</button>
      </div>
      <ul className="space-y-2">
        {vista === 'comandos' && comandos.map((c) => (
          <li key={c.id} className={`etiqueta p-3 text-sm ${c.resultado === 'rechazado' ? 'border-bordo' : ''}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <code className="font-semibold">{c.tipo}</code>
              <span className={c.resultado === 'aplicado' ? 'text-vina' : 'font-semibold text-bordo'}>{c.resultado}{c.revision ? ` · revisión ${c.revision}` : ''}</span>
            </div>
            <p className="text-tinta-suave">{formatoInstante(c.instante)} · {c.actor.nombre} ({c.actor.rol}) · {c.entidad}:{c.entidadId} · revisión esperada {c.revisionEsperada ?? '—'}</p>
            <p className="break-all text-xs text-tinta-suave">id {c.id} · datos {JSON.stringify(c.datos).slice(0, 160)}</p>
            {c.error && <p className="text-xs text-bordo">Rechazo: {c.error.message}</p>}
          </li>
        ))}
        {vista === 'eventos' && eventos.map((e) => (
          <li key={e.id} className="etiqueta p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <code className="font-semibold">{e.tipo}</code>
              <span className="text-tinta-suave">revisión {e.revision}</span>
            </div>
            <p className="text-tinta-suave">{formatoInstante(e.instante)} · {e.actor.nombre} · {e.entidad}:{e.entidadId} · comando {e.comandoId}</p>
            {(e.estadoAnterior || e.estadoNuevo) && <p>{etiquetaEstado(e.estadoAnterior)} → <strong>{etiquetaEstado(e.estadoNuevo)}</strong></p>}
            {e.efectos.length > 0 && <p className="text-xs">Efectos: {e.efectos.map((f) => `${f.tipo}${f.mesa ? ` ${f.mesa}` : ''}`).join(' · ')}</p>}
            {e.motivo && <p className="text-xs italic">«{e.motivo}»</p>}
          </li>
        ))}
      </ul>
    </Seccion>
  )
}
