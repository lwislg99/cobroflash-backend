// src/modules/fiscal/verifactu/sif.client.ts — SCRUM-1127 · SIF-1 · S1-D fase 1.
//
// EL CLIENTE QUE ENVÍA UN SOBRE `RegFactuSistemaFacturacion` A UN ENDPOINT Y DICE QUÉ PASÓ.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE ESTE FICHERO NO ES
//
//   · NO está cableado a nada. Ningún código de `src/` lo llama: ni la emisión, ni un cron, ni
//     una ruta. Cablearlo a facturas reales ES el camino de emisión (regla 40): fase 2, con GO.
//   · NO lee certificados. Las opciones TLS (mTLS) llegan de fuera, opacas, y no se escriben
//     nunca en la traza. El certificado no viaja a ninguna sesión (`limites-del-fundador.md`).
//   · NO lleva ninguna dirección escrita. El endpoint sale de la configuración
//     (`leerEndpointDeConfiguracion`) y, si falta o no es válido, NO SE ENVÍA (fallo cerrado).
//   · Que funcione contra el servidor falso de los tests prueba la FORMA y el MANEJO. No prueba
//     que la AEAT acepte nada: eso solo lo demuestra un CSV devuelto por ella.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// 🔴 CUATRO RESULTADOS, Y NO SE MEZCLAN (SCRUM-1112/1114: un cuelgue mudo de 1 h 46 min)
//
//   no_enviado     · el sobre NO llegó entero a la otra punta: configuración, DNS, conexión,
//                    TLS o escritura cortada. Sabemos que la AEAT no lo tiene.
//   sin_respuesta  · el sobre SÍ salió entero y no sabemos qué pasó: timeout esperando o
//                    leyendo, conexión cortada, respuesta que no es XML o que no se reconoce.
//                    La AEAT PUEDE tenerlo. Su FAQ manda reenviar los mismos registros, y el
//                    duplicado lo detecta ella (`RegistroDuplicado`).
//   rechazado      · la AEAT contestó y NO registró el envío: `SOAP Fault` o `EstadoEnvio`
//                    `Incorrecto`.
//   respondido     · la AEAT contestó con `Correcto` o `ParcialmenteCorrecto`. Qué registros
//                    quedaron dentro se lee línea a línea (`lineas`), nunca del estado global.
//
// Nada devuelve «aceptado» por defecto. Aceptado exige un `EstadoEnvio` reconocido, dicho por
// la respuesta, y todo lo que no se entiende cae en `sin_respuesta`, que se reintenta.
//
// Y la función NO LANZA: cada fallo sale por su resultado tipado, con la ETAPA en la que
// ocurrió. Un `catch` que lo juntara todo en un «error» es justo lo que se quiere evitar.

import http from 'node:http';
import https from 'node:https';

// ───────────────────────────────────────────────────────────────── tipos

/** Etapas de un envío, en orden. El timeout y el error nombran siempre la suya. */
export type EtapaEnvio =
  | 'preparar'           // configuración y sobre, antes de abrir nada
  | 'conectar'           // DNS + TCP
  | 'tls'                // apretón de manos TLS (mTLS en la AEAT)
  | 'enviar'             // escribir el sobre
  | 'esperar_respuesta'  // sobre entregado, sin el primer byte de la respuesta
  | 'leer_respuesta'     // la respuesta empezó y no ha terminado
  | 'interpretar';       // la respuesta llegó entera y no se reconoce

export const ETAPAS_ENVIO: readonly EtapaEnvio[] = [
  'preparar', 'conectar', 'tls', 'enviar', 'esperar_respuesta', 'leer_respuesta', 'interpretar',
];

export interface TimeoutsPorEtapa {
  conectarMs: number;
  tlsMs: number;
  enviarMs: number;
  esperarRespuestaMs: number;
  leerRespuestaMs: number;
}

/**
 * Por etapa, no uno global. Un único reloj no distingue «no conecta» de «no contesta», y esa
 * es justo la pregunta que hay que poder responder leyendo la traza.
 */
export const TIMEOUTS_POR_DEFECTO: Readonly<TimeoutsPorEtapa> = {
  conectarMs: 10_000,
  tlsMs: 10_000,
  enviarMs: 30_000,
  esperarRespuestaMs: 60_000,
  leerRespuestaMs: 30_000,
};

