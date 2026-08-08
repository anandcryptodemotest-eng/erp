# Simhapuri Fresh
## HR and Payroll Management Module

**Proposal status:** Completed capability summary
**Platform:** Sankalp ERP Platform
**Prepared for:** Simhapuri Fresh
**Date:** 06 August 2026
**Version:** 1.0

<!-- PAGE -->
# HR Operations Overview

Sankalp ERP provides Simhapuri Fresh with a tenant-secure HR and payroll foundation for maintaining employee records, configuring income-tax slabs, managing leave requests, preparing payroll, issuing payslips and posting the related financial entries to accounting.

The current implementation is designed for controlled administration by authorized HR and management users. Employee and payroll records are tenant-scoped, validated at the API boundary and connected to the accounting service through authenticated service calls.

## Completed capability summary

- Employee master records
- Employee ID and email uniqueness within a tenant
- Department, position, hire date and salary details
- Employee bank account and bank name fields
- Active/inactive employee status with soft deactivation
- Employee detail view with recent payroll and leave history
- Delivery-executive attributes for employees who perform delivery work
- Tenant-scoped APIs and role-based write controls

## Current user access

- **Admin:** full HR administration and payroll control
- **Manager:** employee updates, tax-slab management, leave approval and payroll operations
- **Authorized employee context:** records are restricted by tenant and authenticated request context

<!-- PAGE -->
# Leave and Tax Management

## Leave management

The completed leave workflow allows authorized users to create, list, inspect and manage employee leave requests.

### Available features

- Leave request creation
- Annual, sick, personal, maternity, paternity and unpaid leave types
- Start date, end date and reason
- Paginated leave listing
- Filter by employee and status
- Employee identity shown with each request
- Manager or Admin approval
- Manager or Admin rejection
- Employee-side cancellation for pending or approved requests
- Protected state transitions
- Tenant-scoped leave records

### Leave states

```text
PENDING -> APPROVED
       \-> REJECTED
PENDING / APPROVED -> CANCELLED
```

## Tax slabs

Authorized HR and management users can configure active tax slabs used during payroll calculation.

- Tax slab name and description
- Minimum and maximum income range
- Percentage rate
- Active status
- Employee assignment to a tax slab
- Paginated tax-slab listing
- Tax-slab detail with assigned employees
- Tenant-scoped configuration

Tax rules are configurable foundations. Final statutory treatment remains subject to the tax policy approved by Simhapuri Fresh and its finance advisers.

<!-- PAGE -->
# Payroll and Accounting Integration

The completed payroll workflow supports employee-level monthly payroll records and the following controlled state machine:

```text
DRAFT -> PROCESSED -> PAID
```

## Payroll features

- Payroll creation for an employee and period
- Unique employee-period payroll record
- Basic salary sourced from the employee record
- Allowance input
- Deduction input
- Tax calculation from the assigned tax slab
- Gross pay and net pay calculation
- Paginated payroll listing
- Filtering by period, employee and status
- Payroll detail with employee and payslip
- Protected processing and payment actions
- Duplicate payroll prevention

## Payslips

Processing a draft payroll creates a payslip in the same database transaction and records the processed timestamp.

Payslips include:

- Employee and payroll period
- Gross pay
- Tax
- Other deductions
- Net pay
- Issue timestamp
- Link to the source payroll record

## Accounting entries

Payroll processing posts the salary expense and payable entries to the accounting service. Marking payroll as paid posts the settlement entry between salary payable and bank or cash.

- Salary expense debit
- Salary payable credit
- Tax deducted at source payable credit
- Other deductions payable credit where applicable
- Salary payable debit on settlement
- Bank or cash credit on settlement
- Payroll reference on accounting journals
- Authenticated HR-to-accounting service call

# Administration, Delivery and Acceptance

## Current administration experience

The current admin portal provides an employee navigation entry and a payroll screen for:

- Listing payroll records
- Creating payroll for an employee and period
- Entering allowances and deductions
- Processing draft payroll
- Marking processed payroll as paid
- Viewing payroll status and net salary
- Selecting employees from the employee list

## Delivery workforce support

The employee model includes completed delivery workforce fields used by the delivery operating model:

- Delivery-executive flag
- Availability status
- Vehicle type
- Vehicle number
- Current order reference

## Security and controls

- Tenant ID is read from authenticated request headers
- Business queries are tenant-scoped
- Request bodies are validated with Zod
- Payroll and employee writes require authorized roles
- Employee records use soft deactivation
- Payroll processing creates payslips transactionally
- Accounting calls use the configured service client
- Customer or employee financial records are not shared across tenants

## Completed HR acceptance journey

1. Create an employee with salary and hire date.
2. Assign a tax slab if required.
3. Create a payroll record for a period.
4. Enter allowances and deductions.
5. Process payroll and create the payslip.
6. Confirm the salary journal in accounting.
7. Mark payroll as paid.
8. Confirm the payment journal in accounting.

**Platform:** Sankalp ERP Platform
**Prepared for:** Simhapuri Fresh
