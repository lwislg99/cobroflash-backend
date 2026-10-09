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
