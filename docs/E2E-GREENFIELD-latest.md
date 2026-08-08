# Greenfield OMS E2E

Tenant: gf-mskn4dia
Started: 2026-08-08T17:21:14.338Z
Duration: 11.5s
Result: 165 pass / 0 fail

## Platform
✓ operator login
✓ tenant created gf-mskn4dia
✓ licenses enabled
✓ Process Studio enabled
✓ admin login
✓ staff SALES_EXECUTIVE
✓ staff PRICING_EXECUTIVE
✓ staff DISPATCH_EXECUTIVE
✓ staff DELIVERY_EXECUTIVE
✓ staff ACCOUNTANT
✓ buyer registered
✓ Porter settings
✓ all personas logged in

## Security
✓ Sales home /dashboard — /dashboard
✓ Sales nav has dashboard
✓ Sales nav has products
✓ Sales nav has customers
✓ Sales nav has order_desk
✓ Sales nav lacks price_lists
✓ Sales nav lacks attributes
✓ Sales nav lacks categories
✓ Pricing home /dashboard — /dashboard
✓ Pricing nav has dashboard
✓ Pricing nav has products
✓ Pricing nav has price_lists
✓ Pricing nav has order_desk
✓ Pricing nav lacks categories
✓ Pricing nav lacks customers
✓ Dispatch home /dashboard — /dashboard
✓ Dispatch nav has dashboard
✓ Dispatch nav has order_desk
✓ Dispatch nav lacks products
✓ Dispatch nav lacks price_lists
✓ Delivery home /dashboard — /dashboard
✓ Delivery nav has dashboard
✓ Delivery nav has order_desk
✓ Delivery nav lacks products
✓ Delivery nav lacks price_lists
✓ Accountant home /dashboard — /dashboard
✓ Accountant nav has dashboard
✓ Accountant nav has customers
✓ Accountant nav has invoices
✓ Accountant nav has order_desk
✓ Accountant nav lacks products
✓ Accountant nav lacks categories
✓ Accountant nav lacks attributes
✓ Accountant nav lacks price_lists
✓ Admin home /dashboard — /dashboard
✓ Admin nav has dashboard
✓ Admin nav has order_desk
✓ Admin nav has administration
✓ Sales GET products
✓ Sales GET customers
✓ Sales GET orders
✓ Sales GET SREQs
✓ Sales GET price-lists forbidden
✓ Sales POST attributes forbidden
✓ Sales POST categories forbidden
✓ Pricing GET products
✓ Pricing GET price-lists
✓ Pricing GET orders
✓ Pricing POST price-list
✓ Pricing POST categories forbidden
✓ Pricing POST attributes forbidden
✓ Dispatch GET orders
✓ Dispatch GET products forbidden
✓ Dispatch GET price-lists forbidden
✓ Accountant GET invoices
✓ Accountant GET customers
✓ Accountant GET orders
✓ Accountant POST products forbidden
✓ Accountant POST categories forbidden
✓ empty portal has no Trustwood leak
✓ tenant isolation portal SKUs
✓ Trustwood cannot see GF-SKU-001
✓ Trustwood orders lack gf slug

## Dashboard
✓ Sales dashboard loaded
✓ Sales has ops-kpi-row
✓ Sales has my-tasks-list
✓ Sales has sreq-order-table
✓ Sales KPI variant sales
✓ Sales no Order Desk widget
✓ Pricing dashboard loaded
✓ Pricing has ops-kpi-row
✓ Pricing has price-ops
✓ Pricing KPI variant pricing
✓ Pricing no Order Desk widget
✓ Dispatch dashboard loaded
✓ Dispatch has ops-kpi-row
✓ Dispatch KPI variant dispatch
✓ Dispatch no Order Desk widget
✓ Delivery dashboard loaded
✓ Delivery has ops-kpi-row
✓ Delivery KPI variant delivery
✓ Delivery no Order Desk widget
✓ Accountant dashboard loaded
✓ Accountant has ops-kpi-row
✓ Accountant KPI variant accountant
✓ Accountant no Order Desk widget
✓ Admin dashboard loaded
✓ Admin has ops-kpi-row
✓ Admin KPI variant admin
✓ Admin no Order Desk widget

## Workflow
✓ seed forms
✓ seed templates
✓ bind OMS trading workflow
✓ create widget lab form
✓ publish widget lab
✓ widget lab has ProductList
✓ widget lab has CatalogSearch
✓ widget lab has FormFields
✓ widget lab has DispatchFulfillment
✓ widget lab has InvoiceGenerate
✓ widget lab has ActionButtons
✓ DispatchFulfillment on published dispatch form

## Documents
✓ seed tax-invoice
✓ tax-invoice element ids
✓ preview TAX INVOICE
✓ preview data-id invoiceNumber
✓ single AR invoice — count=1
✓ invoice number INV-*
✓ pdfUrl present
✓ invoice has 10 lines
✓ PDF %PDF-
✓ SO attachment INVOICE

## Catalog
✓ create brand
✓ create category
✓ create color attribute
✓ create size attribute
✓ configure group created
✓ 10 GF-SKU sellable products — got 10
✓ create warehouse
✓ stock received — 200
✓ stock receive idempotent — 200
✓ portal lists GF-SKU-001
✓ portal has no Trustwood SKU

## OMS
✓ buyer 10-line SREQ
✓ SREQ subtotal ≈ cart
✓ convert SREQ → SO
✓ convert idempotent — 200 already=true
✓ SO v5 snapshot
✓ Sales review
✓ Inventory verify-stock
✓ Pricing complete-pricing
✓ Warehouse ready
✓ Porter NOT_BOOKED blocked — 409 Book on Porter before completing dispatch
✓ Porter BOOKING_PENDING → DISPATCHED
✓ fulfillmentMode porter
✓ carrier porter
✓ porterBookingStatus pending or booked — BOOKING_PENDING
✓ Deliver
✓ Invoice generate
✓ invoice retry does not 5xx — 200
✓ Collect payment
✓ payment retry idempotent — 200
✓ final SO CLOSED

## Final invariants
✓ SO 10 lines
✓ SO CLOSED or PAID — CLOSED
✓ invoice 10 lines
✓ invoice.subtotal == SO.subtotal
✓ invoice.tax == SO.tax
✓ invoice.total == subtotal + tax
✓ payment == invoice total — paid=1829 total=1829
✓ stock deducted by ordered qty
✓ SREQ CONVERTED + 10 lines
