# Trustwood Enterprise
## Sankalp ERP Platform Proposal

**Prepared for:** Trustwood Enterprise
**Platform provider:** Sankalp Platforms
**Proposal status:** Completed Customer Centre + commercial quotation
**Date:** 08 August 2026
**Version:** 1.3

<!-- PAGE -->
# Completed Business Capabilities

## Sales and order management

- Customer records and customer addresses
- Online order creation (Sales Request from Customer Centre)
- Order listing and detail views
- Order confirmation with stock reservation
- Order cancellation with stock release
- Order shipment with stock deduction
- Invoice creation linkage through accounting
- Sales return foundation
- Coupon validation and order discount linkage
- Paginated and filterable order APIs

## Catalogue and inventory

- Product catalogue management
- Product categories and category hierarchy
- Category sorting and featured controls
- Brand management
- Product SKU and barcode lookup
- Product availability and visibility controls
- Warehouse stock levels
- Manual stock adjustment
- Stock reservation, release and deduction
- Stock movement history
- Low-stock and inventory report foundations

## Procurement and finance

- Vendor and purchase-order foundations
- Goods receipt and stock receiving foundation
- Purchase-return foundation
- Chart of accounts and journal entries
- Sales and purchase invoice foundations
- Payments and payment status foundations
- Taxes, credit notes and debit notes
- Accounting integration from operational services

<!-- PAGE -->
# Completed Operations and Workforce Capabilities

## Delivery operations

- Delivery zones, pincode serviceability and order assignment
- Assignment listing, detail and delivery status transitions
- Delivery tracking, earnings and compensation foundations
- Cash and online delivery reporting foundation

## Reporting and analytics

- Sales totals, order counts, top-product, customer and order summaries
- Period and date-range filtering through tenant-scoped report APIs
- Inventory stock, low-stock, valuation and movement reports
- Delivery assignment, earnings and status summary reports

## Notification component

- Tenant-scoped in-app notification records with paginated listing
- Unread count and mark-as-read controls
- Device-token registration and removal
- FCM push delivery integration when configured
- Notification event foundation for order, operational and system events

## Enterprise messenger

- Customer-to-staff conversation creation with controlled staff assignment
- Tenant- and participant-scoped conversation access
- Text messages, file attachments and voice messages
- Voice recording upload and playback
- Conversation listing, read history and participant controls

## Administration and reporting foundations

- Admin portal navigation, paginated APIs and role-controlled mutations
- Sales, stock and delivery reporting foundations
- Soft deactivation, Zod validation and tenant-scoped operational evidence

<!-- PAGE -->
# Customer Centre — Complete Features

The Trustwood Customer Centre is live as a branded, mobile-first web portal (installable PWA). Buyers browse catalogue, place Sales Requests, track fulfilment and talk to staff without using the admin desk.

## Access and identity

- Tenant-branded sign-in and registration
- Email and password login
- Google Sign-In (Identity Services)
- WhatsApp OTP login (Fast2SMS, per tenant) for phone-first buyers
- WhatsApp number linking and verification on the profile
- Password set-up for accounts created with Google
- Authenticated session with tenant-scoped APIs

## Browse and catalogue

- Home with banners, featured products and recently viewed items
- Shop by category and catalogue groups (e.g. BWP, blockboard, laminate)
- Configurable products (size, finish, colour) with area or each pricing
- Product images, SKU and starting price
- Search across products, groups and SKU
- Product detail with availability and add-to-cart
- Responsive layout: bottom nav on mobile, wide portal on desktop

<!-- PAGE -->
# Customer Centre — Commerce and Account

## Cart, checkout and orders

- Persistent cart with quantity, line totals and tax estimate
- Checkout: saved address or new address, notes and bill summary
- Tax / GST line on the bill (Rs. 0 when product tax is unset)
- Inventory reservation at checkout
- Places a **Sales Request (SREQ)**; sales converts to Sales Order (SO)
- My orders / requests list with status labels
- Request detail: timeline, items, totals, delivery address
- Cancel while the request is still open
- Reorder into cart
- Invoice / document PDF download after SO invoicing
- SO and delivery status visible on the request after convert

