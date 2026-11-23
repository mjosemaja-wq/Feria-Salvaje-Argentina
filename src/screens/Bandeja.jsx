import { useState } from 'react'
import { useDominio } from '../store.js'
import { pendientes, posicionEspera, mesas, convocatoria } from '../domain/selectors.js'
import { ESTADOS, PROVINCIAS, E } from '../domain/constants.js'
import { CONV_ACTUAL } from '../domain/seed.js'
import { Seccion, EstadoChip } from '../ui.jsx'

export const CORTO = { uva: 'Uva', levaduras: 'Levaduras', correcciones: 'Sin correcciones', sulfitos: 'Sulfitos', botellas: 'Botellas', etiquetas: 'Etiquetas' }

// Bandeja de la organización: lectura rápida, nombre grande y pendientes a la vista.
export default function Bandeja() {
  const state = useDominio()
  const [convId, setConvId] = useState(CONV_ACTUAL)
  const [estado, setEstado] = useState('activas')
  const [provincia, setProvincia] = useState('')
  const [texto, setTexto] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(false)
  const conv = convocatoria(state, convId)
  const m = mesas(state, convId)

  const filas = state.entities.postulaciones
    .filter((p) => p.convocatoriaId === convId)
    .map((p) => ({ p, pend: pendientes(p, conv) }))
    .filter(({ p, pend }) => {
      if (estado === 'activas' && ![E.ENVIADA, E.EN_REVISION, E.REQUIERE_CAMBIOS].includes(p.estado) && !p.paraRevisar) return false
      if (estado === 'para_revisar' && !p.paraRevisar) return false
      if (!['activas', 'todas', 'para_revisar'].includes(estado) && p.estado !== estado) return false
      if (provincia && p.ficha.provincia !== provincia) return false
      if (texto && !`${p.ficha.nombre} ${p.ficha.localidad}`.toLowerCase().includes(texto.toLowerCase())) return false
      if (soloPendientes && pend.length === 0) return false
      return true
    })
    .sort((a, b) => ESTADOS.findIndex((e) => e.id === a.p.estado) - ESTADOS.findIndex((e) => e.id === b.p.estado) || a.p.ficha.nombre.localeCompare(b.p.ficha.nombre, 'es'))

  const cuenta = (id) => state.entities.postulaciones.filter((p) => p.convocatoriaId === convId && p.estado === id).length

  return (
    <Seccion titulo="Bandeja" bajada={`${conv.nombre}${conv.cerrada ? ' (cerrada)' : ''} · ${m.libres.length === 1 ? 'Queda 1 mesa' : `Quedan ${m.libres.length} mesas`} · ${m.espera.length} en espera`}>
      <div className="etiqueta grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">Edición
          <select className="campo mt-1" value={convId} onChange={(e) => setConvId(e.target.value)}>
            {state.entities.convocatorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">Estado
          <select className="campo mt-1" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="activas">Para atender (enviadas, en revisión, cambios, para revisar)</option>
            <option value="para_revisar">Para revisar por cambio de requisito</option>
            <option value="todas">Todas</option>
            {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label} ({cuenta(e.id)})</option>)}
          </select>
        </label>
        <label className="text-sm">Provincia
          <select className="campo mt-1" value={provincia} onChange={(e) => setProvincia(e.target.value)}>
            <option value="">Todas</option>
            {PROVINCIAS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-sm">Buscar
          <input className="campo mt-1" type="search" placeholder="Bodega o localidad" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input type="checkbox" className="h-5 w-5 accent-bordo" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Solo con requisitos pendientes
        </label>
      </div>

      <p className="text-sm text-tinta-suave" aria-live="polite">{filas.length} postulación(es)</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {filas.map(({ p, pend }) => {
          const pos = posicionEspera(state, p)
          return (
            <li key={p.id}>
              <a href={`#/ficha/${p.id}`} className="etiqueta block p-4 transition hover:-translate-y-0.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-titulo text-2xl font-extrabold leading-tight text-tinta">{p.ficha.nombre}</h2>
                  <EstadoChip estado={p.estado} paraRevisar={p.paraRevisar} />
                </div>
                <p className="text-sm text-tinta-suave">{p.ficha.localidad}, {p.ficha.provincia} · {p.etiquetas.length} etiqueta(s){p.mesa ? ` · mesa ${p.mesa}` : ''}{pos ? ` · espera #${pos}` : ''}</p>
                {pend.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Requisitos pendientes">
                    {pend.map((r) => <li key={r.req.id} className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${r.automatico ? 'border-bordo text-bordo' : 'border-ocre text-tinta'}`}>{r.automatico ? '✗' : '○'} {CORTO[r.req.clave]}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-vina">✓ Cumple todos los requisitos</p>
                )}
              </a>
            </li>
          )
        })}
      </ul>
      {filas.length === 0 && <p className="etiqueta p-4 text-tinta-suave">No hay postulaciones con estos filtros.</p>}
      <p className="text-xs text-tinta-suave">✗ requisito automático no cumplido · ○ requisito manual sin verificar</p>
    </Seccion>
  )
}
