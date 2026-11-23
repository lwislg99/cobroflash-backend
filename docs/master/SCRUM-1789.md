# SCRUM-1789 · Siete guards de navegador CIEGOS en cada run de CI: causa medida y arreglo en el propio guard

**Medido contra:** `origin/main` = `90e8e3774f86ff6ef393e7f25f0c6bdedb95765e` · 2026-11-23T03:44:00Z

A9: aviso → cicatriz J6 «Lancé cinco guards de navegador encadenados en un bucle sin cronometrar antes uno, y el arnés lo mandó a segundo plano: completar-lleva-al-campo tarda 139 s cuando mide, 0,9 s cuando está ciego» — no se pudo comprobar: ningún hook multiplica pasadas por duración antes de lanzar, y un guard que sale de CIEGO cambia de duración (0,9 s → 139 s)

Carril J6 (sólo `scripts/guard-*.mjs`, que según `node scripts/carriles.mjs de <ruta>` sólo cubre la fila general de `scripts/`: no tienen dueño declarado y nadie los reclama). Nada en `src/` ni en `public/`. Encargo del orquestador J (`cobroflash-backend-2d`), sesión `jv-j6fc`. Ticket abierto por esta sesión (no existía; búsqueda en Jira por «guards de navegador» y «CIEGO» sin duplicado).

## Medición (CI: job 137006356066 del run 44956622872, #3308; en local, antes y después del arreglo)

| guard | qué no encontraba | desde | arreglo (sólo en el guard) | local antes → después |
|---|---|---|---|---|
| `guard:vias-de-cobro` | `renderSettingsView` lanzaba `telefonoConPrefijo is not defined` | `6727eb7e0` (SCRUM-1781b) | banco carga `onboardingView.js` + `prefijosPais.js` en el orden de `index.html` | CIEGO 8 → verde, 0 hallazgos · 0 ciegos |
| `guard:falta-en-otra-pestana` | lo mismo | `6727eb7e0` | lo mismo | CIEGO 12 → mide 12 casos: 1 hallazgo en 1 de 2 pasadas (ver abajo) |
| `guard:completar-lleva-al-campo` | lo mismo («no se pudo censar la pantalla») | `6727eb7e0` | lo mismo | CIEGO → verde: 36 de 36, su mutación interna hace caer 32 de 36 |
| `guard:aviso-bizum` | lo mismo | `6727eb7e0` | lo mismo | CIEGO 4 → verde, 4 casos |
| `guard:modo-en-ajustes` | lo mismo | `6727eb7e0` | lo mismo | CIEGO 4 → verde, 4 casos |
| `guard:marcadores-en-pantalla` | `operarios` × 3 estados: `ReferenceError: telefonoConPrefijo` (`settingsView.js:355`) | `6727eb7e0` | deja de excluir `onboardingView.js` (97 → 98 scripts); el asistente se apaga por el dato (`onboardingCompleted: true` en la respuesta falsa), como en `app.js` | CIEGO 3 → verde: 93 casos, control negativo detectado |
| `guard:objetivo-tactil` | «Marcar como PAGADA» y «📲 Confirmar Bizum recibido» en caja 0×0: la ficha del Trabajo va por pestañas y la factura cae en un panel `hidden` | `3a8f4cb22` (SCRUM-1768) | `preparar: abrirTodasLasPestanas` (quita `hidden` a cada `role="tabpanel"`, por rol y no por clase, igual que `abrirTodosLosPasos`) | 8 ciegos → 4: la ficha mide 22 objetivos (antes 11), 0 cortos; los 4 que quedan son «FUENTE ROTA en /» (3 de 41 caras), sólo en local: estaban ya en mi pasada de antes y no salen en CI |

La causa común de seis: desde SCRUM-1781b, `settingsView.js` llama a `telefonoConPrefijo`, una constante de nivel superior de `onboardingView.js`, y a `window.prefijosPais` (de `prefijosPais.js`). En el panel funciona porque `index.html` carga los dos antes (líneas 272 y 275, frente a 362-364). Los bancos de los guards llevan su propia lista y no los cargaban.

No se ha relajado ningún guard: ninguno ha cambiado su exigencia, sus números ni sus casos. Lo que cambia es lo que se carga o se abre antes de medir, y cada guard sigue saliendo CIEGO si su población se queda vacía.

## Lo que queda (no es de este carril)

- **Hallazgo de pantalla, intermitente (1 de 2 pasadas en local):** `guard:falta-en-otra-pestana`, caso «390px · rojo · NIF vacío, Guardar desde Cobros» → «el aviso queda fuera de la pantalla». Es de la pantalla de Configuración (`public/`): aquí sólo se reporta. Sin medir en CI hasta este PR.
- **`guard:detalle-trabajo-917`** sale ROJO en CI con 42 hallazgos (`0 ciegos`). Es de S4: sólo se reporta.
- **Sin medir:** los siete en el job de CI de este PR. Hasta que corra, el «después» es sólo local. La suite entera tampoco se ha corrido en local antes del empujón (orden del orquestador, por contexto).

## Propuesta (no se construye aquí)

Que `scripts/guards-visuales.mjs` diga ROJO, y no sólo CIEGO, cuando un mismo guard lleva CIEGO N runs seguidos de `main`. Hoy un CIEGO estable tiene el mismo aspecto un día que al tercero, y estos siete llevaban así desde el 20-nov (1768) y el 21-nov (1781b) sin que nadie lo leyera. Necesita memoria entre runs (artefacto o el Issue del vigía de main): es una decisión de diseño de S5/J6, no un parche.