## Account, support and experience

- Profile overview, personal details and preferences
- Address book (add, edit, default)
- In-app notifications inbox
- Support entry pointing to sales desk / request number
- Customer dashboard with configurable widgets
- Wallet balance foundation where enabled
- In-app messenger: text, attachments and voice to Trustwood staff
- Installable PWA, service worker, offline shell and update prompt
- Navigation: Home, Shop, Cart, Orders, Messages

<!-- PAGE -->
# In Progress

The following items are committed in this commercial scope and are not yet complete.

## 1. WhatsApp integration

Beyond OTP login (already live), Trustwood will receive business WhatsApp:

- Order and Sales Request status alerts on WhatsApp
- Catalogue / offer messages where templates are approved
- Two-way customer support on WhatsApp linked to the in-app conversation
- Tenant Fast2SMS / WhatsApp Business configuration, template approval and delivery reports
- Depends on Trustwood WhatsApp Business / Fast2SMS account, DLT templates and message credit

## 2. App development

Native store apps wrapping the same Customer Centre (no separate UI fork):

- Android (Play Store) and iOS (App Store) via Capacitor
- Device install, splash, safe-area and store listing assets
- Push notification behaviour on device
- Same catalogue, cart, orders and messenger flows as the web PWA
- Store review, signing keys and listing copy are part of this track

<!-- PAGE -->
# Commercial Framework

All amounts are in Indian Rupees (INR). GST extra unless stated otherwise.

## Software development

| Item | Amount (INR) |
|---|---|
| Software development (Customer Centre + ERP platform) | Rs. 1,80,000 |
| WhatsApp integration (in progress) | Included |
| App development - Android and iOS (in progress) | Included |
| Tenant setup and go-live configuration | Included |
| Hosting during delivery (Sankalp host) | Included |
| Software total | Rs. 1,80,000 |

## Payment schedule

| Milestone | Share | Amount (INR) |
|---|---|---|
| Beta version | 20% | Rs. 36,000 |
| Complete feature delivery | 50% | Rs. 90,000 |
| Bug fixes and PRD promotion | 30% | Rs. 54,000 |
| Software total | 100% | Rs. 1,80,000 |

## Monthly maintenance

| Item | Amount (INR) |
|---|---|
| Monthly fee | Rs. 5,000 |
| Duration | 6 months |
| Maintenance total | Rs. 30,000 |

Maintenance covers production monitoring, defect fixes in delivered scope, dependency and security patches, and operational support. New features outside this proposal are estimated separately.

<!-- PAGE -->
# Commercial Assumptions and Approval

## Project total

| Item | Amount (INR) |
|---|---|
| Software development | Rs. 1,80,000 |
| Maintenance (6 months) | Rs. 30,000 |
| Project total (excl. GST) | Rs. 2,10,000 |

## Assumptions

- Payment milestones are invoiced on Sankalp Platforms written confirmation of beta, feature complete, and bug-fix / PRD promotion closure.
- WhatsApp message credits, DLT / template fees, Google Play and Apple Developer fees, and SMS/OTP provider charges are billed at actuals or paid by Trustwood to the provider.
- GST and statutory taxes extra.
- Change requests outside this scope are estimated and approved separately.
- Features are subject to agreed configuration and acceptance criteria.

## Provider

Sankalp Platforms supplies the multi-tenant ERP, Customer Centre, implementation and operational guidance for Trustwood Enterprise.

## Proposal approval

For Trustwood Enterprise

Authorized signatory: ____________________________________

Designation: ____________________________________________

Signature: ______________________________________________

Date: __________________________________________________

Platform provider: Sankalp Platforms
