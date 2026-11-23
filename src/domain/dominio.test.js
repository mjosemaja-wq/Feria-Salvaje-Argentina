import { test } from 'vitest'
import { PRUEBAS } from './pruebas.js'

for (const p of PRUEBAS) test(p.nombre, p.fn)
