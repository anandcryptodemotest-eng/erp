# Simhapuri Fresh
## Grocery Commerce, Operations and Management Platform

**Project proposal:** Admin Panel, Backend, POS, Delivery and Customer Applications
**Prepared by:** Sankalp
**Platform foundation:** Sankalp ERP Platform
**Prepared for:** Simhapuri Fresh
**Date:** 06 August 2026
**Version:** 2.0 - Draft for refinement

<!-- PAGE -->
# About Sankalp

Sankalp is the technology provider for Simhapuri Fresh, delivering a scalable, secure and user-centric grocery operations platform.

Our capabilities cover mobile application development for Android and iOS, web platforms, cloud-ready backend systems, product strategy, UI/UX design, deployment and post-launch support. We follow Agile and industry-standard engineering practices with transparent delivery, practical communication and measurable acceptance criteria.

Our focus is to deliver a business-ready product that is reliable, maintainable and aligned with the operating model of Simhapuri Fresh. Sankalp will configure and extend its ERP Platform foundation to deliver a connected grocery operating system.

## Delivery principles

- Business outcomes before feature volume
- Secure tenant and role boundaries by default
- Reusable platform capability before one-off customisation
- Inventory and financial integrity through transactional workflows
- Mobile-first customer and delivery experiences
- Transparent scope, milestones, UAT evidence and handover

<!-- PAGE -->
# Project Overview

Simhapuri Fresh requires a connected grocery platform that supports online shopping, store billing, inventory control, procurement, delivery execution, customer management, promotions, reporting and business administration.

The proposed solution will provide one operating model across the customer app, admin panel, POS terminal and delivery application. Orders, stock, billing, delivery, customer records and operational reporting will be connected through authenticated APIs and domain-owned services.

## Proposed solution components

| Component | Primary users | Purpose |
|---|---|---|
| Customer application | Customers | Browse products, place orders, manage addresses, track orders and contact support |
| Admin panel | Owner, manager, inventory, accountant | Configure and operate the grocery business |
| POS application | Cashiers and store staff | Walk-in billing, barcode lookup, shifts, returns and receipts |
| Delivery application | Delivery executives | View assignments, update delivery status, track work and earnings |
| Backend services | Internal operations and integrations | Secure APIs, transactions, stock, accounting, communication and platform controls |

## Proposed technology foundation

- Frontend: Next.js and React with TypeScript
- Backend: independently deployable Next.js service APIs
- Database: PostgreSQL with Prisma and database-per-service ownership
- Authentication: JWT/HS256, refresh tokens, bcrypt and role-based access control
- Validation: Zod request validation and typed shared contracts
- Architecture: Turborepo monorepo with reusable Sankalp packages
- Deployment: client-approved cloud or infrastructure, Nginx HTTPS edge and supervised services
- API style: authenticated REST APIs with tenant-scoped response envelopes

<!-- PAGE -->
# User Roles and Applications

| Role | Application | Access and responsibilities |
|---|---|---|
| Customer | Customer app | Browse, cart, checkout, orders, addresses, returns and support conversations |
| Admin / Owner | Admin panel | Full business administration, settings, users, reports and approvals |
| Store Manager | Admin panel | Orders, stock, staff operations, delivery oversight and reports |
| Inventory Manager | Admin panel | Products, categories, brands, warehouses, stock and purchase receiving |
| Accountant | Admin panel | Bills, invoices, payments, taxes, journals and financial reports |
| Cashier | POS application | Cash shift, walk-in bills, payments, holds, returns and receipts |
| Delivery Executive | Delivery application | Assigned orders, pickup, delivery status, location and earnings |
| Investor / Viewer | Admin panel | Read-only dashboard, reports and agreed business summaries |
| Platform Administrator | Gateway / platform admin | Tenant, licensing, roles, configuration and platform governance |

## Access model

