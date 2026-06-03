"use client";
import Link from "next/link";

type FlowStepKey = "leads" | "opportunities" | "quotes" | "orders" | "invoices";

interface StepInfo {
  title: string;
  purpose: string;
  userAction: string;
  businessOutcome: string;
  nextLabel?: string;
  nextHref?: string;
}

const STEP_INFO: Record<FlowStepKey, StepInfo> = {
  leads: {
    title: "Lead = Prospect Discovery",
    purpose: "Capture and qualify potential buyers before spending commercial effort.",
    userAction: "Move NEW -> CONTACTED -> QUALIFIED only when fit is confirmed.",
    businessOutcome: "Only qualified prospects move forward, reducing noise in pipeline.",
    nextLabel: "Go to Opportunities",
    nextHref: "/opportunities",
  },
  opportunities: {
    title: "Opportunity = Active Deal",
    purpose: "Track negotiation maturity, expected value, and win probability.",
    userAction: "Advance stage one step at a time and close as WON or LOST.",
    businessOutcome: "Pipeline forecasting becomes reliable and auditable.",
    nextLabel: "Go to Quotes",
    nextHref: "/quotes",
  },
  quotes: {
    title: "Quote = Commercial Offer",
    purpose: "Send an official price and terms proposal to a customer.",
    userAction: "Move DRAFT -> SENT, then ACCEPTED or REJECTED/EXPIRED.",
    businessOutcome: "Only accepted commercial terms become executable orders.",
    nextLabel: "Go to Orders",
    nextHref: "/orders",
  },
  orders: {
    title: "Order = Fulfillment Commitment",
    purpose: "Execute supply with stock controls and shipping milestones.",
    userAction: "Confirm order, ship quantities, and then invoice.",
    businessOutcome: "Inventory and finance stay in sync with physical fulfillment.",
    nextLabel: "Go to Invoices",
    nextHref: "/invoices",
  },
  invoices: {
    title: "Invoice = Revenue Collection",
    purpose: "Track receivable lifecycle from issue to full payment.",
    userAction: "Issue invoice, record partial/full payments, monitor due dates.",
    businessOutcome: "Cash collection visibility and closure of lead-to-cash cycle.",
  },
};

export default function LeadToCashUnderstanding({ current }: { current: FlowStepKey }) {
  const info = STEP_INFO[current];

  return (
    <div className="mb-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4">
      <h3 className="text-sm font-semibold text-emerald-900">{info.title}</h3>
      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-emerald-900 md:grid-cols-3">
        <div className="rounded-lg border border-emerald-200 bg-white p-2.5">
          <p className="font-semibold text-emerald-800">Why this step exists</p>
          <p className="mt-1 text-emerald-700">{info.purpose}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-white p-2.5">
          <p className="font-semibold text-emerald-800">What user should do</p>
          <p className="mt-1 text-emerald-700">{info.userAction}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-white p-2.5">
          <p className="font-semibold text-emerald-800">Business outcome</p>
          <p className="mt-1 text-emerald-700">{info.businessOutcome}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-emerald-800">
          Lead = prospect, Opportunity = deal, Customer = billing account used in quote/order/invoice.
        </p>
        {info.nextHref && info.nextLabel && (
          <Link href={info.nextHref} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100">
            {info.nextLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
