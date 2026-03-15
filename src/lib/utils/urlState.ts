import type { BuildState, WantedNode } from '$lib/types';
import { skillNodes, skillNodeMap } from '$lib/data/skillData';

const NODE_IDS = skillNodes.map((node) => node.id);
const OR_NODE_IDS = skillNodes
  .filter((node) => node.prerequisiteNodeIds.length >= 2)
  .map((node) => node.id);

const BITS_FOR_EXPEDITION = 5;
const BITS_PER_WANTED_FLAG = 1;
const BITS_PER_WANTED_TARGET = 3;
const BITS_PER_OVERRIDE_FLAG = 1;
const BITS_PER_OVERRIDE_CHOICE = 1;

class BitWriter {
  private bytes: number[] = [];
  private bitIndex = 0;

  write(value: number, bits: number): void {
    for (let offset = bits - 1; offset >= 0; offset -= 1) {
      const nextBit = (value >> offset) & 1;
      const byteIndex = Math.floor(this.bitIndex / 8);
      const bitInByte = 7 - (this.bitIndex % 8);
      if (this.bytes[byteIndex] === undefined) this.bytes[byteIndex] = 0;
      this.bytes[byteIndex] |= nextBit << bitInByte;
      this.bitIndex += 1;
    }
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

class BitReader {
  private bitIndex = 0;

  constructor(private readonly bytes: Uint8Array) {}

  read(bits: number): number | null {
    if (this.bitIndex + bits > this.bytes.length * 8) return null;

    let value = 0;
    for (let i = 0; i < bits; i += 1) {
      const byteIndex = Math.floor(this.bitIndex / 8);
      const bitInByte = 7 - (this.bitIndex % 8);
      const bit = (this.bytes[byteIndex] >> bitInByte) & 1;
      value = (value << 1) | bit;
      this.bitIndex += 1;
    }

    return value;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let base64: string;
  const maybeBuffer = (globalThis as { Buffer?: { from: (source: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;

  if (maybeBuffer) {
    base64 = maybeBuffer.from(bytes).toString('base64');
  } else {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    base64 = btoa(binary);
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!value) return null;

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');

  try {
    const maybeBuffer = (globalThis as {
      Buffer?: { from: (source: string, encoding: string) => Uint8Array };
    }).Buffer;

    if (maybeBuffer) {
      return Uint8Array.from(maybeBuffer.from(base64, 'base64'));
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function encodeBuildState(state: BuildState): string {
  const writer = new BitWriter();

  const bonus = Math.max(0, Math.min(31, state.expeditionBonus));
  writer.write(bonus, BITS_FOR_EXPEDITION);

  const wantedById = new Map<string, WantedNode>(state.wantedNodes.map((wanted) => [wanted.skillId, wanted]));

  for (const nodeId of NODE_IDS) {
    writer.write(wantedById.has(nodeId) ? 1 : 0, BITS_PER_WANTED_FLAG);
  }

  for (const nodeId of NODE_IDS) {
    const wanted = wantedById.get(nodeId);
    if (!wanted) continue;

    const node = skillNodeMap.get(nodeId);
    if (!node) {
      writer.write(0, BITS_PER_WANTED_TARGET);
      continue;
    }

    const target = Math.max(0, Math.min(node.maxPoints, wanted.targetLevel));
    writer.write(target, BITS_PER_WANTED_TARGET);
  }

  const overrides: Map<string, number> = (state as BuildState & { pathOverrides?: Map<string, number> }).pathOverrides ?? new Map();
  for (const orId of OR_NODE_IDS) {
    const hasOverride = overrides.has(orId);
    writer.write(hasOverride ? 1 : 0, BITS_PER_OVERRIDE_FLAG);
    if (hasOverride) {
      writer.write(overrides.get(orId)! & 1, BITS_PER_OVERRIDE_CHOICE);
    }
  }

  return toBase64Url(writer.toUint8Array());
}

export function decodeBuildState(hash: string): BuildState | null {
  const cleanedHash = hash.replace(/^#/, '');
  const bytes = fromBase64Url(cleanedHash);
  if (!bytes) return null;

  const reader = new BitReader(bytes);

  const expeditionBonus = reader.read(BITS_FOR_EXPEDITION);
  if (expeditionBonus === null || expeditionBonus > 25) return null;

  const wantedFlags: boolean[] = [];
  for (let i = 0; i < NODE_IDS.length; i += 1) {
    const flag = reader.read(BITS_PER_WANTED_FLAG);
    if (flag === null || (flag !== 0 && flag !== 1)) return null;
    wantedFlags.push(flag === 1);
  }

  const wantedNodes: WantedNode[] = [];
  for (let i = 0; i < NODE_IDS.length; i += 1) {
    if (!wantedFlags[i]) continue;

    const targetLevel = reader.read(BITS_PER_WANTED_TARGET);
    if (targetLevel === null) return null;

    const nodeId = NODE_IDS[i];
    const node = skillNodeMap.get(nodeId);
    if (!node) return null;
    if (targetLevel < 1 || targetLevel > node.maxPoints) return null;

    wantedNodes.push({ skillId: nodeId, targetLevel });
  }

  const pathOverrides = new Map<string, number>();
  for (const orId of OR_NODE_IDS) {
    const flag = reader.read(BITS_PER_OVERRIDE_FLAG);
    if (flag === null) break;
    if (flag === 1) {
      const choice = reader.read(BITS_PER_OVERRIDE_CHOICE);
      if (choice !== null) {
        pathOverrides.set(orId, choice);
      }
    }
  }

  return {
    allocations: {},
    wantedNodes,
    expeditionBonus,
    pathOverrides,
  };
}

export function syncToUrl(state: BuildState): void {
  if (typeof window === 'undefined') return;
  const encoded = encodeBuildState(state);
  const nextHash = '#' + encoded;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + nextHash);
}

export function loadFromUrl(): BuildState | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return null;
  return decodeBuildState(hash);
}
