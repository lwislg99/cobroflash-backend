// src/modules/jobs/app/routes/partes.routes.ts — SCRUM-652 (T3 fase C) · EL LLAMADOR DEL PARTE.
//
// El dominio (`parteTrabajo.ts`) llevaba desde la fase B construido, probado y SIN CONSUMIDOR:
// declarado en el trinquete de SCRUM-411 esperando este gate. Esto es el gate.
//
// El PARTE es documento NO FISCAL (regla 24), igual que el albarán: ni se sella contra VeriFactu
// ni sustituye a nada. Facturar desde el parte es T8 y está BLOQUEADO — aquí no hay ni un camino
// que lleve a emitir.
//
// Tenancy SIEMPRE `findFirst { id, merchantId }` → 404 (regla 2).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE DECIDE ESTE FICHERO: LOS IMPORTES NO SALEN DE AQUÍ. NUNCA.
//
// En el parte real firmado, la columna IMPORTE está EN BLANCO. El técnico firma en la obra sin
// precios y el jefe los pone en la oficina después. Así que este router **no tiene modo oficina**:
// no hay parámetro que lo desbloquee, no hay rama que los añada, y `serializeParteParaElTecnico`
// se construye con `lineasParaElTecnico`, que devuelve tres campos y ninguno es un precio.
//
// Es el mismo mecanismo que el albarán usa para firmar en el aparato: **que los importes no
// LLEGUEN a la pantalla es lo que hace imposible que se pinten por descuido.** Una pantalla que
// los recibe y decide no enseñarlos está a un `console.log` de enseñarlos. Una pantalla que nunca
// los recibe no puede enseñarlos ni queriendo.
//
// La pantalla de la oficina —la que sí valora— es otra ruta y otro ticket. Cuando llegue, tendrá
// que pedir los precios explícitamente, y eso se verá en su diff.
import { seesAllJobs } from '../../../../core/http/roleCapabilities';
import { requireRole } from '../../../../core/http/authMiddleware';
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import {
  BLOQUES_PARTE,
  TIPOS_PARTE,
  computeParteContentHash,
  lineasParaElTecnico,
  puedeEditarContenido,
  puedeEditarPrecios,
  permisoDeCampos,
  puedeFirmarse,
  puedeFirmarCliente,
  puedeFirmarTecnico,
  firmasCompletas,
  PARTE_CONTENIDO_VERSION_ACTUAL,
  type BloqueParte,
  type EstadoParte,
  type LineaParte,
  type TipoParte,
} from '../../domain/parteTrabajo';
import { siguienteNumeroParte } from '../../domain/parteNumero';
import { AVISOS_DEL_DICTADO, sanearDictadoDelParte } from '../../domain/parteDictado';
import { isAiConfigured, suggestLineasDeParte } from '../../../ai/domain/ai.service';
import { exigirNombreFirmante, resolverCalidadFirmante } from '../../domain/albaranFirmante';

const router = Router();

/** El mismo tope que la firma del albarán. */
const FIRMA_MAX_CHARS = 1_400_000;

type FindParteResult =
  | { ok: true; parte: any }
  | { ok: false; status: number };

async function findParte(req: any): Promise<FindParteResult> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return { ok: false, status: 400 };
  const parte = await prisma.parteTrabajo.findFirst({ where: { id, merchantId: req.merchantId } });
  if (!parte) return { ok: false, status: 404 };
  return { ok: true, parte: { ...parte, clienteNombre: await nombreDelCliente(req.merchantId, parte.customerId) } };
}

/**
 * El nombre del cliente, que va EN EL PAPEL y ENTRA EN EL SELLO.
 *
 * `ParteTrabajo` no declara relación con `Customer` —columna suelta, como todo `merchantId` de
 * este schema—, asi que se resuelve con una consulta aparte, y CON tenancy: un `customerId` de
 * otro merchant no puede acabar impreso en este parte.
 *
 * Devuelve `null` si no hay cliente, y `null` es un valor legitimo: un parte puede abrirse antes
 * de saber a quien se factura. Lo que NO puede es sellar un nombre inventado.
 */
async function nombreDelCliente(merchantId: number, customerId: number | null): Promise<string | null> {
  if (customerId === null || customerId === undefined) return null;
  const c = await prisma.customer.findFirst({
    where: { id: customerId, merchantId },
    select: { name: true },
  });
  return c?.name ?? null;
}

