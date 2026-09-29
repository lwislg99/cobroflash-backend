# SCRUM-1269 · La retención de IRPF de Configuración no se guardaba nunca

**Medido contra:** `origin/main` = `ae49a457a20950256b4cc80b69aa7aedf40f72be` · 2026-09-29T09:35:24Z

Carril S1 (servidor) · sesión s1-29a · rama `scrum-1269-irpf-put-descarta` · hallazgo de S3.

## El defecto

La pantalla de Configuración manda `retencionIrpfDeclarada` y `retencionIrpfTipo` al guardar
(`settingsView.js`, `const payload`). `merchantProfileUpdateSchema` no los declaraba y `z.object`
DESCARTA en silencio lo que no conoce; `updateMerchantProfile` escribe `...rest` (lo que sobrevive
al esquema) y ninguna otra vía escribe esas columnas. Resultado: el profesional elegía «15 %», veía
«Datos de empresa guardados correctamente.» y al recargar volvía «No consta».

## PASO 0 (medido)

- De las 23 claves del payload, el esquema compilado descartaba **2**: `retencionIrpfDeclarada` y
  `retencionIrpfTipo`. **`criterioCaja` NO estaba afectado**: está en el esquema y llega a la base
  por `...rest` (por eso un grep de escrituras no lo encuentra).
- **De dónde salía el valor «que vuelve»: de ninguna parte.** Tras guardar, la pantalla no se
  repinta con la respuesta; el selector conserva lo elegido. Al recargar, el GET trae la base
  (`false`/`null`) y sale «No consta». La pantalla no inventa el valor: parece guardado hasta recargar.
- Sin ALTER: las columnas existen (`retencionIrpfDeclarada Boolean @default(false)`,
  `retencionIrpfTipo Int?`).

## Por qué no lo cazó SCRUM-1227 (error de S1)

`scrum1227-perfil-ida-y-vuelta` llama a `updateMerchantProfile` directamente y se salta el esquema
del PUT, que es el eslabón donde se perdían. Probó el gesto, no el viaje.

## El arreglo

- `schemas.ts`: los dos campos, con los tres estados. El tipo se valida contra el cubo del dominio
  (`esTipoRetencionValido`); un tipo sin `retencionIrpfDeclarada: true` se rechaza (400) en vez de
  guardarse incoherente.
- `tests/_huerfanos-declarados.mjs`: `esTipoRetencionValido` sale de `PIEZA_INTERNA_EXPORTADA`
  (SCRUM-411): ahora tiene consumidor de fuera. El trinquete baja porque el código mejoró.

## Prueba

`tests/scrum1269-retencion-irpf-se-guarda.test.mjs`: el viaje entra como el PUT de `app.ts`
(esquema → `updateMerchantProfile`) y vuelve por `getMerchantProfile`, exigiendo **el valor
guardado**. Censo: ninguna clave del payload de la pantalla puede caer en el esquema.

- Rojo sin el arreglo: 4/6 (censo, ida y vuelta, tres estados, rechazos).
- Verde con él: 6/6. Vecinos (71 ficheros que nombran el esquema, el dominio de retención o
  `merchantAdmin`, 740 tests: 736 ✔, 4 saltados por `QA_DB_TEST`/`LIBRO_PG_URL`) + censos de
  huérfanos, zona roja y alcanzabilidad (155/155).

## Límite

Verificado en código y por el viaje del servidor. En yaqu.app queda pendiente del modo de escritura
de `sesion-panel.mjs` (encargado a S3) — y hasta que esto entre, SCRUM-1227 no puede darse por
verificado de punta a punta.