/** Una respuesta de 1.000 líneas cabe con holgura; más que esto no es una respuesta nuestra. */
export const MAX_BYTES_RESPUESTA = 10 * 1024 * 1024;

/** Opciones TLS del mTLS. Llegan de fuera, OPACAS: este fichero no las lee ni las registra. */
export interface OpcionesTls {
  pfx?: Buffer;
  passphrase?: string;
  cert?: string | Buffer;
  key?: string | Buffer;
  ca?: string | Buffer | Array<string | Buffer>;
}

export type EstadoEnvioAeat = 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto';
export type EstadoRegistroAeat = 'Correcto' | 'AceptadoConErrores' | 'Incorrecto';
export type EstadoRegistroDuplicadoAeat = 'Correcta' | 'AceptadaConErrores' | 'Anulada';

const ESTADOS_ENVIO: readonly EstadoEnvioAeat[] = ['Correcto', 'ParcialmenteCorrecto', 'Incorrecto'];
const ESTADOS_REGISTRO: readonly EstadoRegistroAeat[] = ['Correcto', 'AceptadoConErrores', 'Incorrecto'];
const ESTADOS_DUPLICADO: readonly EstadoRegistroDuplicadoAeat[] = ['Correcta', 'AceptadaConErrores', 'Anulada'];

export interface LineaRespuesta {
  idEmisorFactura: string;
  numSerieFactura: string;
  fechaExpedicionFactura: string;
  tipoOperacion: string | null;
  estadoRegistro: EstadoRegistroAeat;
  codigoError: string | null;
  descripcionError: string | null;
  /** Solo si la AEAT lo rechaza por duplicado: el estado del que YA tiene. */
  duplicado: { idPeticion: string | null; estado: EstadoRegistroDuplicadoAeat } | null;
}

export interface RespuestaAeat {
  estadoEnvio: EstadoEnvioAeat;
  csv: string | null;
  /** Segundos que la AEAT exige esperar antes del siguiente envío (su flujo de control). */
  tiempoEsperaEnvioS: number;
  lineas: LineaRespuesta[];
}

export type ResultadoEnvio =
  | { tipo: 'no_enviado'; etapa: EtapaEnvio; motivo: string; ms: number }
  | { tipo: 'sin_respuesta'; etapa: EtapaEnvio; motivo: string; ms: number; httpStatus: number | null }
  | { tipo: 'rechazado'; porque: 'soap_fault'; faultcode: string | null; faultstring: string | null; httpStatus: number; ms: number }
  | { tipo: 'rechazado'; porque: 'estado_envio_incorrecto'; respuesta: RespuestaAeat; httpStatus: number; ms: number }
  | { tipo: 'respondido'; respuesta: RespuestaAeat; httpStatus: number; ms: number };

export interface EventoTraza {
  ts: string;
  envioId: string;
  evento: 'inicio' | 'etapa' | 'fin';
  etapa?: EtapaEnvio;
  ms?: number;
  endpoint?: string;
  bytes?: number;
  resultado?: string;
  detalle?: string;
}

export type Traza = (e: EventoTraza) => void;

/**
 * Por defecto la traza va a `stderr` EN EL MOMENTO, una línea por evento. Nada se acumula para
 * imprimirse al final: si el proceso se cuelga, la última línea dice en qué etapa se quedó.
 */
export const trazaPorDefecto: Traza = (e) => {
  process.stderr.write(`[sif.client] ${JSON.stringify(e)}\n`);
};

// ───────────────────────────────────────────────────────────── configuración

/** Nombre de la variable de entorno con la URL del servicio. Sin valor por defecto, a propósito. */
export const VARIABLE_ENDPOINT = 'VERIFACTU_AEAT_ENDPOINT';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export type EndpointLeido = { ok: true; url: URL } | { ok: false; motivo: string };

/**
 * Valida una URL de endpoint. FALLA CERRADO:
 *   · sin valor → no hay envío (no se inventa una dirección);
 *   · con usuario/clave o con `?query` → no se usa: una credencial en la URL acabaría en un log;
 *   · `http:` solo hacia loopback (el servidor falso de los tests). Hacia fuera, solo `https:`.
 */
