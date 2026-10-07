# SCRUM-1487 · La ficha de un presupuesto, ya cargada, lee la palabra del documento del locale

**Medido contra:** `origin/main` = `00ffc1e1b282e63eda67250d3b4096e5c465fb42` · 2026-10-07T06:57:00Z
A9: sin fallo que generalice — el ticket nació declarado «LEÍDO, no ejecutado»; aquí se ejecuta en el banco y, con la palabra forzada por la sonda, en navegador

**Skill UI:** no cargada · no toca marcado, clases, estilos ni tokens: cambia de dónde sale UNA palabra de dos textos que ya existían (la cabecera y el título de la ficha cargada). Un fichero de `public/dashboard/js` (`quotesDetailView.js`).

7-oct-2026 · **S2** (`s2-7octa`) · rama `scrum-1487-la-ficha-lee-la-palabra-del-locale`. Lo abrió S2 el
6-oct por decisión del orquestador (SCRUM-1482 c.18490, punto 1: «ticket aparte, de S2»).

## Qué cambia

| Sitio | Antes | Ahora |
|---|---|---|
| Cabecera de la ficha, cargada (`quotesDetailView.js`) | `Presupuesto #${n}`, a mano | `${appLocale.quote} #${n}` |
| Título de la vista, cargada (`quotesDetailView.js`) | `Presupuesto #${n}`, a mano | `${appLocale.quote} #${n}` |

En España no cambia nada a la vista: la palabra del locale es «Presupuesto».

## Lo que NO cambia, y por qué

- **El título PROVISIONAL de la vista mientras carga** (`app.js`, `case 'quotes-detail'`): sigue
  siendo `'Presupuesto #' + id`, a mano y con el id de la ruta. Es de SCRUM-1482 y lo fija el caso 7
  de `tests/scrum832-atras-vuelve-a-la-lista.test.mjs`, que este puesto no puede sustituir
  (SCRUM-1482 c.18534). En un país de «cotización» el título dirá «Presupuesto #205» mientras carga
  y «Cotización #4» al cargar.
- **La regex `/^Presupuesto #/`** de la ficha: no es texto que se pinte; reconoce ese título
  provisional del router. Va con él.
- **«Presupuesto #-»** (el id de la ruta no es un número) y las **frases enteras** del fichero que
  concuerdan con la palabra («Presupuesto no encontrado.», «Presupuesto enviado por WhatsApp.»,
  «Presupuesto enviado por correo.», «Detalle del presupuesto y decisión del cliente.»): pasar la
  palabra por el locale no basta, porque el participio concuerda con ella; cada frase tendría que
  venir entera del locale y firmarse. Nombradas en el ticket, fuera de él.

## Firma

No lleva texto nuevo: compone una palabra que ya es oficial por país (`src/core/i18n/locales.ts`) con
el número, en un rótulo que ya existía, y nada concuerda con ella. El ticket pedía que quien lo
construyera lo confirmara o pidiera firma: lo confirmo yo (S2) y queda dicho en Jira para que el
orquestador lo pare si no vale.

## Verificado, ejecutando

- `tests/scrum1487-la-ficha-lee-la-palabra-del-locale.test.mjs`, 3 casos, la ficha EJECUTADA en el
  banco con cada locale: **rama 3 de 3**. Con el `quotesDetailView.js` de `origin/main`: cae el caso
  de «Cotización» (y el control que se apoya en él).
- En yaqu.app con la cuenta QA (España) y los ficheros de la rama servidos por la sonda
  (`sondas-s2/id-ficha.mjs <carpeta>`): cargada, «Presupuesto #5» en título y cabecera, igual que hoy.
- **Con la palabra forzada por la sonda** (`PALABRA=Cotización`: la sonda cambia `appLocale.quote`
  en la página; NO es una cuenta de otro país): producción dice «Presupuesto #5» en los dos sitios;
  con la rama, «Cotización #5» en los dos.

## Lo que NO se ha podido mirar

- **En un país de «cotización» no se ha visto en yaqu.app con una cuenta real**: no hay cuenta QA de
  otro país. Lo de arriba es la palabra forzada por la sonda sobre la cuenta de España.
- No sé si hay hoy cuentas de MX, CO, PE o CL en producción.
- Nada desplegado al escribir esto. Móvil y otro navegador.
