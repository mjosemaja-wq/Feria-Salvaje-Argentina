# Feria Salvaje · Portal de postulaciones

Portal donde las bodegas chicas se postulan para tener mesa en una feria anual de vinos naturales, y donde la organización revisa cada postulación contra una lista de requisitos, maneja el cupo de mesas y la lista de espera.

Demo de una sola sesión con **datos sintéticos guardados en `localStorage`**. No hay base de datos, ni Supabase, ni servicios externos de cobro, mensajería, mapas o IA. Los perfiles se eligen en la pantalla inicial y **no son autenticación**.

Estado actual: **Fase 1 de 4** (ver [PLAN.md](PLAN.md)).

## Stack

React 19 · Tailwind CSS 4 · Vite · localStorage · Vitest para las pruebas de dominio.

## Correrlo

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pruebas de dominio con reloj fijo
npm run build    # salida en dist/
```

## Desplegar en Vercel

Importar el repositorio en Vercel. `vercel.json` ya fija el preset Vite, `npm run build` y la carpeta `dist`. No hace falta configurar variables de entorno.

## Perfiles de demo

| Perfil | Qué hace |
| --- | --- |
| Productor | Elige su bodega. Ve y edita solo su postulación, y solo en Borrador o «Requiere cambios». |
| Organización | Flujo original: revisa, pide cambios, rechaza, aprueba, maneja mesas y la convocatoria. Propone correcciones. |
| Revisor | Decide propuestas de corrección y cierres. No puede decidir una propuesta que creó. |
| Auditor | Consulta conciliación e historial. No cambia datos. |

Los permisos se aplican en el motor (`src/domain/engine.js`, tabla `PERMISOS`), no solo ocultando botones. Aun así son de demostración: cualquiera con acceso al navegador puede editar `localStorage`.

El perfil elegido se guarda en la clave `feriaSalvaje.portal.perfil`. Para cambiarlo, usá **Cambiar perfil** en el encabezado, o borrá esa clave desde las herramientas del navegador.

## Datos y persistencia

- Clave propia: `feriaSalvaje.portal.estado`. Instantánea versionada con `schemaVersion: 2`, `revision`, `entities`, `eventos` y `comandos`.
- La semilla se carga **solo si no existe la clave**. Si la copia guardada es inválida no se resiembra sola: se muestra el error y se ofrece restaurar con confirmación.
- Cada operación pasa por el motor (valida entradas, referencias, estado previo y revisión esperada), se guarda una vez y recién después se muestra el éxito. Si `setItem` falla, el estado anterior queda intacto y el reintento usa el mismo id de operación.
- Migración v1 → v2: agrega `revision: 1`, eventos y comandos vacíos, conserva ids y cantidades, y valida todo antes de reemplazar. Una copia desconocida, truncada, con ids duplicados o referencias inexistentes se rechaza entera.
- **Diagnóstico** permite exportar e importar copias, simular un fallo de guardado y restaurar los datos de ejemplo (solo toca la clave de esta app).

### Cómo se preparan los datos sintéticos

`src/domain/seed.js` arma un estado previo (revisión 0) y después ejecuta por el motor los comandos de antecedente, con reloj fijo:

- **Edición 2027** (abierta del 1/11/2026 al 31/1/2027, cupo 40, valor informativo $180.000): 51 postulaciones. Quedan 38 mesas ocupadas, 3 bodegas en lista de espera, 3 en revisión listas para aprobar, una con sulfitos de 62 mg/l, la bodega de Lavalle (Mendoza) en «Requiere cambios» porque le falta la cosecha del blanco, además de enviadas, una rechazada y un borrador.
- **Edición 2026** (convocatoria del 1/7 al 31/8/2026, cerrada): 5 aprobadas y 1 rechazada, con su cierre registrado.
- 6 comandos: 5 aplicados con revisiones 1 a 5 (sube el cupo de 36 a 40, dos aprobaciones, un pedido de cambios y una toma para revisión) y 1 rechazado sin evento (intento de bajar el cupo a 30).
- 3 propuestas: una pendiente y otra rechazada en 2027, y una propuesta de ajuste posterior al cierre de 2026, todavía sin aplicar. Creadores y decisores son actores sintéticos distintos.
- Una instantánea de apertura por convocatoria, que es el punto de partida de la conciliación.

Las fechas, cupos, valores y requisitos son de ejemplo. Para cambiar la semilla, editá `seed.js` y usá **Diagnóstico → Restaurar datos de ejemplo**.

## Reglas del dominio

- Estados: Borrador, Enviada, En revisión, Requiere cambios, Aprobada, Lista de espera, Rechazada, más «Dada de baja» para las bodegas que se bajan. La tabla de transiciones válidas está en `src/domain/constants.js` y se ve en Diagnóstico.
- Aprobar asigna la primera mesa libre. Sin mesas libres, la postulación va a la lista de espera en orden de aprobación. Una baja libera la mesa y la primera de la lista pasa a «Aprobada» con esa mesa.
- El cupo se puede subir, nunca bajar por debajo de las mesas asignadas (ni de la mesa de número más alto asignada).
- Requisitos automáticos (sulfitos, cantidad de etiquetas, botellas por año) y manuales (los tilda la organización). Cada requisito tiene versión: un cambio obligatorio marca «Para revisar» a las postulaciones afectadas de esa convocatoria, sin borrar decisiones ni tocar otras ediciones.
- No se guardan contadores: mesas libres, posición en la espera y totales se derivan siempre de los registros.
- El valor de mesa se congela al aprobar. Los cálculos nuevos usan la configuración vigente.

## Pruebas

`npm test` corre `src/domain/pruebas.js` (también desde **Diagnóstico → Correr pruebas**). Cubre el caso de aceptación de mesas, el caso «requisito por convocatoria», los casos adversos 1 a 5 (idempotencia, revisión desactualizada, fallo del adaptador, migración y reloj fijo) y los criterios 1, 2, 3, 4, 9 y 17.
