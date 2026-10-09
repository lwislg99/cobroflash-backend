# SCRUM-1150 · «Crear revisión»: un código por causa, y el diagnóstico al log (la mitad del servidor)

**Medido contra:** `origin/main` = `85d8d01e64196569928b523c9074542d6ffbbd0a` · 2026-10-09T10:09:01Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

El fallo propio de esta entrega: el primer push de este registro salió SIN la línea de arriba, igual que
el de SCRUM-1188c una hora antes. Lo dijo el check obligatorio de aquél (PR #2328) y se corrigió aquí
antes de que el de éste diera veredicto. `guards:entrada` verde no cubre ese guard: hay que correr el
dirigido.

S1, 9-oct-2026. Es la mitad que el orquestador encargó a S1 en el comentario 18740 del ticket: separar
el código `revisiones_ambiguas` y que la ruta deje de mandar el texto de la excepción. La otra mitad (que
la pantalla decida por el código, con sus textos) es de S2 y de S4 y NO va aquí.

## Qué pasaba

`POST /admin/quotes/:id/revisiones` contestaba `409 { error: 'revisiones_ambiguas', message }` a todo lo
que el dominio lanzara como `RevisionesAmbiguas` o `CensoDeRevisionesCiego`, y `message` era el texto de
la excepción («DOS VIGENTES A LA VEZ: …», «CENSO CIEGO · …»). La pantalla pinta `data.message` cuando
llega (`mensajeParaPersona`), así que el profesional leía el diagnóstico de un programador: ocho líneas a
390 px (medido por S4, comentario 18736).

## Las causas: no eran dos, son cuatro sitios que lanzan

Contado por AST sobre `src/` entero (321 ficheros): cuatro `new` de esas dos clases, los cuatro en
`src/modules/quotes/domain/revision.ts`.

| código nuevo | quién lanza | qué ha pasado | ¿lo alcanza esta ruta? | ¿reintentar lo arregla? |
|---|---|---|---|---|
| `revisiones_dos_vigentes` | `vigenteUnicaDe` (`RevisionesAmbiguas`) | dos filas del grupo tienen la misma revisión más alta | sí | no: son los datos |
| `revisiones_sin_leer` | `vigenteUnicaDe` (`CensoDeRevisionesCiego`) | el grupo llega sin ninguna revisión legible | sí, sólo si el presupuesto se borra entre las dos consultas de la ruta | sí: la siguiente vez contesta `quote_not_found` |
| `revision_no_posterior` | `nuevaRevisionDe` (`RevisionesAmbiguas`) | el número calculado para la nueva no supera al de la que se revisa | por construcción no (el número sale del máximo del grupo); si saliera, es un fallo nuestro | no |
| `revisiones_sin_la_propia` | `revisionesDe` (`CensoDeRevisionesCiego`) | el censo de un presupuesto no lo incluye a él | no: sólo lo llama la lectura (`vistaDeRevisiones`, `GET /admin/quotes/:id`), que no pasa por este `catch` | — |

## Qué cambia

- **El dominio dice la causa.** Las dos clases reciben un `motivo` como primer argumento, de un tipo
  cerrado: lanzar sin decir la causa no compila. Los nombres de clase no cambian.
- **La ruta manda el `motivo` como `error`, sin `message`,** y escribe el diagnóstico en el log con el
  comercio y el presupuesto. El estado sigue siendo 409 en los cuatro: no se ha cambiado ninguno.
- **El código `revisiones_ambiguas` deja de existir.** No lo leía nadie: ni `public/` ni `tests/` lo
  nombraban.

## Qué ve el profesional entre este cambio y la otra mitad

Para estos códigos ya no llega `message`, así que la pantalla cae en el texto general firmado en
SCRUM-688: «No se ha podido crear la revisión. Vuelve a intentarlo.». Para `revisiones_dos_vigentes` ese
«vuelve a intentarlo» no es cierto (reintentar no lo arregla); deja de serlo cuando ese código tenga su
frase firmada y la pantalla decida por el código. Es lo que el comentario 18740 mandó hacer, y sustituye a
ocho líneas de diagnóstico.

## Lo que NO cambia, y se dice

- Los motivos de `RevisionNoCreable` (`quote_not_found`, `quote_sin_numero`,
  `descuento_global_con_varios_iva`) siguen viajando con su `message`. Los dos primeros tienen ya su
  literal firmado para la pantalla (comentario 18740) y los pintará ella por el código.
- `docs/microcopy/2026-09-16-SCRUM-688-crear-revision.md` sigue nombrando `revisiones_ambiguas` entre los
  motivos de los que «se enseña el suyo». Ese registro es del puesto que usa el texto (S2): avisado en el
  ticket, no editado aquí.
- **`revisiones_dos_vigentes` tiene HOY dos orígenes en los datos, y la frase que se le escriba tiene que
  ser cierta para los dos.** Uno es una revisión repetida de verdad. El otro es SCRUM-1490: el grupo se
  arma por (comercio, número) SIN el año de la serie, así que desde el 1-ene-2027 el presupuesto 12 de
  2026 y el 12 de 2027 caen en el mismo grupo como dos originales. Ahí no hay «dos versiones»: hay dos
  presupuestos distintos. El dominio no los puede distinguir (ve dos filas con la misma revisión); deja
  de pasar cuando entre SCRUM-1490, que agrupa con el año. Medido en SCRUM-1444, comentario 18485.
- **Cómo se llega a «dos vigentes» no se ha arreglado.** No hay unicidad en el esquema para
  (comercio, número, revisión), así que dos «Crear revisión» a la vez desde dos pestañas podrían crear el
  empate (la pantalla desactiva el botón al pulsar, pero eso sólo cubre una pestaña). Leído, no
  provocado: probarlo pide una base de verdad y concurrencia de verdad, y cerrarlo pide o un cerrojo en
  la ruta o un índice único, que es esquema.

## Pruebas

`tests/scrum1150-un-codigo-por-causa.test.mjs`, 9 casos: la ruta de `dist/` con la base doblada
(`_envio-doblado.mjs`), el dominio, y dos censos de `src/` por AST.

- **Control positivo:** con el código de antes caen 7 de 9. Pasan los dos que tienen que pasar con las
  dos versiones: el suelo (un grupo sano crea la revisión) y el motivo no tocado (`quote_sin_numero`).
- Con el cambio, 9 de 9. Con sus vecinos (`scrum655b`, `scrum655c`, `scrum688`, `scrum887c`, `scrum1215`,
  `scrum988`, `scrum411`, `scrum494`, `scrum1379b`, `scrum1344`, `scrum710b`): 185 pasan, 0 fallan,
  0 saltos, en 12 ficheros.
- ⚠️ El caso de `revision_no_posterior` por la ruta es FABRICADO: una hermana con la revisión ilegible,
  que Postgres no admite (`revision Int` no nulo) y el doble sí.
- **La otra mitad, el censo, existe y recorre `src/` entero:** cada sitio que lanza una de las dos
  clases lleva su código como literal, ninguno lo comparte, y el código viejo no queda como literal en
  ningún fichero. Un quinto sitio lo pone en rojo. No recorre `public/`: allí hoy nadie decide por estos
  códigos.
- 🔴 **Sin `tsc` del proyecto:** había entre 0,5 y 1,5 GB libres. El `dist/` se hizo con
  `ts.transpileModule` (321 de 321 ficheros), que no comprueba tipos. `revision.ts` no importa nada y sí
  pasó un `tsc --noEmit --strict` él solo (salida 0); la ruta no. Los tipos del conjunto los comprueba el
  check obligatorio del PR.

## No visto en yaqu.app, y por qué

Ninguna de las tres causas se puede provocar en producción sin estropear datos (hacen falta dos filas
con la misma revisión) y la herramienta de sesión de la cuenta QA sólo hace `GET`. Lo que se ve en
pantalla lo midió S4 con su sonda (comentario 18736), contestando ella el `POST`.

## SCRUM-1150b · la mitad de la pantalla: «Crear revisión» decide por el código (9-oct, S2)

**Medido contra:** `origin/main` = `44cbb050536158705c423950a76254ad8f1848b4` · 2026-10-09T11:40:48Z

A9: comprobación → `tests/scrum1150b-la-pantalla-decide-por-el-codigo.test.mjs`

El fallo propio de esta entrega: di por bueno que «un `message` humano del servidor se enseña tal cual»
era de otro ticket y no lo miré hasta que mi propio cambio lo contradijo.
`tests/scrum1215-revisiones-error-crear.test.mjs` fijaba para `quote_sin_numero` justo la conducta que
c.18740 firmó cambiar. No se rodea: su tercer caso pasa al único código para el que sigue siendo verdad, con el motivo escrito dentro,
y `quote_sin_numero` queda atado a su literal firmado en el test de arriba.

**Sesión:** S2 (`s2-9oct`, cuarta tanda) · carril: `public/dashboard/js/quoteRevisiones.js` es S2, con
fila propia (`node scripts/carriles.mjs de …`). **Skill UI:** cargada (`yaqu-premium-ui`). Sección
AÑADIDA: lo de S1, arriba, no se toca.

**Qué pasaba.** La pantalla pintaba el `data.message` de cualquier respuesta fallida. S1 quitó el
diagnóstico de los 409 de grupo (arriba), pero la puerta seguía abierta: cualquier `message` nuevo habría
llegado tal cual. Además el aviso no llevaba `role`, y cada fallo colgaba otro párrafo debajo del
anterior (medido: dos fallos, dos avisos).

**Qué cambia, sólo en `quoteRevisiones.js`.**

| código del servidor | lo que se lee | por qué |
|---|---|---|
| `quote_sin_numero` | «No se puede crear una revisión: este presupuesto no tiene número.» | literal firmado, c.18740 |
| `quote_not_found` | «No se puede crear una revisión: este presupuesto ya no existe.» | literal firmado, c.18740 |
| `descuento_global_con_varios_iva` | el `message` del servidor | firmado en SCRUM-887; el único que pasa tal cual |
| `revisiones_dos_vigentes` | el general | 🔴 su frase (c.19098) NO tiene firma; no se pinta hasta que conste |
| `revisiones_sin_leer` · `revision_no_posterior` · `revisiones_sin_la_propia` | el general | c.19085 |
| `invalid_quote_id` · `internal_error` · sin red · cualquier código nuevo | el general | la puerta |

El general es «No se ha podido crear la revisión. Vuelve a intentarlo.» (SCRUM-688). El aviso lleva
`role="alert"`, y el del intento anterior se quita al volver a pulsar: queda uno.

**Desviación declarada, que sigue.** Para `revisiones_dos_vigentes`, «vuelve a intentarlo» no es cierto
(son los datos). Es lo mismo que se lee hoy en producción desde #2330. Deja de serlo cuando se firme su
frase: una fila en `TEXTO_POR_CODIGO`, una en `DECISION` del test y su ficha en `docs/microcopy/`.

**Textos.** Ninguno nuevo sin firma. Ficha:
`docs/microcopy/2026-10-07-SCRUM-1150-crear-revision-por-codigo.md` (firma delegada, comentario 18740). La de SCRUM-688 nombraba `revisiones_ambiguas`, que ya no
existe: lleva una nota fechada debajo; su texto aprobado y su firma no se tocan.

**La otra mitad (pantalla ↔ servidor).** El censo de S1 recorre `src/` y no mira `public/`. El test nuevo
ata los dos árboles por AST: los códigos que la ruta puede contestar (3 `new RevisionNoCreable` de
`quoteAdmin.ts`, los 4 motivos de los dos tipos cerrados de `revision.ts` y los literales de la propia
ruta: 9) son exactamente los decididos en su tabla; y todo código que la pantalla nombra existe en el
servidor, con el literal firmado letra por letra. Un código nuevo en `src/` lo pone en rojo hasta que
alguien decida qué lee el profesional.

### Pruebas de SCRUM-1150b

`tests/scrum1150b-la-pantalla-decide-por-el-codigo.test.mjs`: 16 casos. Catorce por el viaje (ficha en el
banco, clic, `apiRequest` real) y dos de atadura. A cada código se le pone SIEMPRE un `message`: el
firmado donde toca y un diagnóstico de programador en los demás.

- **Control positivo** (`evidencias/SCRUM-1150/salida-1150b-mutantes.txt`; base 16 de 16): con el
  `quoteRevisiones.js` de `main` caen 12 de 16 y deja 2 avisos tras dos fallos; sin `role`, 1; sin quitar
  el aviso anterior, 1; con la puerta abierta, 7; una errata en una clave, 2; una letra de un literal, 3;
  la frase sin firma metida en la tabla, 2; un motivo nuevo en el dominio, 1 (la atadura). Ocho mutantes,
  ocho mueren, cada uno con su `git diff --numstat`.
- **Navegador, sobre yaqu.app** (cuenta QA, presupuesto 206, build `44cbb050`; el `POST` lo contesta la
  sonda, a producción sólo llegan `GET`): 22 filas, 0 rotas, a 390×844 y 1280×800. Con el fichero de la
  rama: los dos literales en 2 líneas (320×40) y 1 línea (938×20), enteros en la ventana; el diagnóstico
  no llega con ningún código; `role=alert` en las 22; dos fallos, un aviso. Con el de producción y el
  mismo `message` puesto: el diagnóstico sale en 9 de 10 códigos (5 líneas, no cabe entero a 390),
  `role=null` en las 22, y dos fallos dejan dos avisos.
- ⚠️ Lo que el «antes» de la sonda NO dice: producción ya no manda ese diagnóstico (#2330). La sonda lo
  pone a propósito para ver si la pantalla lo deja pasar.
- 🔴 **Sin `tsc`** (≈1 GB libre): no se toca `src/`. Los tests que leen `dist/` corrieron con los tres
  `.ts` de `main` transpilados. La suite completa y los tipos, en el obligatorio.

### No visto en yaqu.app

Hasta que la rama entre: `node sondas-s2/revision-error.mjs` sin argumento (copia en
`evidencias/SCRUM-1150/`). Ninguna de las causas se provoca de verdad; lo que se mide es la pantalla de
producción con la respuesta puesta por la sonda.
