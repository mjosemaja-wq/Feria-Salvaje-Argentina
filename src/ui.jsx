import { useEffect, useState } from 'react'
import { ESTADO_POR_ID } from './domain/constants.js'

export function EstadoChip({ estado, paraRevisar = false, grande = false }) {
  const e = ESTADO_POR_ID[estado]
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${grande ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'}`}
        style={{ background: e.color, color: e.tinta }}
      >
        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: e.tinta, opacity: 0.7 }} />
        {e.label}
      </span>
      {paraRevisar && (
        <span className={`rounded-full border-2 border-dashed border-ocre bg-white font-semibold text-tinta ${grande ? 'px-3 py-0.5 text-sm' : 'px-2 py-0.5 text-xs'}`}>
          Para revisar
        </span>
      )}
    </span>
  )
}

export function Aviso({ tono = 'info', titulo, children, accion }) {
  const estilos = {
    info: 'border-tinta bg-white',
    ok: 'border-vina bg-[#EEF3EC]',
    alerta: 'border-ocre bg-[#FBF1E0]',
    error: 'border-[#B3261E] bg-[#FFF1EF]',
  }
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} className={`rounded-md border-l-4 px-4 py-3 ${estilos[tono]}`}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children && <div className="text-sm text-tinta-suave">{children}</div>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  )
}

export function Seccion({ titulo, bajada, children, extra }) {
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-bordo sm:text-4xl">{titulo}</h1>
          {bajada && <p className="mt-1 max-w-2xl text-tinta-suave">{bajada}</p>}
        </div>
        {extra}
      </header>
      {children}
    </section>
  )
}

export function Dato({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-tinta-suave">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  )
}

export function Proxima({ fase, children }) {
  return (
    <div className="etiqueta p-5">
      <p className="tiza text-xl text-ocre">Llega en la fase {fase}</p>
      <p className="mt-1 text-tinta-suave">{children}</p>
    </div>
  )
}

export function useHash() {
  const leer = () => window.location.hash.replace(/^#\/?/, '') || ''
  const [h, setH] = useState(leer)
  useEffect(() => {
    const f = () => setH(leer())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return h
}
export const ir = (ruta) => {
  window.location.hash = `/${ruta}`
}

export function descargar(nombre, contenido, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([tipo.startsWith('text/csv') ? '﻿' + contenido : contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
