// src/modules/products/domain/products.service.ts
import { prisma } from '../../../core/db/prisma';
// SCRUM-312: el parseo de CSV vive en UN solo sitio del proyecto. Antes había dos (aquí y en
// el importador del navegador), y no eran equivalentes.
import { parsearLineaCsv, quitarBom, detectarSeparador } from '../../../core/csv/csv';

function normalizeSearch(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')                 // separa letras y diacríticos
    .replace(/[\u0300-\u036f]/g, '')  // elimina diacríticos (tildes)
    .replace(/\s+/g, ' ');            // colapsa espacios
}


type CreateProductInput = {
  name: string;
  description?: string | null;
  price: number;
  cost?: number | null;
  vat?: number | null;
  providerId?: number | null;
  isActive?: boolean;
};

export async function createProduct(merchantId: number, input: CreateProductInput) {
  return prisma.product.create({
    data: {
      merchantId,
      name: input.name,
      nameSearch: normalizeSearch(input.name),
      description: input.description ?? null,
      price: input.price,
      cost: input.cost ?? null,
      vat: input.vat ?? null,
      providerId: input.providerId ?? null,
      isActive: input.isActive ?? true,
    },
  });
}



export async function listProducts(merchantId: number) {
  return prisma.product.findMany({
    where: { merchantId },
    orderBy: { id: 'desc' },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function exportProductsCsv(merchantId: number) {
  const products = await prisma.product.findMany({
    where: { merchantId },
    orderBy: { id: 'desc' },
    select: {
      name: true,
      description: true,
      price: true,
      vat: true,
      isActive: true,
    },
  });

  const escapeCsv = (v: unknown) => {
    const s = String(v ?? '');
    // SCRUM-339 (bug 3): el separador de ESTE export es `;` (abajo, :78/:88). Un campo que contenga `;`
    // DEBE entrecomillarse o al reimportar parte la fila y desplaza las columnas. Antes solo miraba
    // `,`/`\n`/`"` — nunca el propio separador —, así que exportar→reimportar no era idempotente.
    const needsQuotes = s.includes(';') || s.includes(',') || s.includes('\n') || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const rows: string[] = [];
  rows.push('name;description;price;vat;isActive');

  for (const p of products) {
    rows.push(
      [
        escapeCsv(p.name),
        escapeCsv(p.description ?? ''),
        escapeCsv(p.price),
        escapeCsv(p.vat ?? ''),
        escapeCsv(p.isActive),
      ].join(';'),
    );
  }

  return '\uFEFF' + rows.join('\n');
}



/**
 * SCRUM-339: contrato ALINEADO con POST /admin/customers/import → { created, skipped, errors, errorList }.
 * Antes devolvía { inserted, skippedDuplicates } y skippedDuplicates SOLO contaba el choque P2002: el
 * duplicado normal (findFirst) hacía `continue` mudo, así que 100 filas duplicadas mostraban «0 y 0».
 * Y las filas inválidas (nombre vacío, precio ≤0, IVA fuera de 0..1) se tiraban sin reportar nada.
 */
export async function importProductsCsv(merchantId: number, csv: string) {
  // Bug 4: quita el BOM que antepone nuestro propio export (:92). El `.trim()` de la ruta ya lo mordía
  // (U+FEFF es whitespace), pero el servicio se defiende solo: no depende de quién lo llame.
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    return { created: 0, skipped: 0, errors: 0, errorList: [] as string[] };
  }

  const delimiter = detectarSeparador(lines[0]);
  const header = parsearLineaCsv(lines[0], delimiter).map(s => s.trim().toLowerCase());

  const idxName = header.indexOf('name');
  const idxDesc = header.indexOf('description');
  const idxPrice = header.indexOf('price');
  const idxVat = header.indexOf('vat');
  const idxActive = header.indexOf('isactive');

  if (idxName === -1 || idxPrice === -1) {
    throw new Error('invalid_header');
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const errorList: string[] = [];
  // Como en clientes: errorList se capa a 10; el contador `errors` cuenta TODAS.
  const anota = (msg: string) => { errors++; if (errorList.length < 10) errorList.push(msg); };

  for (let i = 1; i < lines.length; i++) {
    const cols = parsearLineaCsv(lines[i], delimiter); // bug 3: honra comillas

    const name = String(cols[idxName] || '').trim();
    if (!name) { anota(`fila ${i}: nombre vacío`); continue; } // bug 2: antes era continue mudo

    const price = Number(cols[idxPrice]);
    if (!Number.isFinite(price) || price <= 0) { anota(`fila ${i} («${name}»): precio no numérico o ≤ 0`); continue; }

    const nameSearch = normalizeSearch(name);
    const exists = await prisma.product.findFirst({
      where: { merchantId, nameSearch },
      select: { id: true },
    });
    if (exists) { skipped++; continue; } // bug 1: antes era `continue` mudo, no sumaba nada

    const description = idxDesc >= 0 ? String(cols[idxDesc] || '').trim() : null;

    let vat: number | null = null;
    if (idxVat >= 0 && cols[idxVat] !== '') {
      const v = Number(cols[idxVat]);
      if (Number.isFinite(v) && v >= 0 && v <= 1) {
        vat = v;
      } else {
        anota(`fila ${i} («${name}»): IVA fuera de 0..1`); continue; // bug 2
      }
    }

    let isActive = true;
    if (idxActive >= 0) {
      const raw = String(cols[idxActive] ?? '').trim().toLowerCase();
      if (raw === 'false' || raw === '0' || raw === 'no') isActive = false;
      else if (raw === 'true' || raw === '1' || raw === 'si' || raw === 'sí') isActive = true;
    }

    try {
      await prisma.product.create({
        data: {
          merchantId,
          name,
          nameSearch,
          description: description || null,
          price,
          vat,
          isActive,
        },
      });
      created++;
    } catch (err: any) {
      if (err?.code === 'P2002') { skipped++; continue; } // carrera: duplicado por UNIQUE (merchant_id, name_search)
      anota(`«${name}»: ${String(err?.message ?? err).slice(0, 80)}`);
    }
  }

  return { created, skipped, errors, errorList };
}

export async function searchProducts(merchantId: number, q: string) {
  const qn = normalizeSearch(q);

  return prisma.product.findMany({
    where: {
      merchantId,
      nameSearch: { contains: qn },
      isActive: true,
    },
    orderBy: { name: 'asc' },
    take: 10,
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      vat: true,
      providerId: true,
      isActive: true,
    },
    
    
  });
}



export async function getProductById(merchantId: number, id: number) {
  return prisma.product.findFirst({
    where: { id, merchantId },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}


export async function updateProduct(
  merchantId: number,
  id: number,
  data: {
    name?: string;
    description?: string | null;
    price?: number;
    cost?: number | null;
    vat?: number | null;
    providerId?: number | null;
    isActive?: boolean;
  },
) 
 {
  // Multi-tenant: solo actualiza si pertenece al merchant
  const existing = await prisma.product.findFirst({ where: { id, merchantId } });
  const patch: any = { ...data };

  if (typeof data.name !== 'undefined') {
    patch.nameSearch = normalizeSearch(data.name);
  }

  if (!existing) return null;

  return prisma.product.update({
    where: { id },
    data: patch,
  });
}


export async function deleteProduct(merchantId: number, id: number) {
  const existing = await prisma.product.findFirst({ where: { id, merchantId } });
  if (!existing) return null;

  await prisma.product.delete({ where: { id } });
  return { id };
}
