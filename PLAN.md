# Feria Salvaje · Portal de postulaciones — Plan por fases

Stack: React + Tailwind CSS + localStorage (sin base de datos, sin Supabase). Despliegue: Vercel (importar el repo, preset Vite, build `npm run build`, salida `dist`).
Paleta: #6B1E2E bordó · #F4EDE1 papel · #3F5A3A verde viña · #C98B2B ocre · #2B2520 tinta · #FFFFFF.
Tipografía: Fraunces (títulos) · Work Sans (texto). Idioma: español rioplatense.

Al terminar cada fase se para la ejecución, se despliega en Vercel y se revisa antes de seguir.

## Fase 1 · Base, modelo y motor de reglas
- Proyecto Vite + React + Tailwind, `vercel.json`, fuentes e identidad visual (colores por estado).
- Modelo de dominio: convocatorias (requisitos versionados, cupo), bodegas, postulaciones, propuestas, ajustes, cierres, aperturas, eventos y comandos.
- Tabla de transiciones válidas y motor de comandos puro (fuera de los componentes): permisos por perfil en el motor, idempotencia por id de comando, revisión esperada, mesas y lista de espera, requisitos automáticos.
- Persistencia: instantánea versionada (`schemaVersion: 2`, `revision`, entidades, eventos, comandos) en una clave propia; guardar primero, éxito después; adaptador con fallo simulable.
- Semilla sintética (2 convocatorias, ~50 bodegas, 6 comandos, 3 propuestas, 1 cierre) y migración v1 → v2 con validación completa.
- Pruebas de dominio (Vitest) con reloj fijo: caso de aceptación de mesas, caso «requisito por convocatoria», casos adversos 1–5.
- Pantalla inicial de perfil (Productor, Organización, Revisor, Auditor) con aviso de que no es autenticación, navegación por perfil y pantalla de Diagnóstico que corre las pruebas en el navegador.

## Fase 2 · Flujos originales (Productor y Organización)
- Productor: postulación en 4 pasos (bodega y viñedo · etiquetas · prácticas · revisión y envío), seguimiento con historial, corrección en «Requiere cambios», baja.
- Organización: bandeja con filtros, ficha de revisión con checklist (automático y manual), comentarios obligatorios, pantalla de mesas tipo pizarra con lista de espera, configuración de la convocatoria (cupo, fechas, valor, requisitos).

## Fase 3 · Alcance reforzado
- Requisitos versionados: un cambio obligatorio marca «Para revisar» solo en la convocatoria afectada.
- Control de revisiones: propuestas con comparación de campos, recursos afectados y revisión esperada; Revisor decide sin aprobar las propias; ajustes vinculados.
- Cierres idempotentes, panel de conciliación (eventos contra registros), historial de ajustes y exportación CSV. Auditor solo consulta.

## Fase 4 · Fallo, recuperación y entrega
- Mensajes de conflicto y de fallo de guardado que conservan el borrador; importar y exportar copia con migración; restaurar datos de ejemplo con confirmación.
- Pulido a 360 px y teclado, README completo, URL de previsualización en Vercel.
- Repaso final contra el briefing y los 18 criterios de aceptación.
