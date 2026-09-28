/**
 * Vlákno výpočtu světla: přímé světlo (slunce, obloha přes okenní otvory, svítidla) a sběr
 * odraženého světla (cosinově vážené paprsky do polokoule, hodnota v zásahu z minulé iterace).
 */
import { parentPort, workerData } from "node:worker_threads";
import { extRadiance, rng, type Job, type Shared } from "./bake-shared";

const S = workerData as Shared;
const P = S.pack;
const idx = P.index;
const EPS = 0.0025;
/** Podíl světla, které projde průsvitnou plochou (záclona) a rozzáří ji z druhé strany. */
const GLOW = 0.6;

// Uzly BVH (formát three-mesh-bvh): 6× float32 obálka, pak offset / pravý potomek a osa nebo počet + příznak listu.
const F32 = new Float32Array(P.bvhRoots[0]), U32 = new Uint32Array(P.bvhRoots[0]), U16 = new Uint16Array(P.bvhRoots[0]);
const TRI = P.tri, SGN = P.triSign;
const stack = new Int32Array(256);

let hFace = -1, hDist = 0, hx = 0, hy = 0, hz = 0, hU = 0, hV = 0, hBack = false;

/** Nejbližší průsečík paprsku do vzdálenosti far (oboustranné trojúhelníky). */
function trace(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, far: number) {
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  let best = far, bt = -1, bu = 0, bv = 0, bdet = 0, sp = 0;
  stack[sp++] = 0;
  while (sp > 0) {
    const n = stack[--sp];
    let t0 = (F32[n] - ox) * ix, t1 = (F32[n + 3] - ox) * ix;
    if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
    let u0 = (F32[n + 1] - oy) * iy, u1 = (F32[n + 4] - oy) * iy;
    if (u0 > u1) { const q = u0; u0 = u1; u1 = q; }
    if (u0 > t0) t0 = u0;
    if (u1 < t1) t1 = u1;
    let w0 = (F32[n + 2] - oz) * iz, w1 = (F32[n + 5] - oz) * iz;
    if (w0 > w1) { const q = w0; w0 = w1; w1 = q; }
    if (w0 > t0) t0 = w0;
    if (w1 < t1) t1 = w1;
    if (t0 > t1 || t1 < 0 || t0 > best) continue;
    const n16 = n * 2;
    if (U16[n16 + 15] === 0xffff) {
      const off = U32[n + 6], end = off + U16[n16 + 14];
      for (let t = off; t < end; t++) {
        const b = t * 9;
        const e1x = TRI[b + 3], e1y = TRI[b + 4], e1z = TRI[b + 5], e2x = TRI[b + 6], e2y = TRI[b + 7], e2z = TRI[b + 8];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-14 && det < 1e-14) continue;
        const inv = 1 / det;
        const sx = ox - TRI[b], sy = oy - TRI[b + 1], sz = oz - TRI[b + 2];
        const u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (tt > 1e-7 && tt < best) { best = tt; bt = t; bu = u; bv = v; bdet = det; }
      }
    } else {
      const left = n + 8, right = n + U32[n + 6] * 8, axis = U32[n + 7];
      const neg = axis === 0 ? dx < 0 : axis === 1 ? dy < 0 : dz < 0;
      if (neg) { stack[sp++] = left; stack[sp++] = right; } else { stack[sp++] = right; stack[sp++] = left; }
    }
  }
  if (bt < 0) return false;
  hFace = bt; hDist = best; hU = bu; hV = bv;
  hx = ox + dx * best; hy = oy + dy * best; hz = oz + dz * best;
  hBack = SGN[bt] * bdet < 0;
  return true;
}

/** Propustnost paprsku (0 = zastíněno), průsvitné plochy ho jen zeslabí. */
function visibility(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, far: number) {
  let v = 1, t = 0;
  for (let k = 0; k < 6; k++) {
    if (!trace(ox + dx * t, oy + dy * t, oz + dz * t, dx, dy, dz, far - t)) return v;
    const tr = P.mTransmit[P.vMesh[idx[hFace * 3]]];
    if (tr <= 0) return 0;
    v *= tr;
    if (v < 0.02) return 0;
    t += hDist + EPS;
    if (t >= far) return v;
  }
  return v;
}

