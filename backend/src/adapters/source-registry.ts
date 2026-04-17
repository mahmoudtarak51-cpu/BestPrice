import type { SourceAdapter } from './base/source-adapter.js';
import { createRetailerAAdapter } from './retailer-a/adapter.js';
import { createRetailerBAdapter } from './retailer-b/adapter.js';

export class SourceRegistry {
  readonly #adapters = new Map<string, SourceAdapter>();

  register(adapter: SourceAdapter): this {
    if (this.#adapters.has(adapter.key)) {
      throw new Error(`Source adapter "${adapter.key}" is already registered.`);
    }

    this.#adapters.set(adapter.key, adapter);
    return this;
  }

  registerMany(adapters: Iterable<SourceAdapter>): this {
    for (const adapter of adapters) {
      this.register(adapter);
    }

    return this;
  }

  get(adapterKey: string): SourceAdapter {
    const adapter = this.#adapters.get(adapterKey);

    if (!adapter) {
      throw new Error(`Unknown source adapter "${adapterKey}".`);
    }

    return adapter;
  }

  maybeGet(adapterKey: string): SourceAdapter | undefined {
    return this.#adapters.get(adapterKey);
  }

  has(adapterKey: string): boolean {
    return this.#adapters.has(adapterKey);
  }

  list(): SourceAdapter[] {
    return [...this.#adapters.values()];
  }

  keys(): string[] {
    return [...this.#adapters.keys()];
  }
}

export function createSourceRegistry(
  adapters: Iterable<SourceAdapter> = [],
): SourceRegistry {
  return new SourceRegistry().registerMany(adapters);
}

export function createDefaultSourceRegistry(): SourceRegistry {
  return createSourceRegistry([createRetailerAAdapter(), createRetailerBAdapter()]);
}

export const sourceRegistry = createDefaultSourceRegistry();
