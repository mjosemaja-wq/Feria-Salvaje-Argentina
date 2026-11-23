import { useDominio, usePerfil, guardarPerfil, useErrorAlmacen, restaurarSemilla, estadoArranque } from './store.js'
import { ROLES, ACTORES } from './domain/constants.js'
import { useHash, ir, Aviso } from './ui.jsx'
import Inicio from './screens/Inicio.jsx'
import Mesas from './screens/Mesas.jsx'
import Conciliacion from './screens/Conciliacion.jsx'
import MiPostulacion from './screens/MiPostulacion.jsx'
import Postular from './screens/Postular.jsx'
import Diagnostico from './screens/Diagnostico.jsx'
import Bandeja from './screens/Bandeja.jsx'
import Ficha from './screens/Ficha.jsx'
import Convocatoria from './screens/Convocatoria.jsx'
import Propuestas from './screens/Propuestas.jsx'
import Historial from './screens/Historial.jsx'

const NAV = {
  productor: [['mi-postulacion', 'Mi postulación'], ['diagnostico', 'Diagnóstico']],
  organizacion: [['bandeja', 'Bandeja'], ['mesas', 'Mesas'], ['convocatoria', 'Convocatoria'], ['propuestas', 'Propuestas'], ['conciliacion', 'Conciliación'], ['historial', 'Historial'], ['diagnostico', 'Diagnóstico']],
  revisor: [['propuestas', 'Propuestas y cierres'], ['bandeja', 'Bandeja'], ['mesas', 'Mesas'], ['conciliacion', 'Conciliación'], ['historial', 'Historial'], ['diagnostico', 'Diagnóstico']],
  auditor: [['conciliacion', 'Conciliación'], ['historial', 'Historial'], ['bandeja', 'Bandeja'], ['mesas', 'Mesas'], ['propuestas', 'Propuestas'], ['diagnostico', 'Diagnóstico']],
}
// Subpantallas: a qué pestaña pertenecen y qué perfiles las abren.
const SUB = { ficha: { tab: 'bandeja', roles: ['organizacion', 'revisor', 'auditor'] }, postular: { tab: 'mi-postulacion', roles: ['productor'] } }

export default function App() {
  const state = useDominio()
  const perfil = usePerfil()
  const ruta = useHash()
  const errorAlmacen = useErrorAlmacen()

  if (!state) return <CopiaInvalida errores={estadoArranque.errores ?? []} />
  const bodegaValida = perfil?.rol !== 'productor' || state.entities.bodegas.some((b) => b.id === perfil.bodegaId)
  if (!perfil || !ROLES[perfil.rol] || !bodegaValida || ruta === '' || ruta === 'inicio') return <Inicio />

  const [base, param] = ruta.split('/')
  const nav = NAV[perfil.rol]
  const sub = SUB[base] && SUB[base].roles.includes(perfil.rol) ? SUB[base] : null
  const actual = sub ? base : nav.some(([r]) => r === base) ? base : nav[0][0]
  const pestana = sub ? sub.tab : actual
  const nombre = perfil.rol === 'productor'
    ? state.entities.bodegas.find((b) => b.id === perfil.bodegaId)?.nombre
    : ACTORES[perfil.rol]?.find((a) => a.id === perfil.actorId)?.nombre

  return (
    <div className="min-h-screen">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-white focus:p-2">Saltar al contenido</a>
      <header className="border-b-2 border-tinta bg-bordo text-papel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <a href="#/inicio" className="font-titulo text-2xl font-extrabold leading-none">Feria Salvaje</a>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-papel/15 px-3 py-1">{ROLES[perfil.rol].label} · {nombre}</span>
            <button className="min-h-9 rounded-full border border-papel/60 px-3 py-1 hover:bg-papel/10" onClick={() => { guardarPerfil(null); ir('inicio') }}>Cambiar perfil</button>
          </div>
        </div>
        <nav aria-label="Secciones" className="mx-auto max-w-6xl overflow-x-auto px-2">
          <ul className="flex gap-1">
            {nav.map(([r, label]) => (
              <li key={r}>
                <a href={`#/${r}`} aria-current={pestana === r ? 'page' : undefined} className={`block whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-semibold ${pestana === r ? 'bg-papel text-bordo' : 'text-papel/85 hover:text-white'}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="contenido" className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {errorAlmacen && <Aviso tono="error" titulo={errorAlmacen.message} />}
        <Pantalla ruta={actual} param={param} perfil={perfil} />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-tinta-suave">
        Demo con datos sintéticos guardados en este navegador. Los perfiles no son autenticación y no protegen datos reales.
      </footer>
    </div>
  )
}

function Pantalla({ ruta, param, perfil }) {
  switch (ruta) {
    case 'mi-postulacion': return <MiPostulacion perfil={perfil} />
    case 'postular': return <Postular perfil={perfil} postId={param} />
    case 'bandeja': return <Bandeja />
    case 'ficha': return <Ficha perfil={perfil} postId={param} />
    case 'mesas': return <Mesas perfil={perfil} />
    case 'convocatoria': return <Convocatoria perfil={perfil} />
    case 'propuestas': return <Propuestas perfil={perfil} />
    case 'conciliacion': return <Conciliacion />
    case 'historial': return <Historial />
    default: return <Diagnostico />
  }
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