Access is controlled by authenticated identity, tenant membership, module license and role permissions. Simhapuri Fresh may define the final role matrix during discovery. The proposal assumes at least Admin, Manager, Inventory, Accountant, Cashier, Delivery Executive and Investor or Viewer roles.

## Operating channels

- Customer ordering through responsive web or PWA experience
- Store billing through tablet or desktop POS
- Back-office management through a desktop-first admin panel
- Delivery execution through a mobile-first application
- Internal communication through tenant-scoped staff and customer conversations

<!-- PAGE -->
# 1. Admin Dashboard and Business Analytics

The admin dashboard will provide a consolidated operating view. The current foundation includes report routes and operational data across sales, inventory, accounting and delivery; dashboard composition, visual analytics and final KPI definitions will be completed during implementation refinement.

## Sales analytics

- Daily, weekly, monthly and yearly sales summaries
- Custom date-range filtering
- Order count and sales value by status
- Online and POS sales comparison
- Sales by product, category and brand
- Top-selling product and category views

## Revenue and finance analytics

- Revenue overview
- Payment-method breakdown
- Billing totals and refunds
- Tax and invoice summaries
- Cash shift totals and variance
- Expense, income and profit views where configured

## Operational statistics

- Total, active and new customers
- Product and category counts
- Open orders and pending actions
- Low-stock and reorder alerts
- Warehouse stock and valuation
- Delivery assignment and completion status
- Coupon usage and campaign performance

## Dashboard filters and exports

- Tenant, branch or warehouse scope where configured
- Date range
- Order status and payment method
- Category, brand and product
- Delivery zone and executive
- Exportable report datasets in agreed formats

**Refinement note:** exact KPI formulas, branch hierarchy, accounting treatment of revenue, and export formats must be approved by Simhapuri Fresh before dashboard acceptance.

<!-- PAGE -->
# 2. Order Management Module

The order module manages the complete lifecycle from online or manually created order through confirmation, fulfilment, invoicing, delivery, cancellation and return.

## Order management features

- View all orders with pagination
- Search by order number, customer, mobile number and date
- Filter by order status, payment method and payment status
- View order items, prices, discount, tax, delivery fee and address
- Order timeline and activity history
- Confirm order and reserve stock
- Cancel order and release stock
- Ship order, deduct stock and create invoice linkage
- Assign order for delivery
- Create manual orders for phone, store or assisted sales
- Bulk status operations subject to role permission
- Return initiation, approval, rejection and completion foundations

## Order state model

```
DRAFT -> CONFIRMED -> PARTIALLY_SHIPPED -> SHIPPED -> INVOICED
  |          |              |
CANCELLED <- +              +--> RETURN_REQUESTED -> COMPLETED
```

The final state names and allowed transitions will be confirmed with the Simhapuri Fresh operating team. Stock reservation, release and deduction are treated as controlled service operations rather than client-side updates.

## Payment and fulfilment

- Cash on delivery and online payment method fields
- Payment status tracking
- Invoice generation linkage after shipment
- Delivery assignment handoff
- Cancellation and refund or credit-note handling subject to accounting configuration
- Order tracking logs and delay notification integration point

<!-- PAGE -->
# 3. Category, Brand and Catalogue Management

The catalogue structure will organize the grocery assortment for both customer discovery and internal operations.

## Category management

- Main category and subcategory management
- Parent-child category tree
- Sorting and display priority
- Active/inactive visibility
- Featured category flag
- Category banner or icon asset reference
- Category-wise product listing and reporting

## Suggested grocery categories

- Fruits and vegetables
- Grocery and staples
- Dairy and chilled products
- Beverages
- Snacks and packaged foods
- Bakery and ready-to-eat
- Household essentials
- Personal care
- Baby care
- Meat, seafood or other regulated categories if applicable

## Brand management

- Brand creation and editing
- Logo asset reference
- Active/inactive status
- Product association
- Brand filtering and reporting

## Product catalogue