/** Ozáření z minulé iterace v místě zásahu (lightmapa přes UV, vrcholy barycentricky). */
function hitE(out: Float64Array): boolean {
  const a = idx[hFace * 3], b = idx[hFace * 3 + 1], c = idx[hFace * 3 + 2];
  const wb = hU, wc = hV, wa = Math.max(0, 1 - wb - wc);
  const E = S.ePrev;
  if (P.vPoint[a] < 0) {
    const u = wa * P.vUV[a * 2] + wb * P.vUV[b * 2] + wc * P.vUV[c * 2];
    const v = wa * P.vUV[a * 2 + 1] + wb * P.vUV[b * 2 + 1] + wc * P.vUV[c * 2 + 1];
    const tx = Math.min(P.atlasW - 1, Math.max(0, Math.floor(u * P.atlasW))), ty = Math.min(P.atlasH - 1, Math.max(0, Math.floor(v * P.atlasH)));
    const p = P.texelPoint[ty * P.atlasW + tx];
    if (p < 0) return false;
    out[0] = E[p * 3]; out[1] = E[p * 3 + 1]; out[2] = E[p * 3 + 2];
    return true;
  }
  let sw = 0;
  out[0] = out[1] = out[2] = 0;
  for (const [vi, w] of [[a, wa], [b, wb], [c, wc]] as const) {
    const p = P.vPoint[vi];
    if (S.invalid[p]) continue;
    out[0] += E[p * 3] * w; out[1] += E[p * 3 + 1] * w; out[2] += E[p * 3 + 2] * w;
    sw += w;
  }
  if (sw < 1e-4) return false;
  out[0] /= sw; out[1] /= sw; out[2] /= sw;
  return true;
}

/** Ortonormální báze kolem normály. */
function basis(nx: number, ny: number, nz: number, t: number[], b: number[]) {
  const s = nz >= 0 ? 1 : -1;
  const a = -1 / (s + nz), bb = nx * ny * a;
  t[0] = 1 + s * nx * nx * a; t[1] = s * bb; t[2] = -s * nx;
  b[0] = bb; b[1] = s + ny * ny * a; b[2] = -ny;
}

const T = [0, 0, 0], B = [0, 0, 0], L = [0, 0, 0];
const He = new Float64Array(3);
const SU = [0, 0, 0], SV = [0, 0, 0];
if (P.sun) basis(P.sun.dir[0], P.sun.dir[1], P.sun.dir[2], SU, SV);

