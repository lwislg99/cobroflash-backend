# SCRUM-1783

## SCRUM-1783a · Recargo de equivalencia: ¿sigue vigente? ¿dónde lo usa el producto? (medición, solo lectura)

**Puesto:** J5 (jv-j5bn) · **Rama:** `scrum-1783a-recargo-medido` · 21-nov-2026
**Medido contra:** `origin/main` = `fea1c00078654d8d617af055de94f2b627df07ce` · 2026-11-21T03:41:30Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → A10 «Lo que se deduce de NO haber visto algo no vale si algo no se pudo mirar: se queda sin juzgar.» — no se pudo comprobar: mi primer barrido del PDF salió a cero en `src/lib/pdf.ts` con su control («IVA») también a cero, o sea que miraba el fichero equivocado; el PDF de la factura está en `src/modules/invoicing/infra/pdf/pdf.service.ts` (IVA 35 · recargo 0). Ningún guard sabe qué fichero creía mirar una sesión: lo paró el control positivo de al lado

Solo docs. `src/`, `public/` y `prisma/schema.prisma` se LEEN (reglas 38 y 40). Nada se quita aquí: quitar
es el paso 2 y lo decide el fundador. Nada contra staging ni producción. Sin claims (reglas 17 y 26).
Lo que sigue es una medición de una sesión, **no** una respuesta de asesor (SCRUM-1106).

### ① La norma (LIVA, `BOE-A-1992-28740`, API consolidada; evidencias en `docs/master/evidencias/SCRUM-1783/`)

Bajada el 2026-11-21T03:39:46Z; consolidación al día a `fecha_actualizacion` 20261007. Control de método en el README de evidencias.

| art. | estado hoy (última versión) | lo que dice, en corto (literal en el XML) |
|---|---|---|
| 148 | **vigente** (Ley 55/1999, desde 1-ene-2000) | «se aplicará a los comerciantes minoristas que sean personas físicas o entidades en régimen de atribución de rentas […]» |
| 149 | **vigente** (texto de 1992) | comerciante minorista = entrega con habitualidad «bienes muebles o semovientes sin haberlos sometido a proceso alguno de fabricación, elaboración o manufactura» y >80 % a no empresarios |
| 150-152 | **derogados** (Ley 55/1999) | el OTRO régimen del comercio minorista: determinación proporcional de las bases imponibles |
| 153 | **derogado** (Ley 55/1999) | su título era también «Régimen especial del recargo de equivalencia»; su contenido pasó al 148 |
| 154 | **vigente** (Ley 28/2014) | el minorista no liquida; lo paga vía el recargo que le repercuten sus proveedores; y «repercutirán a sus clientes la cuota […] sin que, en ningún caso, puedan incrementar dicho porcentaje en el importe del recargo» |
| 155 | vigente | inicio y cese en el régimen |
| 156 | **vigente** | se exige en «las entregas de bienes muebles o semovientes que los empresarios efectúen a comerciantes minoristas que no sean sociedades mercantiles» (+ adquisiciones intracomunitarias, importaciones e inversión) |
| 157 | **vigente** | no se aplica, entre otros, a «las entregas […] de bienes de cualquier naturaleza que no sean objeto de comercio por el adquirente» (3.º) |
| 158-160, 162-163 | vigentes | lo paga quien entrega; se repercute como el IVA (art. 88); misma base que el IVA; se liquida con el IVA; el minorista acredita ante el proveedor si está o no en el régimen |
| 161 | **vigente** (RDL 20/2012, efectos 1-sep-2012) | 5,2 % general · 1,4 % · 0,50 % · 1,75 % tabaco |

**Qué dice y qué no.** El texto consolidado dice que el régimen **existe**. Lo que sí desapareció, en 2000, es
el otro régimen minorista (arts. 150-152) y la numeración vieja del 153. Quien **repercute** el recargo es el
proveedor que **entrega bienes muebles** a un minorista persona física en el régimen (156, 158-159); el propio
minorista nunca lo cobra a sus clientes (154.Tres). Los artículos leídos hablan de **entregas de bienes
muebles**, y no nombran prestaciones de servicios ni ejecuciones de obra. Si una instalación o reparación de
un oficio con material a un comercio en recargo lleva recargo, estos artículos no lo resuelven solos (157.3.º
excluye lo que el comprador no revende; la calificación de la obra está en arts. 8 y 11, que **no he leído**):
**pregunta para el asesor, no la cierra esta sesión.**

