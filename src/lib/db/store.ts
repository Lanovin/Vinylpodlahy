import fs from "node:fs";
import path from "node:path";

/**
 * Jednoduché souborové JSON úložiště.
 * Každá kolekce = jeden soubor v /data. Repozitáře v repos.ts jsou jediné místo,
 * které úložiště používá — výměna za Postgres/Prisma znamená přepsat jen repos.ts.
 */
export const DATA_DIR = path.join(process.cwd(), "data");

const cache = new Map<string, { mtimeMs: number; value: unknown }>();

function fileFor(collection: string) {
  return path.join(DATA_DIR, `${collection}.json`);
}

export function readCollection<T>(collection: string, fallback: T): T {
  const file = fileFor(collection);
  try {
    const stat = fs.statSync(file);
    const hit = cache.get(collection);
    if (hit && hit.mtimeMs === stat.mtimeMs) return hit.value as T;
    const raw = fs.readFileSync(file, "utf8");
    const value = JSON.parse(raw) as T;
    cache.set(collection, { mtimeMs: stat.mtimeMs, value });
    return value;
  } catch {
    return fallback;
  }
}

export function writeCollection<T>(collection: string, value: T): void {
  const file = fileFor(collection);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
  cache.delete(collection);
}

export function updateCollection<T>(collection: string, fallback: T, fn: (current: T) => T): T {
  const next = fn(readCollection<T>(collection, fallback));
  writeCollection(collection, next);
  return next;
}

export function newId(prefix = ""): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return prefix ? `${prefix}_${ts}${rnd}` : `${ts}${rnd}`;
}

export function nowIso() {
  return new Date().toISOString();
}
