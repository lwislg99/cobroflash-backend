// src/core/data/catalogLoader.ts — A17.1 (EXT3, ONBOARD-2)
// Catálogos por gremio en data/catalogs/{gremio}.json con el schema del master:
// { nombre, unidad, precioOrientativo:{min,max}, categoria, mantenible?:meses }.
// REGLA DE CONTENIDO (master): los precios son ORIENTATIVOS y el fichero entero
// vive en status 'draft_pendiente_validacion' hasta que 2-3 profesionales
// reales por gremio los validen (checklist fundador). El import SIEMPRE
// etiqueta "orientativo" y todo queda editable por el merchant.
import fs from 'node:fs';
import path from 'node:path';

export type CatalogFileItem = {
  nombre: string;
  unidad: string; // ud | m² | h | servicio | punto | m
  precioOrientativo: { min: number; max: number };
  categoria: string;
  mantenible?: number; // meses (alinea con MANT-1)
};

export type CatalogTemplate = {
  nombre: string;
  paymentTerms?: 'FULL_UPFRONT' | 'FIFTY_FIFTY' | 'MANUAL';
  lines: Array<{ concept: string; qty: number; priceFrom: string }>; // priceFrom = nombre de item del catálogo
};

export type CatalogFile = {
  gremio: string;
  status: string; // 'draft_pendiente_validacion' | 'validado'
  version: string;
  items: CatalogFileItem[];
  plantillas?: CatalogTemplate[];
};

// El master nombra los ficheros por GREMIO (fontaneria…), el modelo Merchant
// guarda el OFICIO (fontanero…): mapa único aquí.
const TRADE_TO_FILE: Record<string, string> = {
  fontanero: 'fontaneria',
  electricista: 'electricidad',
  climatizacion: 'climatizacion',
  cerrajero: 'cerrajeria',
  pintor: 'pintura',
  reformista: 'reformas',
};

const cache = new Map<string, CatalogFile | null>();

function catalogsDir(): string {
  // dist/core/data → ../../.. = raíz del repo (data/ no se compila, viaja tal cual)
  return path.join(__dirname, '../../../data/catalogs');
}

export function getCatalogFile(trade: string): CatalogFile | null {
  const file = TRADE_TO_FILE[String(trade || '').toLowerCase()];
  if (!file) return null;
  if (cache.has(file)) return cache.get(file) ?? null;
  try {
    const raw = fs.readFileSync(path.join(catalogsDir(), `${file}.json`), 'utf8');
    const parsed = JSON.parse(raw) as CatalogFile;
    if (!Array.isArray(parsed.items)) throw new Error('items no es array');
    cache.set(file, parsed);
    return parsed;
  } catch (e) {
    console.warn(`[catalog] sin fichero para ${trade} (${file}.json):`, (e as Error)?.message);
    cache.set(file, null);
    return null;
  }
}

// Precio de import: punto medio del rango orientativo, redondeado a euro.
export function midPrice(item: CatalogFileItem): number {
  const { min, max } = item.precioOrientativo;
  return Math.round((Number(min) + Number(max)) / 2);
}

// Etiqueta VISIBLE de orientativo (spec A17.1) — viaja en la descripción del
// producto para que el merchant la vea y la borre cuando ajuste SU precio.
export function orientativoLabel(item: CatalogFileItem): string {
  const { min, max } = item.precioOrientativo;
  const unidad = item.unidad && item.unidad !== 'servicio' ? ` por ${item.unidad}` : '';
  return `Precio orientativo (${min}–${max} €${unidad}) — ajústalo a tu zona`;
}
