import { useDominio, usePerfil, guardarPerfil, useErrorAlmacen, restaurarSemilla, estadoArranque } from './store.js'
import { ROLES, ACTORES } from './domain/constants.js'
import { useHash, ir, Aviso, Seccion, Proxima } from './ui.jsx'
import Inicio from './screens/Inicio.jsx'
import Mesas from './screens/Mesas.jsx'
import Conciliacion from './screens/Conciliacion.jsx'
import MiPostulacion from './screens/MiPostulacion.jsx'
import Diagnostico from './screens/Diagnostico.jsx'

const NAV = {
  productor: [['mi-postulacion', 'Mi postulación'], ['diagnostico', 'Diagnóstico']],
  organizacion: [['mesas', 'Mesas'], ['bandeja', 'Bandeja'], ['convocatoria', 'Convocatoria'], ['conciliacion', 'Conciliación'], ['diagnostico', 'Diagnóstico']],
  revisor: [['propuestas', 'Propuestas'], ['mesas', 'Mesas'], ['conciliacion', 'Conciliación'], ['diagnostico', 'Diagnóstico']],
  auditor: [['conciliacion', 'Conciliación'], ['mesas', 'Mesas'], ['diagnostico', 'Diagnóstico']],
}

const PENDIENTES = {
  bandeja: [2, 'Bandeja con filtros por estado, provincia y requisitos pendientes, y ficha de revisión con checklist.'],
  convocatoria: [2, 'Configuración de la convocatoria: cupo, fechas, valor de mesa y requisitos versionados.'],
  propuestas: [3, 'Comparación de propuestas con campos cambiados, recursos afectados y revisión esperada; decisión y cierres.'],
}

export default function App() {
  const state = useDominio()
  const perfil = usePerfil()
  const ruta = useHash()
  const errorAlmacen = useErrorAlmacen()

  if (!state) return <CopiaInvalida errores={estadoArranque.errores ?? []} />
  const bodegaValida = perfil?.rol !== 'productor' || state.entities.bodegas.some((b) => b.id === perfil.bodegaId)
  if (!perfil || !ROLES[perfil.rol] || !bodegaValida || ruta === '' || ruta === 'inicio') return <Inicio />

  const nav = NAV[perfil.rol]
  const actual = nav.some(([r]) => r === ruta) ? ruta : nav[0][0]
  const nombre = perfil.rol === 'productor'
    ? state.entities.bodegas.find((b) => b.id === perfil.bodegaId)?.nombre
    : ACTORES[perfil.rol]?.find((a) => a.id === perfil.actorId)?.nombre

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-tinta bg-bordo text-papel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <a href="#/inicio" className="font-titulo text-2xl font-extrabold leading-none">Feria Salvaje</a>
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-papel/15 px-3 py-1">{ROLES[perfil.rol].label} · {nombre}</span>
            <button className="rounded-full border border-papel/60 px-3 py-1 hover:bg-papel/10" onClick={() => { guardarPerfil(null); ir('inicio') }}>Cambiar perfil</button>
          </div>
        </div>
        <nav aria-label="Secciones" className="mx-auto max-w-6xl overflow-x-auto px-2">
          <ul className="flex gap-1">
            {nav.map(([r, label]) => (
              <li key={r}>
                <a href={`#/${r}`} aria-current={actual === r ? 'page' : undefined} className={`block whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-semibold ${actual === r ? 'bg-papel text-bordo' : 'text-papel/85 hover:text-white'}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {errorAlmacen && <Aviso tono="error" titulo={errorAlmacen.message} />}
        <Pantalla ruta={actual} perfil={perfil} />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-tinta-suave">
        Demo con datos sintéticos guardados en este navegador. Los perfiles no son autenticación.
      </footer>
    </div>
  )
}

function Pantalla({ ruta, perfil }) {
  if (ruta === 'mi-postulacion') return <MiPostulacion perfil={perfil} />
  if (ruta === 'mesas') return <Mesas />
  if (ruta === 'conciliacion') return <Conciliacion />
  if (ruta === 'diagnostico') return <Diagnostico />
  const [fase, texto] = PENDIENTES[ruta] ?? [2, '']
  return (
    <Seccion titulo={ruta.charAt(0).toUpperCase() + ruta.slice(1)}>
      <Proxima fase={fase}>{texto}</Proxima>
    </Seccion>
  )
}

function CopiaInvalida({ errores }) {
  function restaurar() {
    if (window.confirm('¿Reemplazar la copia guardada por los datos de ejemplo? Solo se toca la clave de esta app.')) restaurarSemilla()
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-12">
      <h1 className="text-4xl font-extrabold text-bordo">No pudimos abrir tus datos</h1>
      <Aviso tono="error" titulo="La copia guardada en este navegador no es válida">
        No la reemplazamos solos para que no se pierda nada. Detalle:
        <ul className="mt-2 list-disc pl-5">{errores.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
      </Aviso>
      <button className="btn btn-primario" onClick={restaurar}>Restaurar datos de ejemplo</button>
    </div>
  )
}
