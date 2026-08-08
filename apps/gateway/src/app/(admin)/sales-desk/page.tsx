"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SalesDeskWorkspace } from "./SalesDeskWorkspace";

function OrderDeskPage() {
  const searchParams = useSearchParams();
  return (
    <SalesDeskWorkspace
      initialSreqId={searchParams.get("sreqId")}
      initialSalesOrderId={searchParams.get("salesOrderId")}
    />
  );
}

/** Order Desk — SREQ → SO + tasks workbench. Deep-link: ?sreqId= / ?salesOrderId= */
export default function SalesDeskPage() {
  return (
    <Suspense fallback={null}>
      <OrderDeskPage />
    </Suspense>
  );
}
