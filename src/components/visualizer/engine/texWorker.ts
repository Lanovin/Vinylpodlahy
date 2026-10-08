import { runJob, type TextureJob, type TextureResult } from "./textureGen";

/**
 * Web Worker: generuje procedurální textury modelového bytu mimo hlavní vlákno. Dostane seznam úloh,
 * každý hotový výsledek posílá hned (pixely se předávají bez kopírování).
 */
const ctx = self as unknown as { onmessage: ((e: MessageEvent<TextureJob[]>) => void) | null; postMessage(m: TextureResult, transfer: Transferable[]): void };

ctx.onmessage = (e) => {
  for (const job of e.data) {
    const set = runJob(job);
    const transfer: Transferable[] = [];
    for (const t of Object.values(set)) if (t) transfer.push(t.data.buffer);
    ctx.postMessage({ key: job.key, set }, transfer);
  }
};
