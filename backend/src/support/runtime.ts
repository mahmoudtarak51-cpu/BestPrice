import { fileURLToPath } from 'node:url';

export function isMainModule(metaUrl: string): boolean {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return false;
  }

  return fileURLToPath(metaUrl) === entrypoint;
}