function direct(i: number, R: () => number) {
  const px = P.pPos[i * 3], py = P.pPos[i * 3 + 1], pz = P.pPos[i * 3 + 2];
  const nx = P.pNor[i * 3], ny = P.pNor[i * 3 + 1], nz = P.pNor[i * 3 + 2];
  const two = P.pTwo[i] === 1;
  basis(nx, ny, nz, T, B);
  const ox = px + nx * EPS, oy = py + ny * EPS, oz = pz + nz * EPS;
  // Vzorek uvnitř jiného tělesa (dotyk dílů) — hodnotu později doplní sousedé.
  let back = 0;
  const PR = 16;
  for (let k = 0; k < PR; k++) {
    const u1 = (k + R()) / PR, u2 = R();
    const r = Math.sqrt(u1), ph = 2 * Math.PI * u2, cz = Math.sqrt(1 - u1);
    const dx = T[0] * r * Math.cos(ph) + B[0] * r * Math.sin(ph) + nx * cz;
    const dy = T[1] * r * Math.cos(ph) + B[1] * r * Math.sin(ph) + ny * cz;
    const dz = T[2] * r * Math.cos(ph) + B[2] * r * Math.sin(ph) + nz * cz;
    if (trace(ox, oy, oz, dx, dy, dz, 0.3) && hBack && !P.mTwoSided[P.vMesh[idx[hFace * 3]]]) back++;
  }
  S.invalid[i] = !two && back >= PR * 0.25 ? 1 : 0;
  if (S.invalid[i]) {
    for (let k = 0; k < 3; k++) { S.eDirect[i * 3 + k] = 0; S.eSunFront[i * 3 + k] = 0; S.eSun[i * 3 + k] = 0; }
    return;
  }

  let er = 0, eg = 0, eb = 0, sr = 0, sg = 0, sb = 0, ar = 0, ag = 0, ab = 0;
  // Jak silně bod přijímá světlo ze směru d (u záclon i zezadu, zeslabeně).
  const recv = (dx: number, dy: number, dz: number) => { const c = dx * nx + dy * ny + dz * nz; return c > 0 ? c : two ? -c * GLOW : 0; };
  const orig = (dx: number, dy: number, dz: number, out: number[]) => {
    const s = dx * nx + dy * ny + dz * nz >= 0 ? 1 : -1;
    out[0] = px + nx * EPS * s; out[1] = py + ny * EPS * s; out[2] = pz + nz * EPS * s;
  };
  const O = [0, 0, 0];

  const sun = P.sun;
  if (sun) {
    const K = 3;
    for (let k = 0; k < K; k++) {
      // Náhodný směr v disku slunce.
      const a = 2 * Math.PI * R(), rr = sun.radius * Math.sqrt(R());
      let dx = sun.dir[0] + (SU[0] * Math.cos(a) + SV[0] * Math.sin(a)) * rr;
      let dy = sun.dir[1] + (SU[1] * Math.cos(a) + SV[1] * Math.sin(a)) * rr;
      let dz = sun.dir[2] + (SU[2] * Math.cos(a) + SV[2] * Math.sin(a)) * rr;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const c = recv(dx, dy, dz);
      if (c <= 0) continue;
      orig(dx, dy, dz, O);
      const vis = visibility(O[0], O[1], O[2], dx, dy, dz, 60);
      if (vis <= 0) continue;
      const w = (c * vis) / K;
      const front = dx * nx + dy * ny + dz * nz > 0;
      er += sun.e[0] * w; eg += sun.e[1] * w; eb += sun.e[2] * w;
      ar += sun.e[0] * w; ag += sun.e[1] * w; ab += sun.e[2] * w;
      if (front) { sr += sun.e[0] * w; sg += sun.e[1] * w; sb += sun.e[2] * w; }
    }
  }

  for (const e of P.emitters) {
    const cx = e.pos[0] - px, cy = e.pos[1] - py, cz = e.pos[2] - pz;
    const d2c = cx * cx + cy * cy + cz * cz;
    if ((e.intensity / Math.max(d2c, 0.01)) < 0.003) continue;
    const K = 2;
    for (let k = 0; k < K; k++) {
      // Bod v kouli zdroje.
      let qx: number, qy: number, qz: number;
      do { qx = R() * 2 - 1; qy = R() * 2 - 1; qz = R() * 2 - 1; } while (qx * qx + qy * qy + qz * qz > 1);
      let dx = cx + qx * e.radius, dy = cy + qy * e.radius, dz = cz + qz * e.radius;
      const d2 = dx * dx + dy * dy + dz * dz, dist = Math.sqrt(d2);
      dx /= dist; dy /= dist; dz /= dist;
      const c = recv(dx, dy, dz);
      if (c <= 0) continue;
      let prof = 1;
      if (e.dir) { const cd = -(dx * e.dir[0] + dy * e.dir[1] + dz * e.dir[2]); if (cd <= 0) continue; prof = Math.pow(cd, e.exp); }
      orig(dx, dy, dz, O);
      const vis = visibility(O[0], O[1], O[2], dx, dy, dz, dist - 0.01);
      if (vis <= 0) continue;
      const w = (e.intensity * prof * c * vis) / (Math.max(d2, 0.02) * K);
      er += e.color[0] * w; eg += e.color[1] * w; eb += e.color[2] * w;
    }
  }

  const M = 4; // 4 × 4 vzorků na okno
  for (const pt of P.portals) {
    if ((px - pt.o[0]) * pt.n[0] + (py - pt.o[1]) * pt.n[1] + (pz - pt.o[2]) * pt.n[2] <= 0.001) continue;
    // Zkušební 2 × 2 paprsky: okno zakryté stěnou jiné místnosti se dál nevzorkuje.
    let seen = false;
    for (let k = 0; k < 4 && !seen; k++) {
      const dx = pt.o[0] + pt.u[0] * (0.25 + 0.5 * (k & 1)) + pt.v[0] * (0.25 + 0.5 * (k >> 1)) - px;
      const dy = pt.o[1] + pt.u[1] * (0.25 + 0.5 * (k & 1)) + pt.v[1] * (0.25 + 0.5 * (k >> 1)) - py;
      const dz = pt.o[2] + pt.u[2] * (0.25 + 0.5 * (k & 1)) + pt.v[2] * (0.25 + 0.5 * (k >> 1)) - pz;
      const dist = Math.hypot(dx, dy, dz);
      orig(dx, dy, dz, O);
      if (visibility(O[0], O[1], O[2], dx / dist, dy / dist, dz / dist, dist - 0.004) > 0) seen = true;
    }
    if (!seen) continue;
    for (let a = 0; a < M; a++) for (let b = 0; b < M; b++) {
      const sa = (a + R()) / M, sb = (b + R()) / M;
      let dx = pt.o[0] + pt.u[0] * sa + pt.v[0] * sb - px;
      let dy = pt.o[1] + pt.u[1] * sa + pt.v[1] * sb - py;
      let dz = pt.o[2] + pt.u[2] * sa + pt.v[2] * sb - pz;
      const d2 = dx * dx + dy * dy + dz * dz, dist = Math.sqrt(d2);
      dx /= dist; dy /= dist; dz /= dist;
      const c = recv(dx, dy, dz);
      if (c <= 0) continue;
      const cq = -(dx * pt.n[0] + dy * pt.n[1] + dz * pt.n[2]);
      if (cq <= 0) continue;
      orig(dx, dy, dz, O);
      const vis = visibility(O[0], O[1], O[2], dx, dy, dz, dist - 0.004);
      if (vis <= 0) continue;
      extRadiance(P.ext, dx, dy, dz, L);
      const w = (c * cq * pt.area * vis) / (M * M * Math.max(d2, 0.01));
      er += L[0] * w; eg += L[1] * w; eb += L[2] * w;
    }
  }
  S.eDirect[i * 3] = er; S.eDirect[i * 3 + 1] = eg; S.eDirect[i * 3 + 2] = eb;
  S.eSunFront[i * 3] = sr; S.eSunFront[i * 3 + 1] = sg; S.eSunFront[i * 3 + 2] = sb;
  S.eSun[i * 3] = ar; S.eSun[i * 3 + 1] = ag; S.eSun[i * 3 + 2] = ab;
}

