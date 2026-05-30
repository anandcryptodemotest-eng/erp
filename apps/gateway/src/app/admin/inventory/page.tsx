"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, DataTable } from "@erp/ui";
import { api } from "@/lib/api-client";

type Tab = "products" | "categories" | "brands" | "stock";

interface Product { id: string; name: string; sku: string; sellingPrice: number; costPrice: number; isActive: boolean; isFeatured: boolean }
interface Category { id: string; name: string; isFeatured: boolean; isActive: boolean }
interface Brand { id: string; name: string; isActive: boolean }
interface StockItem { productId: string; productName: string; sku: string; warehouse: string; quantity: number; reservedQty: number; availableQty: number }

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    if (t === "products") {
      const res = await api<{ data: Product[] }>("inventory", `/api/products?limit=50${search ? `&search=${search}` : ""}`);
      if (!res.error) setProducts(res.data.data);
    } else if (t === "categories") {
      const res = await api<{ data: Category[] }>("inventory", "/api/products/categories?limit=50");
      if (!res.error) setCategories(res.data.data);
    } else if (t === "brands") {
      const res = await api<{ data: Brand[] }>("inventory", "/api/brands?limit=50");
      if (!res.error) setBrands(res.data.data);
    } else if (t === "stock") {
      const res = await api<{ data: { topByValue: StockItem[] } }>("inventory", "/api/reports/stock");
      if (!res.error) setStock(res.data.data.topByValue);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { load(tab); }, [tab, load]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "products", label: "Products" },
    { key: "categories", label: "Categories" },
    { key: "brands", label: "Brands" },
    { key: "stock", label: "Stock Levels" },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}

      {!loading && tab === "products" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Products ({products.length})</CardTitle>
            <div className="flex gap-2">
              <input
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load("products")}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
              <Button size="sm" onClick={() => load("products")}>Search</Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              keyField="id"
              data={products}
              columns={[
                { key: "name", header: "Name" },
                { key: "sku", header: "SKU" },
                { key: "sellingPrice", header: "Price", render: (r) => `₹${Number(r.sellingPrice).toLocaleString("en-IN")}` },
                { key: "costPrice", header: "Cost", render: (r) => `₹${Number(r.costPrice).toLocaleString("en-IN")}` },
                { key: "isFeatured", header: "Featured", render: (r) => r.isFeatured ? <Badge>Yes</Badge> : null },
                { key: "isActive", header: "Status", render: (r) => <Badge variant={r.isActive ? "default" : "outline"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {!loading && tab === "categories" && (
        <Card>
          <CardHeader><CardTitle>Categories ({categories.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              keyField="id"
              data={categories}
              columns={[
                { key: "name", header: "Name" },
                { key: "isFeatured", header: "Featured", render: (r) => r.isFeatured ? <Badge>Yes</Badge> : null },
                { key: "isActive", header: "Status", render: (r) => <Badge variant={r.isActive ? "default" : "outline"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {!loading && tab === "brands" && (
        <Card>
          <CardHeader><CardTitle>Brands ({brands.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              keyField="id"
              data={brands}
              columns={[
                { key: "name", header: "Brand Name" },
                { key: "isActive", header: "Status", render: (r) => <Badge variant={r.isActive ? "default" : "outline"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {!loading && tab === "stock" && (
        <Card>
          <CardHeader><CardTitle>Stock Levels (top by value)</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              keyField="productId"
              data={stock}
              columns={[
                { key: "productName", header: "Product" },
                { key: "sku", header: "SKU" },
                { key: "warehouse", header: "Warehouse" },
                { key: "quantity", header: "Total Qty" },
                { key: "reservedQty", header: "Reserved" },
                { key: "availableQty", header: "Available", render: (r) => (
                  <span className={Number(r.availableQty) <= 5 ? "font-bold text-red-600" : ""}>{String(r.availableQty)}</span>
                )},
                { key: "stockValue", header: "Stock Value", render: (r) => `₹${Number(r.stockValue).toLocaleString("en-IN")}` },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