- Product name, SKU, barcode and description
- Category, subcategory and brand association
- Product image references
- Unit, weight and quantity information
- Featured and sort-order controls
- Availability and visibility controls
- Reorder level and stock policy
- Product search and filtering
- Variant and price-list extension points

<!-- PAGE -->
# 4. Product and Inventory Management

Inventory is managed by warehouse and product, with reservations and movements recorded for traceability. Product and stock APIs are implemented in the inventory service; the final admin screens and operating policies remain part of the implementation scope.

## Inventory operations

- View stock by warehouse and product
- Search by SKU, barcode, category or brand
- Manual stock adjustment with reason
- Stock movement history
- Low-stock and reorder-level reporting
- Stock reservation for confirmed online orders
- Release reservation on cancellation
- Deduct stock on shipment or completed POS bill
- Receive stock against purchase order
- Restore stock for approved returns
- Inventory valuation foundation using cost values
- Warehouse and location management

## Stock controls

- Available quantity
- Reserved quantity
- Sellable quantity
- Reorder level
- Inbound and outbound movement
- Reference order, bill or purchase record
- Warehouse-level filtering
- Role-controlled adjustment operations

## Future refinement items

Batch and expiry handling, variant stock, multi-price lists, barcode hardware behavior, wastage, damaged stock, inter-warehouse transfers and weighted produce billing require confirmation of Simhapuri Fresh's operating practices.

<!-- PAGE -->
# 5. Store Billing and POS Management

The POS application will support walk-in customers, store purchases, cash operations and stock synchronization.

## Billing features

- Fast billing interface
- Product search by name, SKU or barcode
- Barcode scanner integration point
- Quick add to cart
- Quantity-based billing
- Weight-based billing where configured
- Item-level discount and tax fields
- GST-ready tax calculation foundation
- Cash shift association
- Cash, UPI, card and wallet payment methods as configured
- Invoice and receipt generation
- Thermal printer integration point

## Billing operations

- Hold bill and resume bill
- Bill cancellation with authorized role
- Full and partial return processing
- Refund record and stock restoration
- Manual billing entries
- Customer association for identified sales
- Bill search by shift, status or customer

## Cash counter management

- Open shift with opening balance
- Shift-wise bills and collections
- Cash-in and cash-out entries
- Close shift with counted cash
- Expected versus actual cash variance
- Shift summary report
- Manager approval for exceptional variance where required

## Stock integration

Completed bills deduct stock through the inventory service. Returns restore stock through controlled return operations. The POS client does not directly mutate inventory records.

**Refinement note:** payment gateway, printer model, scanner model, receipt format, GST invoice requirements and multiple-counter behavior must be confirmed before POS hardware acceptance.

<!-- PAGE -->
# 6. Promotions, Banners and Coupons

The platform includes gateway-owned marketing foundations for banners and coupons. Simhapuri Fresh can use these capabilities to manage merchandising campaigns and customer offers.

## Banner management

- Homepage banners
- Promotional banners
- Category banners
- Active date range
- Display order
- Image asset reference
- Link target or campaign reference
- Enable and disable controls

## Coupon management

- Percentage or flat discount
- Minimum order value
- Validity period
- Usage limits and customer usage tracking
- Product or category applicability where configured
- Coupon validation before order completion
- Discount display and order linkage

## Campaign planning

- Seasonal grocery campaigns
- Featured products
- Category promotions
- New customer offers
- Repeat-purchase or cart-value offers
- Promotional notification integration point

Campaign rules, stacking behavior, tax treatment of discounts and approval responsibilities will be finalized during the business rules workshop.

<!-- PAGE -->
# 7. Delivery Management

Delivery operations will connect confirmed orders with serviceable zones, delivery executives, status tracking and earnings information.

## Delivery operations

- Delivery zone creation and management
- Pincode serviceability check
- Order assignment to executive
- Assignment list and detail
- Pickup and delivery status transitions
- Delivery notes and operational references
- Delayed-order visibility
- Completed delivery history

