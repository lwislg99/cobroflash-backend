# SCRUM-1782

## SCRUM-1782b · El rótulo de `tipoDestinatario` pasa a «¿Factura como empresa o autónomo (IVA)?» en las dos fichas (J2)

**Puesto:** J2 (jv-j2dt) · **Rama:** `scrum-1782b-rotulo-factura-como` · 23-nov-2026
**Skill UI:** cargada
**Medido contra:** `origin/main` = `d5bec9526fe9165e38598f6eb054d0717e788740` · 2026-11-23T03:48:04Z (cabecera `Date:` de `gh api -i zen`)
Mutaciones: catálogo → tests/scrum1782b-rotulo-factura-como.test.mjs
A9: aviso → A10 «Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.» — no se pudo comprobar: mi primer «rojo» del test nuevo cayó por `Cannot find module '../dist/…'` (árbol sin `dist/`), no por el rótulo, y salió con la misma cruz; lo cazó leer el mensaje del fallo antes de dar el rojo por bueno. Ningún guard distingue un rojo del entorno de un rojo del defecto en una pasada que corre una sesión.

**Decisión y firma (regla 39):** SCRUM-1782 c.22268 (opción B; el campo se queda; rótulo
`¿Factura como empresa o autónomo (IVA)?` en las dos fichas; las opciones del selector no cambian) y
c.22272 («1-Sí»: el mismo literal en el aviso de la bandeja, `tipoDestinatarioPendiente.js`, carril S2).
Medición de los tres sitios: c.22297 (jv-j2dr). Ningún otro texto cambia.

**Qué cambia (solo carril J2, `node scripts/carriles.mjs de`):**

| sitio | antes | después |
|---|---|---|
| `public/dashboard/js/customersView.js:1511` (modal de la lista) | `tipoLabel.textContent = "Tipo de cliente";` | `tipoLabel.textContent = "¿Factura como empresa o autónomo (IVA)?";` |
| `public/dashboard/js/customerDetailView.js:1498` (ficha 360) | `<label>Tipo de cliente</label>` | `<label>¿Factura como empresa o autónomo (IVA)?</label>` |

El dato (`Customer.tipoDestinatario`), los valores, las opciones y el payload NO cambian.

**Test:** `tests/scrum1782b-rotulo-factura-como.test.mjs` monta las dos fichas en el banco de vistas
(lista → «Nuevo cliente»; ficha 360 → «Editar») y lee el `<label>` del mismo `.field` que el `<select>`.
Control: las tres opciones (`''`/`PARTICULAR`/`EMPRESARIO` → «Sin clasificar»/«Particular»/«Empresa /
profesional») siguen iguales. Suelo: el lector ve un rótulo sembrado. ROJO antes del cambio en los dos
casos (`actual 'Tipo de cliente'`), verde después (3/3). Las tres mutaciones del catálogo, por `aplicarUna`
una por proceso: VIVAS las tres, 0 colaterales; `git diff` igual tras cada pasada.

**Censos de microcopy:** 1157, 1215 y 1415 en verde con el literal nuevo: no pidieron entrada. La firma es
del fundador en Jira (c.22268/c.22272), no delegada.

### 🔴 `scrum615` en ROJO, declarado — y una cosa que el plan del encargo no contaba

`tests/scrum615-pedir-tipo-destinatario.test.mjs` cae en «los cuatro textos del campo son los que YA
existen, letra a letra»: «Tipo de cliente» ya no está en `customersView.js` (2 de 3 sitios cambiados; el
tercero es de S2). **No se ha tocado** (regla 41).

⚠️ **Aunque S2 empuje la línea 58, `scrum615` SIGUE en rojo:** su línea 165 compara con el literal escrito
a mano, `assert.equal(mod.ETIQUETA, 'Tipo de cliente');`. Para que pase, alguien tiene que cambiar esa
constante al literal firmado. Eso es **reanclar un guard** (regla 41): sigue exigiendo los tres sitios
iguales, pero cambia lo que exige. Pide la misma autorización que tuvo scrum294a en SCRUM-1783 c.22267.
c.22272 dice «scrum615 NO se relaja», y no dice si se puede reanclar. **Decide el fundador o el
orquestador; esta rama no lo hace.** El test es de SCRUM-615 y `carriles.mjs` no le da puesto
(NO-PUDE-MIRAR: depende de la etiqueta `area-` de SCRUM-615).

### Para Luis (S2) — el diff literal de `public/dashboard/js/tipoDestinatarioPendiente.js:58`

```diff
-  var ETIQUETA = 'Tipo de cliente';
+  var ETIQUETA = '¿Factura como empresa o autónomo (IVA)?';
```

Literal copiado de SCRUM-1782 c.22268 / c.22272. `OPCIONES` no cambia. Va ENCIMA de esta rama. Y, si se
autoriza el reanclaje, la línea 165 de `tests/scrum615-pedir-tipo-destinatario.test.mjs`:

```diff
-  assert.equal(mod.ETIQUETA, 'Tipo de cliente');
+  assert.equal(mod.ETIQUETA, '¿Factura como empresa o autónomo (IVA)?');
```

**No medido:** en yaqu.app (no ha entrado en main); con base de datos (el caso de `scrum692` gateado por
`QA_DB_TEST` salió SKIP en local).