/**
 * 🔴 LO QUE VIAJA AL MÓVIL DEL TÉCNICO. Escrito ENTERO, campo a campo.
 *
 * No es un objeto extendido menos dos claves, y no es estilo: extendiendo la fila, el día que la
 * tabla gane una columna de dinero **saldría por aquí sin que nadie lo decidiera**. Así, lo que
 * sale es exactamente lo que está escrito abajo. Es la misma razón por la que
 * `lineasCanonicasParte` escribe la lista entera en vez de borrarle dos claves.
 */
function serializeParteParaElTecnico(parte: any) {
  return {
    id: parte.id,
    jobId: parte.jobId ?? null,
    customerId: parte.customerId ?? null,
    clienteNombre: parte.clienteNombre ?? null,
    numero: parte.numero,
    fecha: parte.fecha,
    obra: parte.obra ?? null,
    referencia: parte.referencia ?? null,
    entrada: parte.entrada ?? null,
    salida: parte.salida ?? null,
    desplazamientos: parte.desplazamientos ?? null,
    kilometros: parte.kilometros === null || parte.kilometros === undefined
      ? null
      : Number(parte.kilometros),
    tecnicos: Array.isArray(parte.tecnicos) ? parte.tecnicos : [],
    tipo: parte.tipo ?? null,
    // AQUÍ, y no en la vista: `lineasParaElTecnico` devuelve {bloque, unds, descripcion}.
    // `precioUnitario` y `tipoIva` se quedan en la fila y NO cruzan el cable.
    lineas: lineasParaElTecnico(Array.isArray(parte.lineas) ? parte.lineas : []),
    notas: parte.notas ?? null,
    estado: parte.estado,
    firmadoAt: parte.firmadoAt ?? null,
    firmadoPorNombre: parte.firmadoPorNombre ?? null,
    firmadoPorCalidad: parte.firmadoPorCalidad ?? null,
    // SCRUM-653 · el ESTADO de las dos firmas. **Los trazos NO viajan**: la pantalla
    // necesita saber si ya se firmó y quién, no repintar la imagen — y un data-URI por
    // firma engorda cada respuesta del listado con algo que nadie mira.
    firmadoTecnicoAt: parte.firmadoTecnicoAt ?? null,
    firmadoTecnicoNombre: parte.firmadoTecnicoNombre ?? null,
    firmoElCliente: parte.firmadoAt !== null && parte.firmadoAt !== undefined,
    firmoElTecnico: parte.firmadoTecnicoAt !== null && parte.firmadoTecnicoAt !== undefined,
    firmasCompletas: firmasCompletas(parte),
    contenidoHash: parte.contenidoHash ?? null,
    contenidoVersion: parte.contenidoVersion ?? null,
    // Los dos candados VIAJAN RESUELTOS, con su motivo: la pantalla no vuelve a decidir la regla.
    // Dos sitios decidiendo lo mismo acaban discrepando, y el que se equivoca es el de la pantalla.
    puedeEditarContenido: puedeEditarContenido(parte.estado as EstadoParte),
    puedeEditarPrecios: puedeEditarPrecios(parte.estado as EstadoParte),
  };
}

/**
 * LA OTRA VISTA DEL MISMO DOCUMENTO, y por eso es OTRO serializador.
 *
 * 🔴 NO es «el del técnico con dinero», ni un modo suyo: son dos públicos distintos y la
 * separación es lo único que garantiza que un cambio en esta vista no mande importes al móvil.
 * Se escribe campo a campo por el mismo motivo que el otro: extendiendo la fila, la columna de
 * dinero que se añada mañana saldría por aquí sin que nadie lo decidiera.
 *
 * Lo que ESTA añade y la del técnico no: `precioUnitario`, `tipoIva`, el `importe` de cada línea
 * y los totales. Y `sinValorar`, que es lo que el jefe necesita para encontrar su trabajo.
 */
