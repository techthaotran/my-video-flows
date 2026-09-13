/** Hash inputs + node config for output cache reuse */

export async function hashValue(value: unknown): Promise<string> {
  const json = JSON.stringify(value, (_, v) => {
    if (v instanceof Blob) return { __blob: true, size: v.size, type: v.type };
    return v;
  });
  const data = new TextEncoder().encode(json);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeInputHash(
  nodeData: unknown,
  inputs: Record<string, { kind: string; text?: string; outputId?: string; size?: number }[]>,
): Promise<string> {
  return hashValue({ nodeData, inputs });
}
