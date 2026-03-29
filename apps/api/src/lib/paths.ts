import path from "node:path";

/**
 * Returns true if `filePath` is the same as `rootPath` or is nested under it (no path traversal).
 */
export function isPathUnderRoot(filePath: string, rootPath: string): boolean {
  const resolvedFile = path.resolve(filePath);
  const resolvedRoot = path.resolve(rootPath);
  if (resolvedFile === resolvedRoot) {
    return true;
  }
  const relative = path.relative(resolvedRoot, resolvedFile);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

export function normalizeFsPath(p: string): string {
  return path.resolve(path.normalize(p));
}