function serializeParteParaLaOficina(parte: any) {
  const lineas: LineaParte[] = Array.isArray(parte.lineas) ? parte.lineas : [];
  const conImporte = lineas.map((l: any) => {
    const precio = l.precioUnitario === null || l.precioUnitario === undefined ? null : Number(l.precioUnitario);
    const unds = l.unds === null || l.unds === undefined ? null : Number(l.unds);
    // El importe es DERIVADO y viaja calculado: si lo calculara la pantalla, habría dos sitios
    // haciendo la misma multiplicación y un día darían distinto.
    const importe = precio === null || unds === null || !Number.isFinite(precio * unds)
      ? null
      : Math.round(precio * unds * 100) / 100;
    return {
      bloque: l.bloque ?? null,
      unds,
      descripcion: l.descripcion ?? null,
      precioUnitario: precio,
      tipoIva: l.tipoIva === null || l.tipoIva === undefined ? null : Number(l.tipoIva),
      importe,
    };
  });
  // 🔴 «SIN VALORAR» ES POR LÍNEA, NO POR PARTE: un parte con tres líneas y dos precios está sin
  // valorar, y si se contara «tiene algún precio» desaparecería de la lista del jefe a medias.
  const sinValorar = conImporte.some((l) => l.precioUnitario === null);
  const base = conImporte.reduce((t, l) => t + (l.importe ?? 0), 0);
  return {
    id: parte.id,
    jobId: parte.jobId ?? null,
    customerId: parte.customerId ?? null,
    clienteNombre: parte.clienteNombre ?? null,
    numero: parte.numero,
    fecha: parte.fecha,
    obra: parte.obra ?? null,
    referencia: parte.referencia ?? null,
    tipo: parte.tipo ?? null,
    tecnicos: Array.isArray(parte.tecnicos) ? parte.tecnicos : [],
    lineas: conImporte,
    notas: parte.notas ?? null,
    estado: parte.estado,
    firmadoAt: parte.firmadoAt ?? null,
    firmadoPorNombre: parte.firmadoPorNombre ?? null,
    sinValorar,
    totalBase: Math.round(base * 100) / 100,
    puedeEditarContenido: puedeEditarContenido(parte.estado as EstadoParte),
    puedeEditarPrecios: puedeEditarPrecios(parte.estado as EstadoParte),
  };
}

/** Las líneas tal y como llegan del técnico: sin ni un precio. */
function validarLineasDelTecnico(
  entrada: any,
): { ok: true; lineas: LineaParte[] } | { ok: false; message: string } {
  if (!Array.isArray(entrada)) return { ok: false, message: 'Las líneas tienen que venir en una lista.' };
  const lineas: LineaParte[] = [];
  for (const l of entrada) {
    const bloque = String(l?.bloque || '');
    if (!(BLOQUES_PARTE as readonly string[]).includes(bloque)) {
      return { ok: false, message: `Bloque desconocido: ${bloque || '(vacío)'}.` };
    }
    const unds = Number(l?.unds);
    if (!Number.isFinite(unds)) return { ok: false, message: 'Las unidades tienen que ser un número.' };
    const descripcion = String(l?.descripcion ?? '').trim();
    if (!descripcion) return { ok: false, message: 'Cada línea necesita una descripción.' };
    // `precioUnitario` y `tipoIva` NO se leen del cuerpo. No es que se ignoren: es que este camino
    // no los acepta. Si el técnico mandara uno, no entra — los pone la oficina, en otra pantalla.
    lineas.push({ bloque: bloque as BloqueParte, unds, descripcion });
  }
  return { ok: true, lineas };
}

/** Los parámetros del sello, sacados de la fila. Un solo sitio los arma. */
function paramsDeSello(parte: any, lineas: LineaParte[]) {
  return {
    numero: parte.numero,
    fecha: parte.fecha,
    cliente: parte.clienteNombre ?? null,
    obra: parte.obra ?? null,
    referencia: parte.referencia ?? null,
    entrada: parte.entrada ?? null,
    salida: parte.salida ?? null,
    desplazamientos: parte.desplazamientos ?? null,
    kilometros:
      parte.kilometros === null || parte.kilometros === undefined ? null : Number(parte.kilometros),
    tecnicos: Array.isArray(parte.tecnicos) ? parte.tecnicos : [],
    tipo: (parte.tipo ?? null) as TipoParte | null,
    lineas,
    notas: parte.notas ?? null,
    firmadoPorNombre: parte.firmadoPorNombre ?? null,
    firmadoPorCalidad: parte.firmadoPorCalidad ?? null,
  };
}

