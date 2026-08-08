import { redirect } from "next/navigation";

/** Compat alias — Order Desk lives at /sales-desk. */
export default function OmsRedirect() {
  redirect("/sales-desk");
}