**NO medido:** proyectos de ley en trámite; el Reglamento del IVA (sectores y requisitos a los que remite el 148).

### ② El producto (sobre `fea1c000`; barrido `git grep -i 'recargo|equivalenc|…'` en `src public prisma scripts`, 113 líneas en 24 ficheros; control positivo: el mismo patrón ve `src/modules/fiscal/verifactu/xsd/SuministroInformacion.xsd:301` (`TipoRecargoEquivalencia`))

| sitio | qué hay | ¿llega a una factura? |
|---|---|---|
| Ficha del cliente (pantalla) | `public/dashboard/js/customersView.js:1537` (`Recargo de equivalencia`): selector «No consta / Sí, está en recargo / No está en recargo» | no: solo guarda el dato |
| API y validación | `src/core/validation/schemas.ts:659` (`recargoEquivalencia`) · `src/modules/system/customerAdmin.ts:43` (`recargoEquivalencia`) | no |
| Esquema | `prisma/schema.prisma:362` (`recargoEquivalencia`), en `Customer`, `Boolean?` sin default. **No hay columna de recargo en `Invoice`** | — |
| Cálculo | `src/modules/invoicing/domain/recargoEquivalencia.ts` (SCRUM-294): calcula aparte; **0 importadores en `src/`** (control: el mismo `git grep` ve los 2 importadores de `retencionIrpf`); solo lo nombran 5 tests (lo importa `tests/scrum294-recargo-caja.test.mjs`) | **no: nadie lo llama** |
| Emisión / XML | `src/modules/fiscal/verifactu/registro.builder.ts`: recargo 0 · IVA/cuota 69 | no |
| PDF | `src/modules/invoicing/infra/pdf/pdf.service.ts`: recargo 0 · IVA 35 | no |
| Libros | `librosAeat.ts` 0/22 · `librosAeatCsv.ts` 0/3 · `libroRegistro.repo.ts` 0/8 (recargo/IVA) | no |
| Modelo 390 | `src/modules/fiscal/modelo390/modelo390.ts:75` (`el recargo no se rellena`) | no: casilla 47 = 34 |
| SCRUM-1054 | `docs/master/SCRUM-1054.md:9`: el recargo se aparcó como SCRUM-1053 (decisión c.21852) | — |

**Regla 29.** Con el código de `fea1c000`, ninguna factura sale con recargo: no hay campo en `Invoice`, ni el
XML, ni el PDF, ni los libros lo escriben, y el cálculo no tiene llamadores. Quitarlo **no toca ninguna factura
emitida**. **NO medido:** ninguna base de datos — cuántos clientes tienen `recargo_equivalencia = true` en
producción, y si alguna versión antigua del código llegó a emitir con recargo (no he recorrido la historia).

Discrepancia de paso, sin tocar: el comentario `prisma/schema.prisma:899` (`recargo_equivalencia`) cuenta
`recargo_equivalencia` entre las columnas añadidas de la tabla de facturas, y el modelo `Invoice` no la tiene.
Es comentario del esquema (regla 40): se reporta, no se arregla.

### ③ Veredicto en una frase

El recargo de equivalencia **sigue vigente** en el texto consolidado de la Ley del IVA (al día a 7-oct-2026);
lo que sí se derogó en 2000 fue otro régimen del comercio minorista. Afecta a quien **vende bienes** a un
comercio minorista acogido, no a los servicios en sí; y en YaQu hoy **solo es un dato en la ficha del
cliente que no llega a ninguna factura**.

### Propuesta para que decida el fundador (no hecha)

1. Quitar el selector de la ficha del cliente (`customersView.js`): pantalla, texto que ve el usuario → su firma (regla 39).
2. Dejar la columna `Customer.recargo_equivalencia` (quitarla es esquema no aditivo: STOP).
3. Retirar `recargoEquivalencia.ts` y sus tests, o dejarlo aparcado como SCRUM-1053: no tiene llamadores, no es emisión hoy, pero vive en `invoicing/domain` → decisión suya.
4. Nada que cambiar en emisión, PDF ni libros: no lo usan.
5. Antes, una pregunta al asesor: ¿algún cliente-tipo de YaQu vende material suelto a comercios en el régimen?
