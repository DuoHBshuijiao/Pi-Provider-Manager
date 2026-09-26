export type PathSeg = string | number;

export function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function asIndex(seg: PathSeg): number | undefined {
  if (typeof seg === "number") {
    return Number.isInteger(seg) && seg >= 0 ? seg : undefined;
  }
  if (/^\d+$/.test(seg)) return Number(seg);
  return undefined;
}

export function getAt(root: unknown, path: PathSeg[]): unknown {
  let current: unknown = root;
  for (const seg of path) {
    if (current == null || typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      const index = asIndex(seg);
      if (index === undefined || index >= current.length) return undefined;
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[String(seg)];
    }
  }
  return current;
}

function ensureContainer(parent: Record<string, unknown> | unknown[], seg: PathSeg, nextIsIndex: boolean): unknown {
  if (Array.isArray(parent)) {
    const index = asIndex(seg);
    if (index === undefined) {
      throw new Error("数组路径段必须是非负整数");
    }
    if (parent[index] == null || typeof parent[index] !== "object") {
      parent[index] = nextIsIndex ? [] : {};
    }
    return parent[index];
  }
  const key = String(seg);
  const existing = parent[key];
  if (existing == null || typeof existing !== "object") {
    parent[key] = nextIsIndex ? [] : {};
  }
  return parent[key];
}

const DELETE = Symbol("delete");

export function setAt<T>(root: T, path: PathSeg[], value: unknown): T {
  if (path.length === 0) return cloneJson(value as T);
  const clone = cloneJson(root);
  let cursor: unknown = clone;
  for (let i = 0; i < path.length - 1; i += 1) {
    if (cursor == null || typeof cursor !== "object") {
      throw new Error(`无法写入路径 ${path.join(".")}`);
    }
    const nextSeg = path[i + 1];
    const nextIsIndex = asIndex(nextSeg) !== undefined;
    cursor = ensureContainer(cursor as Record<string, unknown> | unknown[], path[i]!, nextIsIndex);
  }
  if (cursor == null || typeof cursor !== "object") {
    throw new Error(`无法写入路径 ${path.join(".")}`);
  }
  const last = path[path.length - 1]!;
  if (Array.isArray(cursor)) {
    const index = asIndex(last);
    if (index === undefined) throw new Error("数组路径段必须是非负整数");
    if (value === DELETE) {
      if (index < cursor.length) cursor[index] = undefined;
    } else {
      cursor[index] = value;
    }
  } else {
    const record = cursor as Record<string, unknown>;
    const key = String(last);
    if (value === DELETE) delete record[key];
    else record[key] = value;
  }
  if (value === DELETE) pruneEmptyContainers(clone, path.slice(0, -1));
  return clone;
}

export function deleteAt<T>(root: T, path: PathSeg[]): T {
  return setAt(root, path, DELETE);
}

const PRUNE_KEYS = new Set(["compat", "promptCache"]);

function pruneEmptyContainers(root: unknown, path: PathSeg[]): void {
  for (let depth = path.length; depth > 0; depth -= 1) {
    const parentPath = path.slice(0, depth);
    const container = getAt(root, parentPath);
    if (!container || typeof container !== "object" || Array.isArray(container)) continue;
    const record = container as Record<string, unknown>;
    const key = String(path[depth - 1]);
    if (!PRUNE_KEYS.has(key)) continue;
    if (Object.keys(record).length === 0) {
      const parent = depth === 1 ? root : getAt(root, path.slice(0, depth - 1));
      if (parent && typeof parent === "object" && !Array.isArray(parent)) {
        delete (parent as Record<string, unknown>)[key];
      }
    }
  }
}