function gather(i: number, R: () => number, rays: number, final: boolean) {
  const o3 = i * 3;
  if (S.invalid[i]) { S.eNext[o3] = S.eDirect[o3]; S.eNext[o3 + 1] = S.eDirect[o3 + 1]; S.eNext[o3 + 2] = S.eDirect[o3 + 2]; return; }
  const px = P.pPos[o3], py = P.pPos[o3 + 1], pz = P.pPos[o3 + 2];
  const nx = P.pNor[o3], ny = P.pNor[o3 + 1], nz = P.pNor[o3 + 2];
  const two = P.pTwo[i] === 1;
  basis(nx, ny, nz, T, B);
  const g = Math.round(Math.sqrt(rays));
  const N = g * g;
  let er = 0, eg = 0, eb = 0, fr = 0, fg = 0, fb = 0, wr = 0, wg = 0, wb = 0;
  for (let k = 0; k < N; k++) {
    const u1 = (Math.floor(k / g) + R()) / g, u2 = ((k % g) + R()) / g;
    const r = Math.sqrt(u1), ph = 2 * Math.PI * u2, cz = Math.sqrt(1 - u1);
    // Záclona: každý druhý paprsek do zadní polokoule (zeslabený).
    const side = two && (k & 1) ? -1 : 1;
    const wgt = side < 0 ? GLOW * 2 : two ? 2 : 1;
    let dx = T[0] * r * Math.cos(ph) + B[0] * r * Math.sin(ph) + nx * cz * side;
    let dy = T[1] * r * Math.cos(ph) + B[1] * r * Math.sin(ph) + ny * cz * side;
    let dz = T[2] * r * Math.cos(ph) + B[2] * r * Math.sin(ph) + nz * cz * side;
    const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    let ox = px + nx * EPS * side, oy = py + ny * EPS * side, oz = pz + nz * EPS * side;
    for (let hop = 0; hop < 4; hop++) {
      if (!trace(ox, oy, oz, dx, dy, dz, 40)) break;
      const mesh = P.vMesh[idx[hFace * 3]];
      const tr = P.mTransmit[mesh];
      if (tr > 0 && R() < tr) { ox = hx + dx * EPS; oy = hy + dy * EPS; oz = hz + dz * EPS; continue; }
      if (hBack && !P.mTwoSided[mesh]) break;
      if (!hitE(He)) break;
      const ar = P.mAlbedo[mesh * 3], ag = P.mAlbedo[mesh * 3 + 1], ab = P.mAlbedo[mesh * 3 + 2];
      er += ar * He[0] * wgt; eg += ag * He[1] * wgt; eb += ab * He[2] * wgt;
      if (final) {
        const grp = P.mGroup[mesh];
        if (grp === 1) { fr += He[0] * wgt; fg += He[1] * wgt; fb += He[2] * wgt; }
        else if (grp === 2) { wr += He[0] * wgt; wg += He[1] * wgt; wb += He[2] * wgt; }
      }
      break;
    }
  }
  er /= N; eg /= N; eb /= N; fr /= N; fg /= N; fb /= N; wr /= N; wg /= N; wb /= N;

  // Odraz od slunečních skvrn: přímé vzorkování míst osvětlených sluncem.
  const Bt = S.bright;
  if (Bt && Bt.W > 0) {
    const K = final ? 64 : 24;
    const room = P.pRoom[i];
    const hasRoom = room >= 0 && Bt.roomW[room] > 0;
    for (let k = 0; k < K; k++) {
      let b: number;
      if (hasRoom && R() < 0.75) b = Bt.roomList[pick(Bt.roomCdf, Bt.roomStart[room], Bt.roomStart[room + 1], R())];
      else b = pick(Bt.cdf, 0, Bt.idx.length, R());
      const pg = Bt.w[b] / Bt.W;
      const pdf = hasRoom ? 0.75 * (Bt.room[b] === room ? Bt.w[b] / Bt.roomW[room] : 0) + 0.25 * pg : pg;
      if (pdf <= 0) continue;
      const q = Bt.idx[b];
      let dx = P.pPos[q * 3] - px, dy = P.pPos[q * 3 + 1] - py, dz = P.pPos[q * 3 + 2] - pz;
      const d2 = dx * dx + dy * dy + dz * dz, dist = Math.sqrt(d2);
      if (dist < 1e-4) continue;
      dx /= dist; dy /= dist; dz /= dist;
      let cp = dx * nx + dy * ny + dz * nz;
      if (cp <= 0) { if (!two) continue; cp = -cp * GLOW; }
      let cq = -(dx * P.pNor[q * 3] + dy * P.pNor[q * 3 + 1] + dz * P.pNor[q * 3 + 2]);
      if (cq <= 0) { if (!P.pTwo[q]) continue; cq = -cq; }
      const s = dx * nx + dy * ny + dz * nz >= 0 ? 1 : -1;
      const vis = visibility(px + nx * EPS * s, py + ny * EPS * s, pz + nz * EPS * s, dx, dy, dz, dist - 0.006);
      if (vis <= 0) continue;
      const g = (cp * cq * P.pArea[q] * vis) / (Math.max(d2, 0.012) * pdf * K);
      er += Bt.L[b * 3] * g; eg += Bt.L[b * 3 + 1] * g; eb += Bt.L[b * 3 + 2] * g;
      if (final) {
        const grp = P.mGroup[P.pMesh[q]];
        const ge = g / Math.PI;
        if (grp === 1) { fr += Bt.E[b * 3] * ge; fg += Bt.E[b * 3 + 1] * ge; fb += Bt.E[b * 3 + 2] * ge; }
        else if (grp === 2) { wr += Bt.E[b * 3] * ge; wg += Bt.E[b * 3 + 1] * ge; wb += Bt.E[b * 3 + 2] * ge; }
      }
    }
  }
  S.eNext[o3] = S.eDirect[o3] + er; S.eNext[o3 + 1] = S.eDirect[o3 + 1] + eg; S.eNext[o3 + 2] = S.eDirect[o3 + 2] + eb;
  if (final) {
    S.dF[o3] = fr; S.dF[o3 + 1] = fg; S.dF[o3 + 2] = fb;
    S.dW[o3] = wr; S.dW[o3 + 1] = wg; S.dW[o3 + 2] = wb;
  }
}

/** Index v kumulativním rozdělení cdf[from..to) pro náhodné u ∈ [0, 1). */
function pick(cdf: Float64Array, from: number, to: number, u: number) {
  let lo = from, hi = to - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
  return lo;
}

parentPort!.on("message", (job: Job) => {
  for (let i = job.from; i < job.to; i++) {
    const R = rng(job.seed * 7919 + i * 104729);
    if (job.kind === "direct") direct(i, R);
    else gather(i, R, job.rays, job.final);
  }
  parentPort!.postMessage({ done: job.to - job.from });
});
