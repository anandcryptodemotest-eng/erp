import type { ServiceEvent, ModuleId } from "@erp/types";

// Service port map — kept here to avoid circular import with index.ts
const SERVICE_PORTS: Record<string, number> = {
  core: 3000, sales: 3001, inventory: 3002, accounting: 3003, hr: 3004, procurement: 3005,
};

function getServiceUrl(moduleId: ModuleId): string {
  const baseUrl = process.env[`${moduleId.toUpperCase()}_SERVICE_URL`];
  return baseUrl || `http://localhost:${SERVICE_PORTS[moduleId] ?? 3000}`;
}

/**
 * Inter-service HTTP client for service-to-service communication.
 * In production, replace with a message queue (RabbitMQ, Kafka, etc.)
 */
export class ServiceClient {
  private serviceSecret: string;

  constructor() {
    this.serviceSecret = process.env.SERVICE_SECRET || "dev-service-secret";
  }

  /**
   * Call another service's API endpoint
   */
  async call<T>(
    targetService: ModuleId,
    path: string,
    options: {
      method?: string;
      body?: unknown;
      tenantId?: string;
      userId?: string;
    } = {}
  ): Promise<{ data?: T; error?: string; status: number }> {
    const baseUrl = getServiceUrl(targetService);
    const url = `${baseUrl}${path}`;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-service-key": this.serviceSecret,
      };

      if (options.tenantId) headers["x-tenant-id"] = options.tenantId;
      if (options.userId) headers["x-user-id"] = options.userId;

      const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      console.error(`[ServiceClient] Error calling ${targetService}:${path}`, error);
      return { error: `Service ${targetService} unavailable`, status: 503 };
    }
  }

  /**
   * Emit an event to relevant services (simple HTTP-based event bus)
   * In production, use a proper message broker.
   */
  async emit(event: ServiceEvent, targetServices: ModuleId[]): Promise<void> {
    const promises = targetServices.map((service) =>
      this.call(service, "/api/events", {
        method: "POST",
        body: event,
      }).catch((err) => {
        console.error(`[EventBus] Failed to deliver event to ${service}:`, err);
      })
    );

    await Promise.allSettled(promises);
  }
}

// Singleton instance
export const serviceClient = new ServiceClient();
