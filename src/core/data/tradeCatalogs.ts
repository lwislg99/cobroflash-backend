// src/core/data/tradeCatalogs.ts
// Catálogos predefinidos de servicios por oficio y país.
// Sirven para precargar el catálogo del merchant en el onboarding (UX1-2/UX1-3).
//
// El IVA NO se guarda aquí: se aplica al cargar usando getLocale(country).defaultVat
// (ver core/i18n/locales.ts), para mantener una sola fuente de verdad fiscal.
// Los precios son orientativos de mercado y el merchant los puede editar después.

export type CatalogItem = {
  name: string;
  price: number;
  description?: string;
};

export type Trade =
  | 'electricista'
  | 'fontanero'
  | 'reformista'
  | 'pintor'
  | 'cerrajero'
  | 'climatizacion';

// Clave: `${trade}_${country}` en minúscula (ej: "electricista_es", "fontanero_mx").
// Si no existe la combinación exacta, getTradeCatalog cae al catálogo `_es` del oficio.
export const TRADE_CATALOGS: Record<string, CatalogItem[]> = {
  // ─────────────── ESPAÑA (EUR) ───────────────
  electricista_es: [
    { name: 'Instalación de punto de luz', price: 45 },
    { name: 'Sustitución de cuadro eléctrico', price: 350, description: 'Incluye material y mano de obra' },
    { name: 'Instalación de enchufe', price: 35 },
    { name: 'Revisión y boletín eléctrico', price: 120 },
    { name: 'Instalación de luminaria LED', price: 40 },
    { name: 'Localización y reparación de avería', price: 80, description: 'Por hora de trabajo' },
    { name: 'Instalación de diferencial', price: 95 },
    { name: 'Cableado de vivienda (por estancia)', price: 180 },
  ],
  fontanero_es: [
    { name: 'Reparación de fuga de agua', price: 90 },
    { name: 'Sustitución de grifo', price: 65 },
    { name: 'Desatasco de tubería', price: 110 },
    { name: 'Instalación de inodoro', price: 130, description: 'Incluye sellado y conexión' },
    { name: 'Instalación de lavabo', price: 120 },
    { name: 'Cambio de termo eléctrico', price: 220 },
    { name: 'Reparación de cisterna', price: 55 },
    { name: 'Instalación de lavadora/lavavajillas', price: 70 },
  ],
  reformista_es: [
    { name: 'Alicatado de baño (m²)', price: 35 },
    { name: 'Solado de suelo (m²)', price: 30 },
    { name: 'Tabique de pladur (m²)', price: 45 },
    { name: 'Reforma integral de baño', price: 3500, description: 'Presupuesto base, varía según calidades' },
    { name: 'Reforma de cocina', price: 5000 },
    { name: 'Pintura de vivienda (m²)', price: 12 },
    { name: 'Demolición y retirada de escombros', price: 250 },
  ],
  pintor_es: [
    { name: 'Pintura interior (m²)', price: 10 },
    { name: 'Pintura de fachada (m²)', price: 18 },
    { name: 'Esmaltado de puerta', price: 60 },
    { name: 'Alisado de pared (m²)', price: 14 },
    { name: 'Aplicación de gotelé / quitar gotelé (m²)', price: 16 },
    { name: 'Pintura de techo (m²)', price: 11 },
  ],
  cerrajero_es: [
    { name: 'Apertura de puerta sin daños', price: 80 },
    { name: 'Cambio de bombín', price: 90, description: 'Material incluido' },
    { name: 'Instalación de cerradura de seguridad', price: 180 },
    { name: 'Reparación de cerradura', price: 70 },
    { name: 'Copia de llave de seguridad', price: 25 },
  ],
  climatizacion_es: [
    { name: 'Instalación de aire acondicionado split', price: 450, description: 'Equipo no incluido' },
    { name: 'Mantenimiento / limpieza de aire acondicionado', price: 80 },
    { name: 'Recarga de gas refrigerante', price: 120 },
    { name: 'Reparación de avería en climatización', price: 95 },
    { name: 'Instalación de caldera', price: 600 },
  ],

  // ─────────────── MÉXICO (MXN) ───────────────
  electricista_mx: [
    { name: 'Instalación de contacto', price: 350 },
    { name: 'Cambio de centro de carga', price: 4500, description: 'Incluye material y mano de obra' },
    { name: 'Instalación de apagador', price: 300 },
    { name: 'Revisión de instalación eléctrica', price: 800 },
    { name: 'Instalación de luminaria LED', price: 400 },
    { name: 'Localización y reparación de corto', price: 900 },
    { name: 'Instalación de pastilla termomagnética', price: 650 },
  ],
  fontanero_mx: [
    { name: 'Reparación de fuga', price: 700 },
    { name: 'Cambio de llave / mezcladora', price: 550 },
    { name: 'Destape de tubería', price: 850 },
    { name: 'Instalación de WC', price: 1100 },
    { name: 'Instalación de lavabo', price: 950 },
    { name: 'Cambio de boiler', price: 1800 },
    { name: 'Reparación de tinaco / cisterna', price: 600 },
  ],
  reformista_mx: [
    { name: 'Colocación de azulejo (m²)', price: 280 },
    { name: 'Colocación de piso (m²)', price: 250 },
    { name: 'Muro de tablaroca (m²)', price: 380 },
    { name: 'Remodelación de baño', price: 35000, description: 'Presupuesto base' },
    { name: 'Remodelación de cocina', price: 50000 },
    { name: 'Pintura de interiores (m²)', price: 90 },
  ],
  pintor_mx: [
    { name: 'Pintura de interiores (m²)', price: 85 },
    { name: 'Pintura de fachada (m²)', price: 150 },
    { name: 'Esmaltado de puerta', price: 500 },
    { name: 'Resane de muro (m²)', price: 110 },
    { name: 'Pintura de plafón / techo (m²)', price: 95 },
  ],

  // ─────────────── COLOMBIA (COP) ───────────────
  electricista_co: [
    { name: 'Instalación de toma corriente', price: 80000 },
    { name: 'Cambio de tablero eléctrico', price: 600000, description: 'Incluye material y mano de obra' },
    { name: 'Instalación de interruptor', price: 70000 },
    { name: 'Revisión de instalación eléctrica', price: 180000 },
    { name: 'Instalación de luminaria LED', price: 90000 },
    { name: 'Localización y reparación de daño', price: 200000 },
  ],
  fontanero_co: [
    { name: 'Reparación de fuga', price: 160000 },
    { name: 'Cambio de grifería', price: 130000 },
    { name: 'Destape de tubería', price: 190000 },
    { name: 'Instalación de sanitario', price: 240000 },
    { name: 'Instalación de lavamanos', price: 210000 },
    { name: 'Cambio de calentador', price: 400000 },
  ],
};

/**
 * Devuelve el catálogo para un oficio + país.
 * Cae al catálogo `_es` del oficio si no existe la combinación exacta.
 * Devuelve [] si el oficio no tiene catálogo (ej: "otro").
 */
export function getTradeCatalog(trade: string, country: string): CatalogItem[] {
  const t = String(trade || '').toLowerCase();
  const c = String(country || '').toLowerCase();
  return TRADE_CATALOGS[`${t}_${c}`] ?? TRADE_CATALOGS[`${t}_es`] ?? [];
}