## Delivery configuration

- Distance or zone-based delivery charges
- Dynamic delivery fee rules where approved
- Minimum order or free-delivery threshold
- Delivery time-slot policy
- Serviceability by pincode or zone
- Cash collection responsibility

## Compensation settings

- Fixed salary configuration
- Per-order commission
- Bonus and incentive configuration
- Earnings summary by executive
- Period-based earnings reports

## Delivery performance

- Assigned, accepted, picked-up and delivered counts
- Completion time
- Failed or cancelled delivery reasons
- Cash and online payment split
- Executive-level performance report
- On-time rate metric after KPI definition is approved

<!-- PAGE -->
# 8. Delivery Executive Application

The delivery application will be mobile-first and limited to the delivery executive's authorized work context.

## Executive workflow

1. Sign in and view availability
2. Review assigned orders
3. Accept or acknowledge an assignment where configured
4. View customer address and delivery information
5. Mark pickup or out-for-delivery status
6. Contact customer through approved channel
7. Mark delivered, failed or returned with reason
8. Record cash collection where applicable
9. Review daily and period earnings

## Executive views

- Active assignments
- Assignment detail
- Customer and delivery address
- Status update controls
- Delivery history
- Earnings summary
- Availability and vehicle information
- Location tracking permission and status where enabled

The current delivery service includes zones, assignments, status transitions, earnings and compensation foundations. Executive profile workflows, location permissions and the final mobile UI are implementation items to be refined and accepted with the delivery team.

<!-- PAGE -->
# 9. Customer Management and Customer Experience

Customer experience will be available through the customer application, while authorized staff will manage customer records and service activity through the admin panel.

## Customer administration

- Customer listing and search
- Customer profile
- Mobile number and email
- Account activity
- Address management
- Order history
- Account active or blocked status
- Block and unblock reason
- Wallet foundation where enabled
- Coupon usage history where enabled

## Customer application

- Sign up and secure login
- Product catalogue browsing
- Search and category discovery
- Product detail and availability
- Cart and checkout
- Address selection and management
- Online order placement
- Order history and order detail
- Delivery status visibility
- Return or support entry point
- Profile and account settings

## Customer communication

Customers can start a conversation with Simhapuri Fresh staff from the portal. Conversations are tenant-scoped, routed to an authorized staff member, and support text, attachments and voice messages. Participant membership controls access to the conversation.

The customer portal and voice-message workflow have been implemented and validated in the current release. Push notifications, customer-admin list screens and some advanced notification behavior remain refinement items.

<!-- PAGE -->
# 10. Reporting and Analytics

Reports will be delivered according to agreed operational definitions and permissions. The backend contains report foundations across sales, stock, POS shifts and delivery.

## Sales and order reports

- Daily, weekly, monthly and yearly sales
- Online versus POS sales
- Order summary by status
- Payment method report
- Cancellation report
- Return report
- Product-wise sales
- Category-wise sales
- Top products and customers

## Inventory reports

- Current stock by warehouse
- Low-stock report
- Stock movement report
- Stock reservation and release history
- Inventory valuation foundation
- Product and category performance
- Purchase receiving summary

## Delivery reports

- Delivery assignment report
- Executive completion report
- Earnings report
- Cash collection report
- Failed and returned delivery report
- Delivery performance metrics after KPI approval

## POS and finance reports

- Daily billing report
- Shift summary
- Cash collection and variance
- Refund and return report
- Invoice and tax summary
- Receivable and payable foundations
- Expense and revenue reports where configured

## Export and access

Report access is role-controlled. Export formats, Excel generation, scheduled reports and investor-facing dashboards are to be confirmed as part of refinement rather than assumed as delivered in the current baseline.

<!-- PAGE -->
# 11. Notifications and Communication

Notifications will keep customers and staff informed about business events without exposing data across tenants.

## Planned notification events