export function validarEndpoint(valor: string | undefined | null): EndpointLeido {
  const bruto = (valor ?? '').trim();
  if (!bruto) return { ok: false, motivo: 'endpoint_no_configurado' };
  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    return { ok: false, motivo: 'endpoint_no_es_url' };
  }
  if (url.username || url.password) return { ok: false, motivo: 'endpoint_con_credenciales' };
  if (url.search || url.hash) return { ok: false, motivo: 'endpoint_con_query' };
  if (url.protocol === 'https:') return { ok: true, url };
  if (url.protocol === 'http:' && LOOPBACK.has(url.hostname)) return { ok: true, url };
  return { ok: false, motivo: 'endpoint_protocolo_no_permitido' };
}

export function leerEndpointDeConfiguracion(env: NodeJS.ProcessEnv = process.env): EndpointLeido {
  return validarEndpoint(env[VARIABLE_ENDPOINT]);
}

/** Lo que se escribe en la traza: protocolo, host y ruta. Nunca usuario, clave ni query. */
export function endpointParaTraza(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}`;
}

// ───────────────────────────────────────────────────────────── el sobre SOAP

/**
 * SOAP 1.1, el mismo sobre que la AEAT aceptó el 24-sep-2026 (SCRUM-1110, CSV
 * `A-KR84MFNPTPDHMN`, generado por `scripts/sobre-soap-prueba-aeat.mjs`). El cuerpo es la
 * salida de `construirCuerpoSoapRegFactu`, que no lleva declaración XML.
 */
export function envolverSoap(cuerpo: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
${cuerpo}
  </soapenv:Body>
</soapenv:Envelope>
`;
}

// ───────────────────────────────────────────────────────── leer la respuesta

function sinComentarios(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, '');
}

