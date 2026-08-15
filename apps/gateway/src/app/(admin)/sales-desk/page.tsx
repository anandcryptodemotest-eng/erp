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
      initialStatus={searchParams.get("status")}
      initialFrom={searchParams.get("from")}
      initialTo={searchParams.get("to")}
      initialTab={searchParams.get("tab")}
      initialTaskStatus={searchParams.get("taskStatus")}
      initialSreqStatus={searchParams.get("sreqStatus")}
    />
  );
}

/** Order Desk deep-links: sreqId, salesOrderId, status, from, to, tab, taskStatus, sreqStatus */
export default function SalesDeskPage() {
  return (
    <Suspense fallback={null}>
      <OrderDeskPage />
    </Suspense>
  );
}