- Order placed
- Order confirmed
- Payment received or failed
- Order shipped or assigned
- Delivery completed or failed
- Return approved or completed
- Low-stock alert
- Purchase receiving event
- Promotion and offer announcement
- New customer support message
- System and administrative notification

## Communication channels

- In-app notification foundation
- Customer and staff conversations
- Text messages
- Voice messages
- File or image attachments
- Email, SMS, WhatsApp or push integrations subject to provider selection

The current communication capability supports tenant-scoped conversations, participant access, text, voice and attachments. FCM token registration and notification delivery routes exist as extension points; production push providers, templates, consent, retry policy and notification preferences must be finalized.

<!-- PAGE -->
# 12. Administration and Security

Simhapuri Fresh will operate through controlled administration with explicit separation of business roles.

## Administration features

- Tenant and business profile
- User invitations and membership
- Role assignment
- Module licensing and activation
- Settings and configuration
- Warehouse and delivery configuration
- Tax and numbering configuration
- Banner, coupon and promotion administration
- Workflow and form configuration where enabled
- Audit and operational evidence

## Security controls

- JWT authentication and refresh-token rotation
- bcrypt password hashing
- Fail-closed service-to-service authentication
- Tenant ID resolved from authenticated headers
- Participant checks for communication data
- Zod validation for request bodies
- Soft deletes for business records
- Transactional multi-model mutations
- API entry through the gateway and HTTPS edge
- Secrets supplied through environment configuration

## Role examples

| Role | Primary permissions |
|---|---|
| Admin | Full business and configuration access |
| Manager | Orders, inventory, delivery and reports |
| Inventory | Catalogue, warehouses, stock and receiving |
| Accountant | Bills, invoices, taxes, payments and reports |
| Cashier | POS shifts, bills and authorized returns |
| Investor / Viewer | Read-only dashboards and approved reports |

The final permission matrix and audit-log screens require client approval and implementation completion where marked in the progress matrix.

<!-- PAGE -->
# 13. GST, HSN and Financial Controls

The accounting foundation supports chart of accounts, journals, invoices, bills, payments, taxes, credit notes, debit notes, assets and foreign-exchange foundations. Simhapuri Fresh's statutory configuration will be completed with its accountant or tax consultant.

## Proposed GST and HSN scope

- HSN or product tax-code field
- Tax rate and tax slab configuration
- Product-to-tax mapping
- Tax calculation on bills and orders
- Tax breakdown in invoices
- Credit-note and debit-note tax treatment
- GST-oriented sales and invoice reports
- Tax-inclusive or tax-exclusive pricing rule

## Financial operations

- Chart of accounts
- Journal entries
- Accounts receivable and payable foundations
- Sales invoices
- Purchase invoices
- Payments and payment status
- POS bills and cash shifts
- Returns, credit notes and debit notes
- Asset and FX foundations where enabled

## Clarifications required

- GST registration details and applicable states
- Inclusive or exclusive product pricing
- HSN/SAC master ownership
- Rounding policy
- Credit period and customer credit limits
- Accounting period and closing process
- Payment gateway settlement reconciliation
- Treatment of delivery fee, discounts and returns

<!-- PAGE -->
# 14. Manual Expense, Revenue and Profit Views

Simhapuri Fresh may require operating visibility beyond order revenue. This area will be implemented only to the level approved in the final finance scope.

## Proposed controls

- Manual expense entry
- Daily and monthly expense tracking
- Staff salary expense
- Transportation and delivery expense
- Rent, utilities and miscellaneous expense
- Manual income entry where required
- Date-wise revenue view
- Expense-wise report
- Profit and loss overview
- Net revenue after expenses

## Revenue sharing and investor views

If Simhapuri Fresh operates with an investor or revenue-sharing arrangement, the platform can provide configured percentage calculations and read-only reporting after the commercial rule is approved.

