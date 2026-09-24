# SCRUM-1088 · Cotejo de las 14 marcas ⚠ del apéndice RESPUESTAS contra BOE/fuente oficial

**Fecha:** 23-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** sin gate — cotejo de texto legal, no se aplica nada a `src/`
**Medido contra:** `origin/main` = `79175cfce0ca4f82db873c12cfaacdbb7590151d` · 2026-09-23T00:16:05Z

## Encargo

El apéndice «RESPUESTAS · 22-sep-2026» de `docs/legal/PREGUNTAS_ASESOR.md` llevaba 14 marcas ⚠
(citas que su propio autor, otra sesión de IA, no pudo releer en fuente oficial el 22-sep). El
orquestador pidió cotejar cada una contra el BOE consolidado o la fuente oficial que corresponda, y
dejar para cada una: confirmada (con cita literal + URL), matizada, o no localizada.

## Resultado — las 8 citas / 14 marcas, TODAS cotejadas

| Cita | Veredicto | Fuente |
|---|---|---|
| Art. 84.Uno.2.º.f) LIVA | ✅ CONFIRMADA | Iberley (BOE-A-1992-28740) |
| Art. 91.Uno.2.10.º LIVA | ✅ CONFIRMADA | Iberley (BOE-A-1992-28740) |
| Art. 78.Tres.3.º LIVA | ✅ CONFIRMADA, con matiz | Iberley (BOE-A-1992-28740) |
| Art. 30 CCom | ✅ CONFIRMADA, literal exacto | **BOE consolidado directo** |
| Art. 66 LGT | ✅ CONFIRMADA, literal exacto | Iberley (BOE-A-2003-23186) |
| Art. 32 LOPDGDD | ✅ CONFIRMADA, literal exacto | Iberley (BOE-A-2018-16673) |
| Claves S1/S2/N1/E1 | ✅ CONFIRMADAS, las 4 | XSD oficial de la AEAT, vendorizado en el repo |
| Art. 26 eIDAS (cita) | ✅ CONFIRMADA la cita; la aplicación a YaQu sigue abierta | Iberley + EUR-Lex |

**0 no localizadas. 1 matizada** (art. 78.Tres.3.º LIVA: el texto legal añade dos condiciones —
"mandato expreso" y no deducibilidad del IVA de esos gastos — que la fila original de la tabla no
mencionaba; no cambia la conclusión). Detalle, cita literal completa y URL de cada una, en el sitio
donde ya vivía cada ⚠ en `docs/legal/PREGUNTAS_ASESOR.md` (editado in situ, no en un documento aparte),
más una tabla-resumen nueva al final del apéndice RESPUESTAS.

## Método — declarado, no ocultado

- **Art. 30 CCom**: leído DIRECTAMENTE del BOE consolidado (`boe.es/buscar/act.php?id=BOE-A-1885-6627`).
- **Arts. 66 LGT, 78/84/91 LIVA, 32 LOPDGDD, 26 eIDAS**: el visor del BOE consolidado no devolvió el
  texto completo de estas leyes largas en este cotejo — la respuesta se corta antes de llegar al
  artículo pedido (medido: cortada en el art. 14 de LIVA pidiendo el 84; en el art. 26 de LGT pidiendo
  el 66; en el art. 21 de LGT vía `txt.php`). Se cotejó contra **Iberley**, base de datos jurídica de
  uso profesional habitual en España, que marca sus artículos como «vigente» y transcribe el BOE
  consolidado — y contra **EUR-Lex** para eIDAS (reglamento de la UE, no está en el BOE). Es una
  fuente SECUNDARIA para estas 6 citas, no el BOE en bruto: se declara la diferencia en el propio
  documento en vez de presentarlo como si fuera primario.
- **Claves S1/S2/N1/E1**: fuente PRIMARIA — el XSD oficial que la propia AEAT publica
  (`src/modules/fiscal/verifactu/xsd/SuministroInformacion.xsd`, namespace
  `www2.agenciatributaria.gob.es/.../SuministroInformacion.xsd`), ya vendorizado en este repo y usado
  por `registro.builder.ts` para construir los registros reales.
- **Art. 26 eIDAS**: se separa explícitamente la CITA (qué exige la norma — confirmada) de la
  APLICACIÓN (si la firma con el dedo + DNI de YaQu la satisface — sigue sin contrastar, y no es algo
  que un cotejo de texto legal pueda resolver; queda igual de abierto que antes, solo que ahora con la
  norma exacta delante).

## Qué se tocó

`docs/legal/PREGUNTAS_ASESOR.md`: +54/-15 — cada ⚠ se sustituye in situ por la cita literal, su fuente
y su URL; la cabecera del apéndice y la nota D11 se actualizan para no seguir diciendo "abierto" sobre
lo ya cotejado; se añade una tabla-resumen «Cotejo del 23-sep-2026» al final del apéndice. Nada del
contenido YA VERIFICADO (FAQ AEAT, ROF) se toca.

## Qué NO hice

- No convierto ninguna de estas citas en microcopy ni en guard — eso es de quien construya sobre ellas
  (SCRUM-244 para CCom/LOPDGDD; el builder para S1/S2/N1/E1), y no es este encargo.
- No decido si la firma de YaQu satisface el art. 26 eIDAS — sigo sin poder resolver esa pregunta con
  un cotejo de texto; queda para el asesor legal (D11).
- No toco `src/` ni `public/`.
