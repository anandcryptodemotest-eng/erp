import { Card, CardContent, CardHeader, CardTitle } from "@erp/ui";
import Link from "next/link";

const modules = [
  { id: "sales", name: "Sales & CRM", port: 3001, color: "blue" },
  { id: "inventory", name: "Inventory", port: 3002, color: "green" },
  { id: "accounting", name: "Accounting", port: 3003, color: "purple" },
  { id: "hr", name: "HR & Payroll", port: 3004, color: "orange" },
  { id: "procurement", name: "Procurement", port: 3005, color: "teal" },
];

export default function GatewayHome() {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ERP Gateway</h1>
        <p className="mt-2 text-gray-600">
          Microservices API Gateway — Each module runs as an independent service.
        </p>
      </div>

      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>API Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-sm">
              <div><span className="text-green-600">POST</span> /api/auth — Login / Register</div>
              <div><span className="text-blue-600">GET</span> /api/tenants — List tenants</div>
              <div><span className="text-green-600">POST</span> /api/tenants — Create tenant</div>
              <div><span className="text-blue-600">GET</span> /api/modules — List available modules</div>
              <div><span className="text-green-600">POST</span> /api/modules — Purchase module license</div>
              <div><span className="text-blue-600">GET</span> /api/health — Health check</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-4 text-xl font-semibold text-gray-900">Module Services</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <Card key={mod.id}>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900">{mod.name}</h3>
              <p className="mt-1 text-sm text-gray-500">Port: {mod.port}</p>
              <p className="text-sm text-gray-500">
                Subdomain: <code>{mod.id}.yourdomain.com</code>
              </p>
              <Link
                href={`http://localhost:${mod.port}`}
                className="mt-3 inline-block text-sm text-blue-600 hover:underline"
              >
                Open Service →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
