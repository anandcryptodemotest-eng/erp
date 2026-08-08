import type { IdentityProvider } from "./identity-provider";

/**
 * Identity provider registry.
 *
 * Register future providers (microsoft, apple, saml) here. lookup() returns
 * undefined when a provider isn't configured so callers can fail gracefully.
 *
 * Platform-specific providers (Google, Microsoft, etc.) are registered at
 * runtime by the consuming application — they are NOT auto-registered from the
 * shared package to avoid pulling Node.js-native dependencies into Next.js
 * webpack bundles.
 */
class IdentityProviderRegistry {
  private providers = new Map<string, IdentityProvider>();

  register(provider: IdentityProvider): void {
    this.providers.set(provider.name, provider);
  }

  lookup(name: string): IdentityProvider | undefined {
    return this.providers.get(name);
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}

let registry: IdentityProviderRegistry | null = null;

export function getIdentityProviderRegistry(): IdentityProviderRegistry {
  if (registry) return registry;
  registry = new IdentityProviderRegistry();
  return registry;
}

export function getIdentityProvider(name: string): IdentityProvider | undefined {
  return getIdentityProviderRegistry().lookup(name);
}

export type { IdentityProvider };
export type { VerifiedIdentity } from "./identity-provider";