- Admin or owner percentage
- Investor percentage
- Automatic split calculation
- Monthly distribution report
- Investor earnings overview
- Admin earnings overview
- Net revenue after approved expenses

These calculations require written agreement on included revenue, expense categories, tax treatment, refunds, timing and settlement responsibility. They are not assumed to be production-ready until approved and tested.

<!-- PAGE -->
# 15. Technical Deliverables

## Customer application

- Responsive grocery shopping experience
- Authentication and customer profile
- Catalogue and product discovery
- Cart and checkout
- Addresses and order history
- Order detail and delivery visibility
- Support conversation entry point
- Text, attachment and voice-message interaction

## Admin panel

- Responsive dashboard shell
- Role-aware navigation
- Catalogue and category management
- Product and inventory operations
- Order management
- POS and shift administration
- Promotions and coupons
- Delivery zones and assignments
- Reports and operational views
- Configuration and platform controls

## POS application

- Barcode and product lookup
- Cart and billing
- Discounts and tax
- Payment methods
- Hold and resume
- Cash shifts
- Receipts and bill detail
- Returns and refunds

## Delivery application

- Executive sign-in and work context
- Assigned orders
- Delivery status state machine
- Customer and address details
- Earnings and history
- Location tracking extension point

## Backend and platform

- Gateway and domain APIs
- PostgreSQL schema and Prisma migrations
- Tenant and role security
- Stock reservation, release, deduction and receiving
- Invoice and accounting service integration
- Delivery assignment and earnings services
- Communication and attachment upload
- Shared TypeScript contracts and UI packages
- Logging, metrics, tracing and operational runbook

<!-- PAGE -->
# 16. Implementation Status and Scope Boundary

## Available foundations

- Online order creation, confirmation, cancellation, shipment and stock integration
- Category and brand APIs
- Product, barcode and warehouse stock APIs
- Stock adjustment and movement foundations
- POS shifts, bills, holds, resumes, returns and stock deduction
- Banners, coupons, validation and usage tracking foundations
- Delivery zones, assignments, status transitions and earnings
- Sales, inventory, POS and delivery report foundations
- Customer portal, order experience and customer-to-staff communication
- Voice upload, voice messages and playback in customer messaging
- Authentication, tenant scoping, service keys and shared platform packages

## In progress or requiring refinement

- Dashboard visualisation and final KPI definitions
- Admin frontend completion across business modules
- Customer administration screens and customer reports
- Delivery executive profile workflows and full mobile experience
- Push and in-app notification delivery
- Final role and permission administration screens
- Advanced product variants, price lists, expiry, batch and weighted billing
- Excel export, scheduled reports and investor dashboard
- Final GST/HSN rules and statutory report formats
- Production integrations for payment, messaging, tax, logistics and hardware

This boundary is intentional. It allows the proposal to describe the complete target product while distinguishing current platform evidence from implementation work still to be completed.

<!-- PAGE -->
# 17. Implementation Approach and Acceptance

## Phase 1 - Discovery and business rules

Confirm branches, warehouses, catalogue, product units, taxes, pricing, payment methods, delivery zones, roles, approval rules, reports, integrations and customer support processes.

## Phase 2 - Foundation and configuration

Prepare environments, tenant configuration, access roles, master-data templates, domain settings, numbering, tax setup and operational policies.

## Phase 3 - Core grocery operations

Complete catalogue, inventory, order, POS, procurement, accounting, delivery and customer workflows. Configure the highest-value Simhapuri Fresh journeys first.

## Phase 4 - Experience and integrations

Finalize customer, admin, POS and delivery interfaces. Connect approved payment, notification, logistics, tax, printer, scanner and reporting integrations.

## Phase 5 - UAT, training and go-live

Run role-based UAT, migration rehearsal, stock and finance reconciliation, training, cutover rehearsal, production readiness review, go-live and hypercare.

## Acceptance criteria

