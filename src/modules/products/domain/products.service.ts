// src/modules/products/domain/products.service.ts
import { prisma } from '../../../core/db/prisma';

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
    const needsQuotes = s.includes(',') || s.includes('\n') || s.includes('"');
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


export async function importProductsCsv(merchantId: number, csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    return { inserted: 0, skippedDuplicates: 0 };
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(delimiter).map(s => s.trim().toLowerCase());

  const idxName = header.indexOf('name');
  const idxDesc = header.indexOf('description');
  const idxPrice = header.indexOf('price');
  const idxVat = header.indexOf('vat');
  const idxActive = header.indexOf('isactive');

  if (idxName === -1 || idxPrice === -1) {
    throw new Error('invalid_header');
  }

  let inserted = 0;
  let skippedDuplicates = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);

    const name = String(cols[idxName] || '').trim();
    if (!name) continue;

    const price = Number(cols[idxPrice]);
    if (!Number.isFinite(price) || price <= 0) continue;

        // Evitar duplicados (MVP): si ya existe un producto con el mismo nameSearch en este merchant, lo saltamos
        const nameSearch = normalizeSearch(name);

        const exists = await prisma.product.findFirst({
          where: { merchantId, nameSearch },
          select: { id: true },
        });
    
        if (exists) {
          continue;
        }

    



    const description = idxDesc >= 0 ? String(cols[idxDesc] || '').trim() : null;

    let vat: number | null = null;
if (idxVat >= 0 && cols[idxVat] !== '') {
  const v = Number(cols[idxVat]);
  // VAT en DB es 0..1
  if (Number.isFinite(v) && v >= 0 && v <= 1) {
    vat = v;
  } else {
    continue; // fila inválida -> la saltamos
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
      nameSearch: normalizeSearch(name),
      description: description || null,
      price,
      vat,
      isActive,
    },
  });

  inserted++;
} catch (err: any) {
  // UNIQUE (merchant_id, name_search)
  if (err?.code === "P2002") {
    skippedDuplicates++;
    continue;
  }
  throw err;
}
  }

  return { inserted, skippedDuplicates };
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