// ── GET /admin/partes — los partes del merchant, los más recientes primero ───────────────
router.get('/', async (req: any, res) => {
  try {
    const partes = await prisma.parteTrabajo.findMany({
      where: { merchantId: req.merchantId },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return res.json({ partes: partes.map(serializeParteParaElTecnico) });
  } catch (err: any) {
    console.error('[GET /admin/partes]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/partes/oficina/pendientes — LO QUE FALTA POR VALORAR ──────────────────────
//
// 🔴 VA ANTES DE `/:id` A PROPÓSITO: Express casa por orden, y declarada después, «oficina»
// entraría como `:id` y esto no existiría nunca.
//
// Es la respuesta a «¿cuáles me faltan?». Sin esta lista la pantalla no sirve: el jefe tendría
// que abrir los partes uno a uno para descubrir cuál está firmado y sin precios.
router.get('/oficina/pendientes', requireRole('admin'), async (req: any, res) => {
  try {
    const partes = await prisma.parteTrabajo.findMany({
      where: { merchantId: req.merchantId, estado: 'firmado' },
      orderBy: [{ firmadoAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    const vistos = partes.map(serializeParteParaLaOficina);
    const pendientes = vistos.filter((p) => p.sinValorar);
    // 🔴 EL SUELO VIAJA CON EL DATO: un `0` no dice si no hay ninguno o si no se supo leer. Con
    // `firmadosLeidos` al lado, «0 de 12» y «0 de 0» dejan de ser el mismo número.
    return res.json({ pendientes, firmadosLeidos: vistos.length });
  } catch (err: any) {
    console.error('[GET /admin/partes/oficina/pendientes]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/partes/:id/oficina — el parte CON dinero ──────────────────────────────────
//
// Puerta aparte y `admin` a propósito: el móvil del técnico no llega aquí ni por equivocación.
// La separación no es del serializador, es de la RUTA — así no depende de un `if` que alguien
// pueda invertir sin darse cuenta.
router.get('/:id/oficina', requireRole('admin'), async (req: any, res) => {
  try {
    const found = await findParte(req);
    if (!found.ok) {
      return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    }
    return res.json(serializeParteParaLaOficina(found.parte));
  } catch (err: any) {
    console.error('[GET /admin/partes/:id/oficina]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /admin/partes — abrir un parte, opcionalmente colgado de un trabajo ─────────────
router.post('/', async (req: any, res) => {
  try {
    const jobId =
      req.body?.jobId === undefined || req.body?.jobId === null ? null : Number(req.body.jobId);
    if (jobId !== null && !Number.isInteger(jobId)) {
      return res.status(400).json({ error: 'invalid_job', message: 'El trabajo no es válido.' });
    }
    let customerId: number | null = null;
    if (jobId !== null) {
      // Tenancy también para el trabajo del que cuelga: un parte no puede nacer colgado de un
      // trabajo de otro merchant.
      const job = await prisma.job.findFirst({ where: { id: jobId, merchantId: req.merchantId } });
      if (!job) return res.status(404).json({ error: 'job_not_found' });
      customerId = job.customerId ?? null;
    }

    const tipo = req.body?.tipo === undefined || req.body?.tipo === null ? null : String(req.body.tipo);
    if (tipo !== null && !(TIPOS_PARTE as readonly string[]).includes(tipo)) {
      return res
        .status(400)
        .json({ error: 'tipo_invalido', message: `Tipo de intervención desconocido: ${tipo}.` });
    }

    const fecha = new Date();
    const creado = await prisma.$transaction(async (tx) => {
      // Ver `parteNumero.ts` para lo que esta reserva SÍ garantiza y lo que NO.
      const yaHay = await tx.parteTrabajo.findMany({
        where: { merchantId: req.merchantId },
        select: { numero: true },
      });
      const numero = siguienteNumeroParte(yaHay.map((p) => p.numero), fecha.getFullYear());
      return tx.parteTrabajo.create({
        data: {
          merchantId: req.merchantId,
          jobId,
          customerId,
          numero,
          fecha,
          tipo,
          lineas: [],
          tecnicos: [],
          estado: 'borrador',
        },
      });
    });
    return res.status(201).json(serializeParteParaElTecnico(creado));
  } catch (err: any) {
    console.error('[POST /admin/partes]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /admin/partes/:id ────────────────────────────────────────────────────────────────
router.get('/:id', async (req: any, res) => {
  try {
    const found = await findParte(req);
    if (!found.ok) {
      return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    }
    return res.json(serializeParteParaElTecnico(found.parte));
  } catch (err: any) {
    console.error('[GET /admin/partes/:id]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── PATCH /admin/partes/:id — el contenido, SOLO mientras sea borrador ───────────────────
router.patch('/:id', async (req: any, res) => {
  try {
    const found = await findParte(req);
    if (!found.ok) {
      return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    }
    const { parte } = found;

    // 🔴 EL PERMISO SE COMPRUEBA POR CAMPO, NO POR PETICIÓN.
    //
    // Antes esto era `puedeEditarContenido` para la petición entera, y por eso un parte FIRMADO
    // devolvía 409 a TODO — incluida una petición que solo tocaba precios. Ése era el agujero:
    // `puedeEditarPrecios` existía y no cerraba ninguna escritura, así que un parte firmado no
    // se podía valorar por ninguna vía, y sin valorar no se cobra.
    //
    // La regla vive en el dominio (`permisoDeCampos`) y aquí solo se aplica. Y si un campo lo
    // impide, **no se aplica NADA**: se rechaza entera, diciendo qué campo la tumbó.
    const pedidos = Object.keys(req.body ?? {});
    const permiso = permisoDeCampos(parte.estado as EstadoParte, pedidos);
    if (!permiso.ok) {
      return res.status(409).json({
        error: 'parte_locked',
        campo: permiso.campo,
        grupo: permiso.grupo,
        message: permiso.motivo,
      });
    }

    const data: any = {};
    for (const campo of ['obra', 'referencia', 'entrada', 'salida', 'notas'] as const) {
      if (req.body?.[campo] !== undefined) {
        const v = req.body[campo] === null ? null : String(req.body[campo]).trim();
        data[campo] = v === '' ? null : v;
      }
    }
    if (req.body?.tipo !== undefined) {
      const tipo = req.body.tipo === null ? null : String(req.body.tipo);
      if (tipo !== null && !(TIPOS_PARTE as readonly string[]).includes(tipo)) {
        return res
          .status(400)
          .json({ error: 'tipo_invalido', message: `Tipo de intervención desconocido: ${tipo}.` });
      }
      data.tipo = tipo;
    }
    if (req.body?.desplazamientos !== undefined) {
      const n = req.body.desplazamientos === null ? null : Number(req.body.desplazamientos);
      if (n !== null && !Number.isInteger(n)) {
        return res
          .status(400)
          .json({ error: 'desplazamientos_invalido', message: 'Los desplazamientos son un número entero.' });
      }
      data.desplazamientos = n;
    }
    if (req.body?.kilometros !== undefined) {
      const n = req.body.kilometros === null ? null : Number(req.body.kilometros);
      if (n !== null && !Number.isFinite(n)) {
        return res.status(400).json({ error: 'kilometros_invalido', message: 'Los kilómetros son un número.' });
      }
      data.kilometros = n;
    }
    if (req.body?.tecnicos !== undefined) {
      if (!Array.isArray(req.body.tecnicos)) {
        return res.status(400).json({ error: 'tecnicos_invalido', message: 'Los técnicos vienen en una lista.' });
      }
      data.tecnicos = req.body.tecnicos.map((t: any) => String(t).trim()).filter(Boolean);
    }
    if (req.body?.lineas !== undefined) {
      const v = validarLineasDelTecnico(req.body.lineas);
      if (!v.ok) return res.status(400).json({ error: 'lineas_invalidas', message: v.message });
      // 🔴 LOS PRECIOS YA PUESTOS NO SE PIERDEN al editar el contenido. El técnico manda
      // {bloque, unds, descripcion}; si esa misma línea ya tenía precio de oficina, se conserva.
      // Sin esto, una corrección del técnico borraría la valoración del jefe EN SILENCIO.
      const previas: LineaParte[] = Array.isArray(parte.lineas) ? (parte.lineas as any) : [];
      data.lineas = v.lineas.map((l, i) => {
        const antes = previas[i];
        const esLaMisma = antes && antes.bloque === l.bloque && antes.descripcion === l.descripcion;
        return esLaMisma
          ? { ...l, precioUnitario: antes.precioUnitario ?? null, tipoIva: antes.tipoIva ?? null }
          : l;
      });
    }

    // ── LOS PRECIOS DE LA OFICINA ────────────────────────────────────────────────────
    //
    // Viajan en su PROPIA clave y por índice de línea: `[{ indice, precioUnitario, tipoIva }]`.
    // No se mezclan con `lineas` a propósito — mezclarlos haría que «esta petición toca precios»
    // fuera una cuestión de mirar dentro de un array, y entonces «mixta» sería opinable.
    if (req.body?.precios !== undefined) {
      if (!Array.isArray(req.body.precios)) {
        return res.status(400).json({ error: 'precios_invalidos', message: 'Los precios vienen en una lista.' });
      }
      const previas: LineaParte[] = Array.isArray(parte.lineas) ? (parte.lineas as any) : [];
      const conPrecio = previas.map((l) => ({ ...l }));
      for (const p of req.body.precios) {
        const i = Number(p?.indice);
        if (!Number.isInteger(i) || i < 0 || i >= conPrecio.length) {
          return res.status(400).json({
            error: 'precio_sin_linea',
            message: `No hay ninguna línea ${String(p?.indice)} que valorar.`,
          });
        }
        if (p?.precioUnitario !== undefined) {
          const n = p.precioUnitario === null ? null : Number(p.precioUnitario);
          if (n !== null && (!Number.isFinite(n) || n < 0)) {
            return res.status(400).json({
              error: 'precio_invalido',
              message: 'Un precio es un número que no puede ser negativo.',
            });
          }
          conPrecio[i].precioUnitario = n;
        }
        if (p?.tipoIva !== undefined) {
          const n = p.tipoIva === null ? null : Number(p.tipoIva);
          if (n !== null && (!Number.isFinite(n) || n < 0 || n > 1)) {
            return res.status(400).json({
              error: 'tipo_iva_invalido',
              message: 'El IVA es una fracción entre 0 y 1.',
            });
          }
          conPrecio[i].tipoIva = n;
        }
      }
      data.lineas = conPrecio;
    }

    if (Object.keys(data).length === 0) return res.json(serializeParteParaElTecnico(parte));

    const updated = await prisma.parteTrabajo.update({ where: { id: parte.id }, data });

    // 🔴 QUIÉN PREGUNTA DECIDE QUÉ SE DEVUELVE, y la condición es el ROL, no lo que venga en el
    // cuerpo. Con `admin` va la vista de oficina —el jefe tiene que VER lo que acaba de escribir,
    // que era justo lo que faltaba—; con cualquier otro rol, la del técnico.
    //
    // Se mira el rol y NO «si la petición traía precios» porque eso lo decide quien llama: un
    // técnico que mandara `precios` en un borrador recibiría importes en el móvil. El rol no lo
    // elige él.
    return res.json(
      seesAllJobs(req.userRole)
        ? serializeParteParaLaOficina(updated)
        : serializeParteParaElTecnico(updated),
    );
  } catch (err: any) {
    console.error('[PATCH /admin/partes/:id]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /admin/partes/:id/firmar ────────────────────────────────────────────────────────
router.post('/:id/firmar', async (req: any, res) => {
  try {
    const found = await findParte(req);
    if (!found.ok) {
      return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    }
    const { parte } = found;

    // 🔴 SCRUM-653 · EL CANDADO PASA A SER POR RANURA, NO POR ESTADO.
    //
    // Antes bastaba `estado !== 'borrador'`, y con UNA firma daba igual. Con DOS no: en cuanto el
    // TÉCNICO firma, el estado ya es `firmado`, y con el candado viejo **el cliente no podría
    // firmar después** — el segundo firmante se quedaría fuera según el orden, que es justo lo que
    // `ordenDeFirmaExigido()` dice que NO se exige.
    //
    // `parte_locked` se conserva como código: la cola de firmas lo trata como ÉXITO al drenar
    // (`elServidorYaLaTiene`), así que un reintento cuya petición anterior sí llegó sale de la cola
    // en vez de dar vueltas para siempre.
    const ranura = puedeFirmarCliente(parte);
    if (!ranura.ok) {
      return res.status(409).json({ error: 'parte_locked', message: ranura.motivo });
    }

    const lineas: LineaParte[] = Array.isArray(parte.lineas) ? (parte.lineas as any) : [];
    const sePuede = puedeFirmarse(lineas);
    if (!sePuede.ok) return res.status(409).json({ error: 'parte_vacio', message: sePuede.motivo });

    const signatureData = String(req.body?.signatureData || '');
    if (!/^data:image\/(png|jpeg);base64,/.test(signatureData)) {
      return res
        .status(400)
        .json({ error: 'firma_invalida', message: 'La firma debe ser una imagen PNG o JPEG (data-URI base64).' });
    }
    if (signatureData.length > FIRMA_MAX_CHARS) {
      return res
        .status(413)
        .json({ error: 'firma_demasiado_grande', message: 'La firma supera el tamaño máximo permitido.' });
    }

    // Quién firma y en calidad de qué, con la MISMA fuente que el albarán (SCRUM-300): las seis
    // opciones ya existen y «portero o conserje» está entre ellas. Se resuelven ANTES de sellar.
    const calidad = resolverCalidadFirmante({
      ranura: req.body?.firmadoPorCalidad,
      textoLibre: req.body?.firmadoPorCalidadOtro,
    });
    if (!calidad.ok) return res.status(400).json({ error: calidad.error, message: calidad.message });
    const nombre = exigirNombreFirmante(req.body?.firmadoPorNombre);
    if (!nombre.ok) return res.status(400).json({ error: nombre.error, message: nombre.message });

    const firmadoAt = new Date();
    // 🔴 SCRUM-653 · EL SELLO YA NO LLEVA AL FIRMANTE (v:2). Con dos firmas, sellar la identidad
    // hacía que la huella dependiera de quién firmara primero — ver `contenidoCanonicoParte`.
    // Se sella el CONTENIDO, y por eso el sello **no se recalcula** cuando firma el segundo.
    //
    // ⚠️ Y sólo se sella si NO había sello: si el técnico firmó antes, la huella ya está puesta y
    // volver a calcularla no puede cambiarla —pero escribirla otra vez haría pensar que sí—.
    const contenidoHash = parte.contenidoHash
      ? parte.contenidoHash
      : computeParteContentHash(paramsDeSello(parte, lineas), PARTE_CONTENIDO_VERSION_ACTUAL);

    const updated = await prisma.parteTrabajo.update({
      where: { id: parte.id },
      data: {
        estado: 'firmado',
        firmadoAt,
        firmadoPorNombre: nombre.nombre,
        firmadoPorCalidad: calidad.valor,
        // 🔴 EL TRAZO SE GUARDA. Hasta SCRUM-653 se validaba y se TIRABA: el parte guardaba que
        // se firmó y quién dijo ser, y no la firma. Defecto de la fase C, arreglado aquí.
        signatureUrl: signatureData,
        contenidoHash,
        contenidoVersion: parte.contenidoVersion ?? PARTE_CONTENIDO_VERSION_ACTUAL,
      },
    });
    return res.json(serializeParteParaElTecnico(updated));
  } catch (err: any) {
    console.error('[POST /admin/partes/:id/firmar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * SCRUM-683 · EL DICTADO SE ORDENA, Y NO ENTRA EN EL PARTE.
 *
 * 🔴 ESTA RUTA NO ESCRIBE NADA. Devuelve una PROPUESTA y se acabó: el técnico la corrige y la
 * confirma con el `PATCH` de siempre, que es el único sitio donde se escriben líneas. Si esta ruta
 * guardara, una cantidad que ha leído una máquina entraría en un documento que se firma y se
 * factura sin que nadie la haya mirado.
 *
 * ⚠️ Y NO ES UN `GET` PORQUE MANDA UN CUERPO, no porque cambie estado: el dictado es un párrafo
 * largo y una URL no es sitio para el texto de una obra.
 *
 * ⛔ NI UN IMPORTE, en ninguna dirección — ver la cabecera del fichero.
 */
router.post('/:id/dictado', async (req: any, res) => {
  try {
    const found = await findParte(req);
    if (!found.ok) {
      return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    }
    const { parte } = found;

    // El mismo candado que el PATCH, y por el mismo motivo: proponerle líneas a un parte FIRMADO
    // es ofrecerle al técnico un camino que el siguiente paso le va a cerrar.
    const candado = puedeEditarContenido(parte.estado as EstadoParte);
    if (!candado.ok) return res.status(409).json({ error: 'parte_locked', message: candado.motivo });

    const dictado = String(req.body?.dictado ?? '').trim();

    // 🔴 SIN RED, SIN CLAVE O CON EL MODELO CAÍDO: NO SE BLOQUEA EL PARTE. Se devuelve la propuesta
    // VACÍA con su motivo y un 200, porque el técnico puede seguir escribiendo a mano — el dictado
    // del teclado de su móvil funciona sin nosotros y ordenar es un extra que puede faltar. Un 500
    // aquí le diría «se ha roto» cuando lo único que pasa es que no hay ayuda.
    if (dictado === '' || !isAiConfigured()) {
      return res.json({ propuesta: sanearDictadoDelParte(null, dictado), avisos: AVISOS_DEL_DICTADO });
    }

    let propuesta;
    try {
      propuesta = await suggestLineasDeParte({ dictado });
    } catch (err: any) {
      console.error('[POST /admin/partes/:id/dictado] ia:', err?.message || err);
      propuesta = sanearDictadoDelParte(null, dictado);
    }

    // Los textos viajan CON la propuesta para que la pantalla no los reteclee: son microcopy
    // aprobada (regla 30) y un texto aprobado que se copia a mano deja de ser el aprobado.
    return res.json({ propuesta, avisos: AVISOS_DEL_DICTADO });
  } catch (err: any) {
    console.error('[POST /admin/partes/:id/dictado]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ───────────────────────────────────────────────────────
// POST /admin/partes/:id/firmar-tecnico · SCRUM-653
// ───────────────────────────────────────────────────────
//
// 🔴 RUTA PROPIA, no un parámetro de la de arriba. Las dos firmas escriben en columnas distintas
// y tienen candados distintos; con un `if (esTecnico)` dentro de una sola ruta, el día que una
// cambie habría que releer las dos para saber a cuál afecta. Además la cola de firmas encamina
// por TIPO (`firma:parte-tecnico:7`), y un tipo necesita una ruta.
//
// ⚠️ AQUÍ NO HAY `firmadoPorCalidad`, y no es un olvido: las seis opciones de `albaranFirmante.ts`
// existen porque quien firma POR EL CLIENTE puede ser cualquiera —«portero o conserje», «un
// familiar»—. El técnico es un empleado identificado del merchant; ofrecerle una ranura de
// «calidad» sería ofrecerle declarar que firma en nombre del cliente.
router.post('/:id/firmar-tecnico', async (req: any, res) => {
  try {
    const found = await findParte(req);
    if (!found.ok) {
      return res.status(found.status).json({ error: found.status === 400 ? 'invalid_id' : 'not_found' });
    }
    const { parte } = found;

    // Mismo código `parte_locked` que la del cliente: la cola lo trata como ÉXITO al drenar.
    const ranura = puedeFirmarTecnico(parte);
    if (!ranura.ok) {
      return res.status(409).json({ error: 'parte_locked', message: ranura.motivo });
    }

    const lineas: LineaParte[] = Array.isArray(parte.lineas) ? (parte.lineas as any) : [];
    const sePuede = puedeFirmarse(lineas);
    if (!sePuede.ok) return res.status(409).json({ error: 'parte_vacio', message: sePuede.motivo });

    const signatureData = String(req.body?.signatureData || '');
    if (!/^data:image\/(png|jpeg);base64,/.test(signatureData)) {
      return res
        .status(400)
        .json({ error: 'firma_invalida', message: 'La firma debe ser una imagen PNG o JPEG (data-URI base64).' });
    }
    if (signatureData.length > FIRMA_MAX_CHARS) {
      return res
        .status(413)
        .json({ error: 'firma_demasiado_grande', message: 'La firma supera el tamaño máximo permitido.' });
    }

    // El nombre es OBLIGATORIO, con la misma regla que el del cliente (SCRUM-300): el acto de
    // firmar lo exige aunque la columna sea nullable por las filas viejas.
    const nombre = exigirNombreFirmante(req.body?.firmadoTecnicoNombre);
    if (!nombre.ok) return res.status(400).json({ error: nombre.error, message: nombre.message });

    // El sello, sólo si no lo había: v:2 sella CONTENIDO, así que firme quien firme primero la
    // huella es la misma. Recalcularla no la cambiaría, pero reescribirla haría pensar que sí.
    const contenidoHash = parte.contenidoHash
      ? parte.contenidoHash
      : computeParteContentHash(paramsDeSello(parte, lineas), PARTE_CONTENIDO_VERSION_ACTUAL);

    const updated = await prisma.parteTrabajo.update({
      where: { id: parte.id },
      data: {
        // El contenido se congela con la PRIMERA firma, sea de quien sea. Si firma el técnico
        // primero, el estado pasa a `firmado` aquí y el cliente firma después sobre su ranura.
        estado: 'firmado',
        firmadoTecnicoAt: new Date(),
        firmadoTecnicoNombre: nombre.nombre,
        firmaTecnicoUrl: signatureData,
        contenidoHash,
        contenidoVersion: parte.contenidoVersion ?? PARTE_CONTENIDO_VERSION_ACTUAL,
      },
    });
    return res.json(serializeParteParaElTecnico(updated));
  } catch (err: any) {
    console.error('[POST /admin/partes/:id/firmar-tecnico]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