- Tenant and role access tests pass
- Master data is loaded and reconciled
- Online order journey passes from checkout to delivery
- POS bill journey passes with stock deduction and shift closure
- Purchase receiving updates inventory correctly
- Return journey restores or adjusts stock as approved
- Delivery status and earnings are visible to authorized users
- Reports reconcile to source transactions
- Customer support messages remain tenant and participant scoped
- Production backup, monitoring and support runbook are approved

<!-- PAGE -->
# 18. Delivery Timeline and Commercial Framework

The reference project described a 40-working-day delivery. For Simhapuri Fresh, the final duration depends on the confirmed scope, integrations, data quality, hardware, number of operating locations and UAT availability.

| Phase | Scope | Indicative duration |
|---|---|---|
| Discovery | Process mapping, rules and solution blueprint | [ ] working days |
| Foundation | Environment, tenant, roles, master data and security | [ ] working days |
| Core operations | Catalogue, stock, orders, POS, delivery and finance | [ ] working days |
| Customer and admin experience | Screens, workflows, reports and communication | [ ] working days |
| Integrations and UAT | Providers, hardware, migration rehearsal and testing | [ ] working days |
| Go-live and hypercare | Cutover, support and handover | [ ] working days |

## Commercial items

| Item | Proposal value |
|---|---|
| Product configuration and implementation | [Amount / currency] |
| Customer, admin, POS and delivery applications | [Included / amount] |
| Data migration and onboarding | [Included / amount] |
| Payment, tax, logistics and messaging integrations | [Scope / amount] |
| Hosting and managed operations | [Amount / period] |
| Support and SLA | [Tier / amount] |
| Hardware and third-party provider fees | [Excluded / amount] |
| Taxes | [Applicable taxes] |
| Payment milestones | [Milestone schedule] |

**Reference only:** commercial values and the final 40-working-day schedule must be confirmed after discovery. GST, third-party services, hardware, data cleansing beyond agreed rules and out-of-scope change requests are excluded unless stated otherwise.

<!-- PAGE -->
# Assumptions, Risks and Next Steps

## Assumptions

- Simhapuri Fresh will nominate business owners for grocery, finance, inventory and delivery decisions.
- Source products, categories, brands, prices, tax codes, opening stock and customers will be supplied in agreed templates.
- Payment, notification, logistics, tax and hardware providers will be selected by the client or jointly approved.
- Client users will participate in UAT and role-based training.
- Hosting, domains, certificates and production access will be available before cutover.
- Final functionality is governed by the signed scope and acceptance criteria.

## Key risks to resolve early

- Product units and weighted-goods billing rules
- Stock opening balance and warehouse reconciliation
- GST/HSN master quality and tax treatment
- Payment settlement and refund reconciliation
- Delivery zone, fee and cash-collection policy
- POS device and thermal-printer compatibility
- Notification consent and provider availability
- Investor or revenue-sharing calculation rules

## Next steps

1. Confirm the Simhapuri Fresh business profile, locations and operating roles.
2. Approve the module scope and mark each item as launch, phase two or future.
3. Conduct catalogue, inventory, finance, delivery and integration workshops.
4. Provide master data and nominate UAT owners.
5. Finalize timeline, commercials, support tier and signatories.

<!-- PAGE -->
# Project Approval and Closing

Sankalp ERP Platform is proposed as the operating foundation for Simhapuri Fresh's grocery business. The solution is designed to connect customer demand, store billing, stock control, delivery execution, finance and management visibility in one governed platform.

The proposal is intentionally structured for refinement. The target product is described in sufficient detail for commercial and operational discussion, while the implementation status section identifies the capabilities that still require completion, configuration or client confirmation.

## Approval

**For Simhapuri Fresh**

Authorized signatory: ____________________________________

Designation: ____________________________________________

Signature: ______________________________________________

Date: __________________________________________________

## Provider

**Sankalp**

Website: [Website URL]

Email: [Contact email]

Phone: [Contact phone]

**Platform:** Sankalp ERP Platform
