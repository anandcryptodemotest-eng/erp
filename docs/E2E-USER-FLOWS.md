# E2E User-Based Flows

This guide defines end-to-end use cases per user role currently implemented in the platform and provides an automated script for API validation.

## Supported Roles in Current Implementation

- ADMIN
- MANAGER
- USER

Note: Architecture docs mention domain personas like SALES_REP and ACCOUNTANT, but the current auth + tenant membership API enforces ADMIN/MANAGER/USER in runtime role checks.

## Prerequisites

- Gateway and services running:
  - Gateway (3010)
  - Sales (3001)
  - Inventory (3002)
  - Accounting (3003)
  - HR (3004)
  - Procurement (3005)
- PostgreSQL running and seeded data available.
- Seed admin account:
  - Email: admin@simhapurifresh.com
  - Password: Admin@123
  - Tenant: simhapuri-fresh

## Role-Wise E2E Use Cases

## 1) ADMIN Flow

Goal: tenant administration + high privilege business actions.

Steps:

1. Login as admin.
2. Invite manager and user members to tenant.
3. List tenant users.
4. Delete vendor (admin-only operation).

Expected:

- Invite endpoint succeeds for admin.
- User list endpoint returns all members.
- Vendor delete succeeds for admin.

## 2) MANAGER Flow

Goal: operational approvals and updates without destructive admin-only actions.

Steps:

1. Login as manager.
2. Switch to seeded tenant context.
3. Create and update vendor.
4. Create and submit purchase order.
5. Approve purchase order.
6. Attempt to delete vendor.

Expected:

- Vendor create/update succeeds.
- PO submit/approve succeeds.
- Vendor delete is denied (403).

## 3) USER Flow

Goal: read and limited operations; restricted from sensitive approvals/updates.

Steps:

1. Login as user.
2. Switch to seeded tenant context.
3. Read list endpoints (vendors/orders).
4. Attempt privileged actions:
   - Update vendor
   - Approve purchase order

Expected:

- Read endpoints succeed.
- Privileged actions are denied with 403.

## Automated Script

Run:

```bash
bash scripts/e2e-user-flows.sh
```

What it validates:

- Admin login.
- Register/login manager and user.
- Invitation acceptance and tenant switching.
- Manager denied on admin-only tenant invite.
- Admin member list.
- Vendor lifecycle authorization matrix:
  - manager create/update: allowed
  - user update: denied
  - manager delete: denied
  - admin delete: allowed
- Purchase order approval authorization matrix:
  - user approve: denied
  - manager approve: allowed

## Optional Environment Overrides

You can override defaults:

- BASE_URL (default: http://localhost:3010)
- ADMIN_EMAIL (default: admin@simhapurifresh.com)
- ADMIN_PASSWORD (default: Admin@123)
- TENANT_SLUG (default: simhapuri-fresh)
- E2E_PASSWORD (default: Pass@12345)

Example:

```bash
BASE_URL=http://localhost:3010 TENANT_SLUG=simhapuri-fresh bash scripts/e2e-user-flows.sh
```