function desescapar(t: string): string {
  return t
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Contenidos de TODOS los elementos con ese nombre local, con o sin prefijo. */
function todos(xml: string, local: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${local}\\s*>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function uno(xml: string, local: string): string | null {
  const v = todos(xml, local)[0];
  return v === undefined ? null : desescapar(v).trim();
}

function quitar(xml: string, local: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}(?:\\s[^>]*)?>[\\s\\S]*?</(?:[\\w.-]+:)?${local}\\s*>`, 'g');
  return xml.replace(re, '');
}

export type Interpretacion =
  | { tipo: 'fault'; faultcode: string | null; faultstring: string | null }
  | { tipo: 'respuesta'; respuesta: RespuestaAeat }
  | { tipo: 'ilegible'; motivo: string };

/**
 * Lee una respuesta. Pura: se prueba sin red. Todo lo que no encaje EXACTAMENTE con lo que
 * el XSD `RespuestaSuministro` permite es `ilegible`, y lo ilegible nunca es «aceptado».
 */
export function interpretarRespuesta(cuerpo: string): Interpretacion {
  const xml = sinComentarios(cuerpo).trim();
  if (!xml.startsWith('<')) return { tipo: 'ilegible', motivo: 'no_es_xml' };
  if (!/<(?:[\w.-]+:)?Envelope[\s>]/.test(xml) || todos(xml, 'Body').length !== 1) {
    return { tipo: 'ilegible', motivo: 'sin_sobre_soap' };
  }
  const body = todos(xml, 'Body')[0];

  if (/<(?:[\w.-]+:)?Fault[\s>]/.test(body)) {
    return { tipo: 'fault', faultcode: uno(body, 'faultcode'), faultstring: uno(body, 'faultstring') };
  }

  const resp = todos(body, 'RespuestaRegFactuSistemaFacturacion');
  if (resp.length !== 1) return { tipo: 'ilegible', motivo: 'sin_respuesta_regfactu' };
  const r = resp[0];

  const estadoEnvio = uno(quitar(r, 'RespuestaLinea'), 'EstadoEnvio');
  if (!estadoEnvio || !(ESTADOS_ENVIO as readonly string[]).includes(estadoEnvio)) {
    return { tipo: 'ilegible', motivo: `estado_envio_desconocido:${estadoEnvio ?? 'ausente'}` };
  }
  const tiempo = uno(quitar(r, 'RespuestaLinea'), 'TiempoEsperaEnvio');
  if (!tiempo || !/^\d{1,6}$/.test(tiempo)) {
    return { tipo: 'ilegible', motivo: `tiempo_espera_invalido:${tiempo ?? 'ausente'}` };
  }

  const lineas: LineaRespuesta[] = [];
  for (const bruto of todos(r, 'RespuestaLinea')) {
    const dup = todos(bruto, 'RegistroDuplicado')[0] ?? null;
    const propia = quitar(bruto, 'RegistroDuplicado'); // su CodigoErrorRegistro no es el de la línea
    const id = todos(propia, 'IDFactura')[0];
    const estado = uno(propia, 'EstadoRegistro');
    if (!id || !estado || !(ESTADOS_REGISTRO as readonly string[]).includes(estado)) {
      return { tipo: 'ilegible', motivo: `linea_ilegible:${estado ?? 'sin_estado'}` };
    }
    let duplicado: LineaRespuesta['duplicado'] = null;
    if (dup !== null) {
      const ed = uno(dup, 'EstadoRegistroDuplicado');
      if (!ed || !(ESTADOS_DUPLICADO as readonly string[]).includes(ed)) {
        return { tipo: 'ilegible', motivo: `duplicado_ilegible:${ed ?? 'sin_estado'}` };
      }
      duplicado = { idPeticion: uno(dup, 'IdPeticionRegistroDuplicado'), estado: ed as EstadoRegistroDuplicadoAeat };
    }
    lineas.push({
      idEmisorFactura: uno(id, 'IDEmisorFactura') ?? '',
      numSerieFactura: uno(id, 'NumSerieFactura') ?? '',
      fechaExpedicionFactura: uno(id, 'FechaExpedicionFactura') ?? '',
      tipoOperacion: uno(propia, 'TipoOperacion'),
      estadoRegistro: estado as EstadoRegistroAeat,
      codigoError: uno(propia, 'CodigoErrorRegistro'),
      descripcionError: uno(propia, 'DescripcionErrorRegistro'),
      duplicado,
    });
  }

  // Coherencia: un «Correcto» global con una línea «Incorrecto» no es una respuesta que
  // sepamos leer. Se trata como ilegible (se reintenta) antes que dar por buena una línea.
  if (estadoEnvio === 'Correcto' && lineas.some((l) => l.estadoRegistro === 'Incorrecto')) {
    return { tipo: 'ilegible', motivo: 'correcto_con_linea_incorrecta' };
  }

  const csvCrudo = uno(quitar(r, 'RespuestaLinea'), 'CSV');
  return {
    tipo: 'respuesta',
    respuesta: {
      estadoEnvio: estadoEnvio as EstadoEnvioAeat,
      csv: csvCrudo || null,
      tiempoEsperaEnvioS: Number(tiempo),
      lineas,
    },
  };
}

// ─────────────────────────────────────────────────────────────── el envío

class FalloDeEtapa extends Error {
  constructor(readonly etapa: EtapaEnvio, readonly motivo: string) {
    super(`${etapa}:${motivo}`);
  }
}

export interface ParamsEnvio {
  /** Ya validado con `validarEndpoint`/`leerEndpointDeConfiguracion`, o una cadena a validar. */
  endpoint: URL | string;
  /** Salida de `construirCuerpoSoapRegFactu`: el contenido del `Body`, sin declaración XML. */
  cuerpoSoap: string;
  tls?: OpcionesTls;
  timeouts?: Partial<TimeoutsPorEtapa>;
  envioId?: string;
  traza?: Traza;
  maxBytesRespuesta?: number;
}

let contadorEnvios = 0;

/**
 * Envía UN sobre y devuelve qué pasó. No lanza: todo sale por `ResultadoEnvio`.
 */
export async function enviarSobre(p: ParamsEnvio): Promise<ResultadoEnvio> {
  const t0 = Date.now();
  const envioId = p.envioId ?? `env-${t0}-${++contadorEnvios}`;
  const traza = p.traza ?? trazaPorDefecto;
  const escribir = (e: Omit<EventoTraza, 'ts' | 'envioId'>) => {
    try { traza({ ts: new Date().toISOString(), envioId, ...e }); } catch { /* la traza nunca tumba un envío */ }
  };
  const ms = () => Date.now() - t0;

  const fin = (r: ResultadoEnvio): ResultadoEnvio => {
    const detalle = r.tipo === 'no_enviado' || r.tipo === 'sin_respuesta'
      ? `${r.etapa}:${r.motivo}`
      : r.tipo === 'rechazado'
        ? (r.porque === 'soap_fault' ? `soap_fault:${r.faultcode ?? '?'}` : `Incorrecto:${r.respuesta.lineas.length}_lineas`)
        : `${r.respuesta.estadoEnvio}:${r.respuesta.lineas.length}_lineas:csv=${r.respuesta.csv ?? '-'}`;
    escribir({ evento: 'fin', resultado: r.tipo, ms: r.ms, detalle });
    return r;
  };

  // ── preparar
  const leido = typeof p.endpoint === 'string' ? validarEndpoint(p.endpoint) : validarEndpoint(p.endpoint.href);
  if (!leido.ok) {
    escribir({ evento: 'inicio', etapa: 'preparar', detalle: leido.motivo });
    return fin({ tipo: 'no_enviado', etapa: 'preparar', motivo: leido.motivo, ms: ms() });
  }
  const url = leido.url;
  if (!p.cuerpoSoap || !p.cuerpoSoap.trim()) {
    escribir({ evento: 'inicio', etapa: 'preparar', endpoint: endpointParaTraza(url), detalle: 'sobre_vacio' });
    return fin({ tipo: 'no_enviado', etapa: 'preparar', motivo: 'sobre_vacio', ms: ms() });
  }
  const sobre = Buffer.from(envolverSoap(p.cuerpoSoap), 'utf8');
  const timeouts: TimeoutsPorEtapa = { ...TIMEOUTS_POR_DEFECTO, ...(p.timeouts ?? {}) };
  const maxBytes = p.maxBytesRespuesta ?? MAX_BYTES_RESPUESTA;
  const esHttps = url.protocol === 'https:';

  escribir({ evento: 'inicio', etapa: 'conectar', endpoint: endpointParaTraza(url), bytes: sobre.length, ms: ms() });

  return new Promise<ResultadoEnvio>((resolver) => {
    let etapa: EtapaEnvio = 'conectar';
    let reloj: NodeJS.Timeout | null = null;
    let terminado = false;
    let conectado = false;
    let seguro = !esHttps;
    let escrito = false;
    let httpStatus: number | null = null;
    /** El motivo con el que NOSOTROS cortamos: gana a los eventos que el corte provoca después. */
    let causa: FalloDeEtapa | null = null;
    // Cortar CIERRA en el momento con su motivo: no se espera a que el corte dispare otros eventos
    // (un `end` que llega igual, un `aborted`), que son los que acabarían nombrando otra cosa.
    const cortar = (f: FalloDeEtapa) => { if (!causa) causa = f; fallar(f); req.destroy(f); };

    const limiteDe = (e: EtapaEnvio): number => {
      switch (e) {
        case 'conectar': return timeouts.conectarMs;
        case 'tls': return timeouts.tlsMs;
        case 'enviar': return timeouts.enviarMs;
        case 'esperar_respuesta': return timeouts.esperarRespuestaMs;
        case 'leer_respuesta': return timeouts.leerRespuestaMs;
        default: return timeouts.leerRespuestaMs;
      }
    };

    const pasarA = (nueva: EtapaEnvio) => {
      if (terminado || nueva === etapa && reloj) return;
      etapa = nueva;
      if (reloj) clearTimeout(reloj);
      const limite = limiteDe(nueva);
      reloj = setTimeout(() => {
        cortar(new FalloDeEtapa(nueva, `timeout_${limite}ms`));
      }, limite);
      escribir({ evento: 'etapa', etapa: nueva, ms: ms() });
    };

    /** El sobre cuenta como ENTREGADO solo con la conexión (y el TLS) hechos y el cuerpo escrito. */
    const entregado = () => conectado && seguro && escrito;

    const avanzar = () => {
      if (!conectado) return pasarA('conectar');
      if (!seguro) return pasarA('tls');
      if (!escrito) return pasarA('enviar');
      if (etapa === 'conectar' || etapa === 'tls' || etapa === 'enviar') pasarA('esperar_respuesta');
    };

    const cerrar = (r: ResultadoEnvio) => {
      if (terminado) return;
      terminado = true;
      if (reloj) clearTimeout(reloj);
      resolver(fin(r));
    };

    const fallar = (err: unknown) => {
      const f = causa ?? (err instanceof FalloDeEtapa
        ? err
        : new FalloDeEtapa(etapa, (err as NodeJS.ErrnoException)?.code ?? (err as Error)?.message ?? 'error'));
      if (f.etapa === 'leer_respuesta' || f.etapa === 'esperar_respuesta' || entregado()) {
        cerrar({ tipo: 'sin_respuesta', etapa: f.etapa, motivo: f.motivo, ms: ms(), httpStatus });
      } else {
        cerrar({ tipo: 'no_enviado', etapa: f.etapa, motivo: f.motivo, ms: ms() });
      }
    };

    const opciones: https.RequestOptions = {
      method: 'POST',
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port || (esHttps ? 443 : 80),
      path: url.pathname,
      agent: false,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': sobre.length,
        SOAPAction: '""',
      },
      ...(esHttps ? (p.tls ?? {}) : {}),
    };

    let req: http.ClientRequest;
    try {
      req = (esHttps ? https : http).request(opciones, (res) => {
        httpStatus = res.statusCode ?? null;
        pasarA('leer_respuesta');
        const trozos: Buffer[] = [];
        let bytes = 0;
        res.on('data', (c: Buffer) => {
          bytes += c.length;
          if (bytes > maxBytes) {
            cortar(new FalloDeEtapa('leer_respuesta', `respuesta_demasiado_grande>${maxBytes}`));
            return;
          }
          trozos.push(c);
        });
        res.on('error', fallar);
        res.on('aborted', () => fallar(new FalloDeEtapa('leer_respuesta', 'respuesta_cortada')));
        res.on('end', () => {
          if (terminado || causa) return;
          if (!res.complete) return fallar(new FalloDeEtapa('leer_respuesta', 'respuesta_cortada'));
          if (reloj) clearTimeout(reloj);
          const texto = Buffer.concat(trozos).toString('utf8');
          const i = interpretarRespuesta(texto);
          const status = httpStatus ?? 0;
          if (i.tipo === 'fault') {
            return cerrar({ tipo: 'rechazado', porque: 'soap_fault', faultcode: i.faultcode, faultstring: i.faultstring, httpStatus: status, ms: ms() });
          }
          if (i.tipo === 'ilegible') {
            etapa = 'interpretar';
            return cerrar({ tipo: 'sin_respuesta', etapa: 'interpretar', motivo: `http_${status}:${i.motivo}`, ms: ms(), httpStatus });
          }
          if (status < 200 || status > 299) {
            // Un XML de respuesta válido con un código HTTP de error no es algo que sepamos leer.
            return cerrar({ tipo: 'sin_respuesta', etapa: 'interpretar', motivo: `http_${status}:respuesta_con_status_de_error`, ms: ms(), httpStatus });
          }
          if (i.respuesta.estadoEnvio === 'Incorrecto') {
            return cerrar({ tipo: 'rechazado', porque: 'estado_envio_incorrecto', respuesta: i.respuesta, httpStatus: status, ms: ms() });
          }
          return cerrar({ tipo: 'respondido', respuesta: i.respuesta, httpStatus: status, ms: ms() });
        });
      });

    } catch (e) {
      // Síncrono: unas opciones TLS que no se pueden cargar revientan AQUÍ, antes de abrir nada.
      // Solo el código del error: el mensaje podría arrastrar parte de lo que se le pasó.
      const codigo = (e as NodeJS.ErrnoException)?.code ?? 'error';
      cerrar({ tipo: 'no_enviado', etapa: 'tls', motivo: `opciones_tls_invalidas:${codigo}`, ms: ms() });
      return;
    }

    req.on('socket', (s) => {
      const alConectar = () => { conectado = true; avanzar(); };
      const alSeguro = () => { seguro = true; avanzar(); };
      if ((s as { connecting?: boolean }).connecting === false) conectado = true;
      else s.once('connect', alConectar);
      if (esHttps) s.once('secureConnect', alSeguro);
      avanzar();
    });
    req.on('finish', () => { escrito = true; avanzar(); });
    req.on('error', fallar);

    pasarA('conectar');
    req.end(sobre);
  });
}
