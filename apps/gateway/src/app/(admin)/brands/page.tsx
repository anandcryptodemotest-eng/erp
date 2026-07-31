import { redirect } from "next/navigation";

export default function BrandsRedirect() {
  redirect("/products?tab=setup");
}
