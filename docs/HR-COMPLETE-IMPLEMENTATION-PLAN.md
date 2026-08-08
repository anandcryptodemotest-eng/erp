# Simhapuri Fresh HR Platform
## Complete Recruitment, Hiring, Onboarding, Employee Portal and Payroll Plan

**Product:** Sankalp ERP Platform
**Tenant:** Simhapuri Fresh
**Status:** Planning baseline for implementation refinement
**Date:** 06 August 2026

## 1. Objective

Build a complete HR operating system for Simhapuri Fresh covering the employee lifecycle from workforce planning and recruitment through hiring, onboarding, attendance, leave, payroll, payment, employee self-service, performance, documents and exit.

The HR service remains the system of record for employee and people data. Accounting remains the system of record for journals, payable balances, bank or cash entries and financial reconciliation. Gateway remains the system of record for identity, tenant membership, roles, invitations, notifications and communication.

The plan is intentionally divided into launch, phase two and future scope. Existing payroll, payslip, leave and employee foundations are reused and hardened rather than replaced.

## 2. Current baseline

### Existing HR foundations

- Employee record with tenant scope, employee ID, profile, department, position, hire date and salary
- Tax slabs and employee tax-slab assignment
- Payroll records with DRAFT, PROCESSED and PAID states
- Payslip records
- Leave requests with PENDING, APPROVED, REJECTED and CANCELLED states
- Delivery-executive fields on employees
- Payroll journal posting to accounting when payroll is processed
- Bank or cash journal posting when payroll is marked paid
- Employee, payroll, tax-slab and leave APIs with pagination and Zod validation foundations
- Admin payroll page and employee navigation

### Known gaps

- Recruitment, vacancies, candidates, interviews and offer management
- Employee onboarding checklist and document collection
- Employee self-service portal
- Employee payment preferences, bank verification and payment batch controls
- Payroll run-level processing and approval
- Salary structures, earnings, deductions, statutory contributions and arrears
- Attendance, shifts, overtime and payroll inputs
- Leave balances, policies, holidays and accruals
- HR documents, acknowledgements and expiry tracking
- Performance, training, announcements and employee communication
- Full HR administration screens and role/permission administration

## 3. Actors and portals

| Actor | Portal | Main responsibilities |
|---|---|---|
| HR Manager | HR administration | People records, recruitment, onboarding, policies, payroll preparation and reports |
| Admin / Owner | Admin portal | Full HR access, approvals, payment authorization and configuration |
| Department Manager | Manager portal | Requisitions, interview feedback, onboarding tasks, leave and approvals |
| Recruiter | HR administration | Vacancies, candidates, interviews, offers and recruitment communication |
| Payroll Officer | HR administration | Payroll inputs, validation, processing, payslips and reconciliation |
| Accountant | Accounting portal | Journals, liabilities, payment reconciliation and statutory finance reports |
| Employee | Employee self-service | Profile, documents, attendance, leave, payslips, claims and requests |
| Candidate | Candidate experience | Application, profile, interview scheduling and offer acceptance |
| Auditor | Read-only administration | Reports, audit trail, payroll and approval evidence |

## 4. End-to-end employee lifecycle

```text
Workforce Plan
    -> Requisition DRAFT -> SUBMITTED -> APPROVED -> OPEN -> CLOSED
    -> Candidate APPLIED -> SCREENING -> SHORTLISTED -> INTERVIEW -> SELECTED
    -> Offer DRAFT -> SENT -> ACCEPTED -> DECLINED / EXPIRED
    -> Employee PRE_HIRE -> ONBOARDING -> ACTIVE
    -> Leave / Attendance / Payroll / Performance / Documents
    -> NOTICE_PERIOD -> EXIT_PROCESS -> SEPARATED -> ARCHIVED
```

Every transition must be role-controlled, tenant-scoped and recorded in an audit event. A candidate becomes an employee only after an accepted offer or an authorized manual hire flow.

## 5. Module 1: Workforce planning and requisitions

### Features

- Department and position master data
- Headcount plan by department, location and period
- Job requisition creation
- Replacement or new-position reason
- Required skills, experience, education and salary range
- Employment type: full-time, part-time, contract, temporary or intern
- Hiring manager and recruiter assignment
- Approval chain and budget check
- Vacancy publication status
- Requisition history and audit trail

### Requisition state machine

```text
DRAFT -> SUBMITTED -> APPROVED -> OPEN -> ON_HOLD -> CLOSED
                    \-> REJECTED
```

### Acceptance criteria

- A manager can submit a requisition without changing its approver or budget data.
- HR can approve, reject, publish or close a requisition according to role.
- Only approved and open requisitions can accept new applications.
- Closing a requisition preserves candidates and decisions.

## 6. Module 2: Recruitment and applicant tracking

### Candidate profile

- Candidate ID
- Name, email, phone and location
- Resume and portfolio attachments
- Skills, education and experience
- Source: referral, website, agency, walk-in or other
- Consent and communication preference
- Notice period and expected compensation
- Application history
- Duplicate candidate detection by tenant and contact details

### Recruitment workflow

```text
APPLIED -> SCREENING -> SHORTLISTED -> INTERVIEW
                                  \-> REJECTED
INTERVIEW -> SELECTED -> OFFERED -> HIRED
          \-> REJECTED
OFFERED -> ACCEPTED / DECLINED / EXPIRED
```

### Features

- Candidate list with search, filters and pagination
- Candidate-to-requisition applications
- Resume preview and secure download
- Screening scorecard
- Recruiter notes and activity timeline
- Candidate source and funnel reports
- Bulk communication through approved templates
- Rejection reasons and reusable talent pool
- Candidate-to-employee conversion with duplicate prevention

Candidate documents must use the existing authenticated upload and asset controls. Public application links must use expiring, scoped tokens and must never expose tenant data.

## 7. Module 3: Interviews and selection

### Features

- Interview stages and panel members
- Interview type: phone, video, in-person or practical
- Calendar date, time zone, location or meeting link
- Candidate and interviewer notifications
- Interview scorecards by competency
- Independent interviewer feedback
- Consolidated hiring recommendation
- Reschedule and cancellation history
- Conflict and missing-feedback indicators
- Selection approval before offer creation

### Rules

- Interviewers can edit only their own feedback after submission.
- Hiring managers can see panel feedback but cannot rewrite individual submissions.
- A candidate cannot move to SELECTED until required scorecards are complete.
- Rejection decisions require a reason.

## 8. Module 4: Offers and pre-hire conversion

### Offer features

- Offer template and version
- Designation, department, location and reporting manager
- Joining date and probation period
- Compensation structure and salary components
- Benefits and allowances
- Notice period
- Conditions and attachments
- Approval before sending
- Secure candidate acceptance page
- Offer expiry and withdrawal
- Electronic acknowledgement or signature integration point

### Offer state machine

```text
DRAFT -> APPROVAL_PENDING -> APPROVED -> SENT -> ACCEPTED
                                      \-> WITHDRAWN
SENT -> DECLINED / EXPIRED
```

On acceptance, the system creates a PRE_HIRE employee profile with a generated employee ID, but does not activate payroll until onboarding and bank/payment requirements are complete.

## 9. Module 5: Employee master and organizational structure

### Employee profile

- Employee number and legal name
- Preferred name and profile image
- Contact details and emergency contacts
- Date of birth and demographic fields where legally required
- Government or statutory identifiers with restricted access
- Department, designation, manager and location
- Employment type and status
- Hire date, confirmation date and separation date
- Salary structure and effective-dated history
- Bank account and payment method
- Tax profile and declarations
- Skills, qualifications and certifications
- Documents and acknowledgements
- Delivery-executive attributes where applicable

### Organization masters

- Departments
- Designations and job levels
- Locations and branches
- Reporting hierarchy
- Employment types
- Pay grades
- Cost centers
- Holiday calendars
- Work schedules and shifts

Use effective-dated records for changes to manager, department, designation, location and compensation. Historical payroll and payslips must never change when an employee profile changes later.

## 10. Module 6: Onboarding and employee lifecycle

### Onboarding workflow

```text
PRE_HIRE -> ONBOARDING -> DOCUMENTS_PENDING -> READY_FOR_JOINING
         -> ACTIVE
         \-> CANCELLED
```

### Onboarding checklist

- Offer and joining confirmation
- Identity and address documents
- Tax and statutory declarations
- Bank account and payment verification
- Emergency contact
- Policy acknowledgement
- Employment agreement
- IT or equipment allocation
- Access request and role assignment
- Department induction
- Safety and operational training
- First-day attendance
- Probation review date

### Checklist design

- Template by department, location and employment type
- Required versus optional tasks
- Task owner and due date
- Employee, HR, manager or IT task type
- Attachment requirement
- Reminder and escalation
- Completion evidence
- Checklist completion percentage
- Blocking items before ACTIVE status

### Offboarding

- Resignation or termination request
- Notice period and last working date
- Exit approval
- Handover checklist
- Asset return
- Access revocation
- Final attendance and leave calculation
- Full-and-final payroll
- Experience or relieving letter
- Exit interview
- Separation and archive

## 11. Module 7: Employee self-service portal

The employee portal should be a separate protected experience within the existing authenticated platform, using the employee's user identity and tenant membership. Employees must never receive another employee's payroll, documents or personal data.

### Home dashboard

- Current employment status
- Attendance summary
- Leave balance and pending requests
- Latest payslip and payment status
- Open onboarding or HR tasks
- Announcements
- Documents requiring acknowledgement
- HR request status

### My profile

- Personal and contact details
- Emergency contacts
- Address
- Bank/payment details with masked display
- Tax declarations
- Skills and qualifications
- Change requests requiring HR approval

### Leave and attendance

- Leave balance by type
- Leave calendar
- Apply, cancel and track leave
- Attendance calendar
- Check-in/check-out where enabled
- Regularization request
- Overtime or extra-hours request
- Holiday calendar

### Payroll and payments

- Payslip list by period
- Payslip detail and PDF download
- Gross, earnings, deductions, tax and net pay breakdown
- Payment date and payment reference
- Salary revision history
- Bank account update request
- Tax document download
- Reimbursement and expense claims

### Documents and requests

- Upload required documents
- View approved documents
- Download letters and payslips
- Acknowledge policies
- Create HR request or ticket
- Track request status and staff responses

## 12. Module 8: Attendance, shifts and payroll inputs

### Attendance

- Work schedule and shift assignment
- Daily attendance records
- Present, absent, half-day, holiday and leave statuses
- Check-in/check-out integration point
- Attendance correction request
- Manager approval
- Late and early departure rules
- Overtime input and approval
- Monthly attendance lock before payroll

### Payroll input controls

- Approved leave and unpaid leave
- Attendance deductions
- Overtime
- Incentives and bonuses
- Commissions
- Reimbursements
- Loan or advance deductions
- Salary revisions and arrears
- New joiner and exit proration
- Manual adjustments with reason and approval

Attendance is a prerequisite for payroll only when Simhapuri Fresh chooses attendance-based payroll. Fixed monthly salary payroll can run with attendance as an informational or deduction input.

## 13. Module 9: Leave and time-off management

### Policy model

- Leave types: annual, sick, personal, maternity, paternity, unpaid and custom
- Annual entitlement
- Accrual frequency
- Carry-forward limit
- Encashment rule
- Probation eligibility
- Maximum consecutive days
- Supporting-document requirement
- Half-day and hourly leave
- Holiday calendar
- Blackout dates
- Approval chain by department or manager

### Leave workflow

```text
DRAFT -> PENDING -> APPROVED -> TAKEN
                 \-> REJECTED
PENDING / APPROVED -> CANCELLED
```

### Controls

- Prevent overlapping approved leave
- Validate available balance unless unpaid leave is allowed
- Calculate working days excluding holidays and weekly offs
- Lock approved leave included in a processed payroll run
- Maintain accrual ledger instead of deriving balances only from requests

## 14. Module 10: Compensation and salary structures

### Salary structure

- Pay grade and salary band
- Basic salary
- House rent or location allowance
- Transport allowance
- Food or meal allowance
- Incentives and commissions
- Employer contributions
- Employee deductions
- Tax and statutory deductions
- Reimbursement components
- Effective-from date
- Revision reason and approval

### Calculation rules

- Gross earnings
- Pre-tax deductions
- Taxable income
- Statutory deductions
- Post-tax deductions
- Net pay
- Proration for joining, exit and unpaid leave
- Arrears and retroactive revisions
- Rounding policy

Use a versioned salary structure. Payroll must reference the exact structure version used for calculation.

## 15. Module 11: Payroll runs

The current employee-level payroll record must be extended with a payroll-run aggregate so HR can prepare, review, approve and pay a complete period safely.

### Payroll run workflow

```text
DRAFT -> INPUTS_LOCKED -> CALCULATED -> REVIEW_PENDING
      -> APPROVED -> PROCESSED -> PAYMENT_PENDING -> PAID
      \-> CANCELLED
```

### Payroll run features

- Period and payroll calendar
- Employee inclusion and exclusion
- Joiner and leaver proration
- Attendance and leave import
- Earnings and deduction inputs
- Tax and statutory calculation
- Draft calculation preview
- Employee-level exception list
- Variance versus prior period
- Approval workflow
- Payroll lock and immutable snapshot
- Payslip generation
- Accounting journal creation
- Payment batch creation
- Bank export or payment-provider integration
- Payment reconciliation
- Reversal and correction workflow

### Payroll controls

- One active run per tenant and period
- No duplicate employee-period payroll
- Cannot process without required bank or payment data unless manual payment is approved
- Cannot change employee inputs after INPUTS_LOCKED without reopening with authority
- Processed payroll is immutable; corrections use adjustment or reversal records
- Journal posting and payroll status must be reconciled
- Payment status is distinct from payroll processing status

## 16. Module 12: Employee payment and bank operations

### Payment profile

- Payment method: bank transfer, cash, cheque or other approved method
- Bank name and account number with encryption or protected storage
- IFSC or local bank routing code
- Account holder name
- Verification status and verified date
- Effective-from date
- Change history
- Employee change request and HR approval

Do not store full bank details in frontend logs, audit messages or ordinary employee list responses. Mask account numbers in UI and restrict access to HR Manager, Payroll Officer and authorized Admin roles.

### Payment batch

- Create payment batch from APPROVED or PROCESSED payroll
- Select bank account or payment provider
- Generate payment instructions
- Maker-checker approval
- Export bank file or invoke provider API
- Record provider reference
- Track submitted, accepted, failed and settled payments
- Import reconciliation result
- Retry failed payment without duplicating successful payments
- Post bank journal only after the configured payment event
- Generate employee payment confirmation

### Payment state machine

```text
READY -> APPROVAL_PENDING -> APPROVED -> SUBMITTED
      -> PARTIALLY_SETTLED -> SETTLED
      \-> FAILED -> RETRY / MANUAL_REVIEW
```

Payroll PAID should mean the payment obligation is settled or explicitly marked as paid through an authorized manual process. PROCESSED must not be treated as bank payment.

## 17. Module 13: Reimbursements, advances and expenses

### Employee claims

- Travel and transportation
- Mobile or communication
- Meals
- Medical or approved benefits
- Other business expenses
- Receipt upload
- Claim policy validation
- Manager and finance approval
- Payroll or separate payment settlement

### Advances and loans

- Advance request
- Approval and disbursement
- Repayment schedule
- Payroll deduction
- Outstanding balance
- Early settlement
- Accounting journal linkage

## 18. Module 14: Documents, compliance and records

### Document categories

- Identity and address proof
- Tax and statutory documents
- Employment agreement
- Offer and joining documents
- Education and certificates
- Bank verification
- Payslips and tax statements
- Warning, promotion and salary letters
- Exit and experience documents

### Controls

- Required-document checklist
- Verification status
- Expiry date and reminders
- Version history
- Employee acknowledgement
- Restricted document visibility
- Download audit
- Retention and archive policy
- Secure attachment storage

Compliance rules must be confirmed for the jurisdictions where Simhapuri Fresh employs staff. The system should support configuration, not hard-code a tax or statutory regime without approval.

## 19. Module 15: Performance, training and engagement

### Performance

- Review cycle
- Goals and key results
- Manager and employee self-review
- Competency scorecard
- Review comments and acknowledgement
- Improvement plan
- Promotion and salary-revision recommendation

### Training

- Training catalogue
- Assignment by role or department
- Attendance and completion
- Certification and expiry
- Safety and food-handling training for applicable grocery roles

### Engagement

- Announcements
- Policy communication
- Employee recognition
- Surveys or pulse checks
- HR communication history

These are phase-two capabilities unless Simhapuri Fresh requires them for launch.

## 20. Module 16: HR reports and dashboards

### Workforce reports

- Headcount by department, location and status
- Joiners and exits
- Attrition and tenure
- Open vacancies and recruitment funnel
- Time to hire
- Offer acceptance rate
- Onboarding completion

### Payroll reports

- Payroll register
- Gross-to-net summary
- Earnings and deductions
- Tax and statutory deductions
- Employer contributions
- Payment status and failures
- Payroll variance
- Salary cost by department and cost center
- Payslip issuance report

### Attendance and leave reports

- Attendance summary
- Absence and lateness
- Overtime
- Leave utilization and balances
- Pending approvals
- Leave liability and carry-forward

### Security and audit reports

- Profile changes
- Salary changes
- Bank detail changes
- Payroll approvals
- Payment batches
- Document access
- Role and permission changes

## 21. Proposed data model additions

The existing Employee, TaxSlab, PayrollRecord, Payslip and LeaveRequest models should be retained but extended with proper enums, money precision strategy, effective dates and audit relationships.

### Recruitment

- Department
- Designation
- JobRequisition
- JobApproval
- Candidate
- CandidateApplication
- CandidateDocument
- Interview
- InterviewPanelMember
- InterviewFeedback
- Offer
- OfferApproval

### Employee lifecycle

- EmployeeProfileExtension
- EmploymentHistory
- ReportingLine
- SalaryStructure
- SalaryComponent
- EmployeeSalaryAssignment
- OnboardingTemplate
- OnboardingTask
- EmployeeOnboarding
- EmployeeDocument
- EmployeeAcknowledgement
- SeparationCase
- ExitTask
- ExitInterview

### Time and benefits

- WorkSchedule
- Shift
- EmployeeShiftAssignment
- AttendanceRecord
- AttendanceCorrection
- OvertimeRequest
- LeavePolicy
- LeaveBalance
- LeaveLedgerEntry
- HolidayCalendar
- Holiday

### Payroll and payment

- PayrollRun
- PayrollRunEmployee
- PayrollInput
- PayrollComponentResult
- PayrollAdjustment
- PaymentProfile
- PaymentChangeRequest
- PaymentBatch
- PaymentInstruction
- PaymentReconciliation
- ReimbursementClaim
- EmployeeAdvance

### Governance and extension

- HRRequest
- Announcement
- TrainingCourse
- TrainingAssignment
- PerformanceCycle
- PerformanceReview
- HRAuditEvent

All business models require tenantId and tenant indexes. Cross-service references to accounting, gateway users, assets or communication records remain string IDs, not Prisma relations.

## 22. API surface

### Recruitment

```text
GET/POST   /api/hr/requisitions
GET/PATCH  /api/hr/requisitions/:id
POST       /api/hr/requisitions/:id/submit
POST       /api/hr/requisitions/:id/approve
POST       /api/hr/requisitions/:id/publish
POST       /api/hr/requisitions/:id/close
GET/POST   /api/hr/candidates
GET/PATCH  /api/hr/candidates/:id
POST       /api/hr/candidates/:id/applications
GET/POST   /api/hr/applications/:id/interviews
POST       /api/hr/interviews/:id/feedback
POST       /api/hr/applications/:id/select
GET/POST   /api/hr/offers
POST       /api/hr/offers/:id/send
POST       /api/hr/offers/:id/accept
POST       /api/hr/offers/:id/decline
POST       /api/hr/offers/:id/convert-to-employee
```

### Employees and onboarding

```text
GET/POST   /api/employees
GET/PATCH  /api/employees/:id
GET        /api/employees/:id/timeline
GET/POST   /api/employees/:id/documents
GET/POST   /api/employees/:id/onboarding
PATCH      /api/onboarding/tasks/:id
POST       /api/employees/:id/activate
POST       /api/employees/:id/separate
```

### Self-service

```text
GET        /api/me/hr-profile
PATCH      /api/me/hr-profile/request-change
GET        /api/me/payslips
GET        /api/me/payslips/:id
GET        /api/me/leave-balances
GET/POST   /api/me/leave
GET/POST   /api/me/attendance-corrections
GET/POST   /api/me/claims
GET/POST   /api/me/documents
GET/POST   /api/me/hr-requests
```

### Attendance, leave and payroll

```text
GET/POST   /api/attendance
POST       /api/attendance/import
POST       /api/attendance/:id/regularize
GET/POST   /api/leave-policies
GET        /api/leave-balances
GET/POST   /api/payroll-runs
GET        /api/payroll-runs/:id
POST       /api/payroll-runs/:id/calculate
POST       /api/payroll-runs/:id/lock
POST       /api/payroll-runs/:id/approve
POST       /api/payroll-runs/:id/process
POST       /api/payroll-runs/:id/create-payment-batch
```

### Payments and reports

```text
GET/POST   /api/payment-profiles
POST       /api/payment-profiles/:id/verify
GET        /api/payment-batches
POST       /api/payment-batches/:id/approve
POST       /api/payment-batches/:id/submit
POST       /api/payment-batches/:id/reconcile
GET        /api/hr/reports/headcount
GET        /api/hr/reports/recruitment
GET        /api/hr/reports/payroll
GET        /api/hr/reports/leave
GET        /api/hr/reports/audit
```

Every list endpoint must paginate. Every mutation must derive tenantId, userId and role from middleware-injected headers. Payroll and payment mutations must use transactions and idempotency keys where an external provider or journal is involved.

## 23. Portal information architecture

### HR administration

- HR dashboard
- Organization and masters
- Requisitions
- Candidates and applications
- Interviews
- Offers
- Employees
- Onboarding
- Attendance
- Leave and policies
- Payroll runs
- Payment batches
- Claims and advances
- Documents
- Performance and training
- Reports
- HR settings and audit

### Employee portal

- Home
- My profile
- My attendance
- My leave
- My payslips
- My payment details
- My documents
- My claims
- My requests
- Announcements

### Candidate experience

- Application form
- Resume and document upload
- Application status
- Interview schedule
- Offer review and acceptance

## 24. Permissions and separation of duties

| Capability | HR Manager | Manager | Payroll Officer | Accountant | Employee | Admin |
|---|---:|---:|---:|---:|---:|---:|
| Recruitment and requisitions | Full | Approve | Read | Read | No | Full |
| Employee profile | Full | Team only | Read needed fields | Read finance fields | Own only | Full |
| Salary structures | Full | Recommend | Full | Review | Own view | Full |
| Leave approval | Full | Team only | Read | No | Request/cancel own | Full |
| Payroll calculation | Full | No | Full | Review | Own view | Full |
| Payroll approval | Approve | No | Prepare | Approve finance | No | Full |
| Payment batch submission | No or maker | No | Prepare | Checker | No | Approve |
| Bank details | Verify | No | Restricted | No or masked | Request own change | Full |
| Payslips | All authorized | Team view if allowed | Full | Finance view | Own only | Full |
| Employee documents | Full | Team required | Payroll docs | Finance docs | Own only | Full |

Use maker-checker separation for payroll approval, bank payment submission and salary changes where possible. The exact role names should align with the gateway's supported tenant roles and may require adding HR_MANAGER, PAYROLL_OFFICER and RECRUITER capabilities.

## 25. Accounting integration

### Payroll processing

At process time, HR sends an idempotent journal request to accounting:

- Debit: salary expense by cost center
- Credit: salary payable
- Credit: tax or statutory payable
- Credit: other deductions payable
- Credit: employer contribution payable where applicable

### Payment settlement

At settlement time, the payment batch posts:

- Debit: salary payable
- Credit: bank or cash account

The accounting reference must contain tenant, payroll run and payment batch identifiers. If a journal call fails, HR must expose a reconciliation state and must not silently leave payroll marked as complete.

## 26. Delivery roadmap

### Phase 0 - HR foundation hardening

- Fix and standardize HR route conventions and role checks
- Add enums, validation, money precision and audit events
- Harden existing employee, payroll, payslip, leave and tax APIs
- Correct employee ID versus database ID contract inconsistencies
- Add payroll run aggregate and idempotent accounting integration

**Exit:** current hire-to-payroll flow remains green and payroll status reconciles with accounting.

### Phase 1 - Employee master and onboarding

- Organization masters
- Employee profile extension and documents
- Offer-to-employee conversion
- Onboarding templates and tasks
- Employee activation and separation baseline
- HR admin employee screens

**Exit:** accepted offer creates a controlled pre-hire employee and onboarding completion activates the employee.

### Phase 2 - Recruitment

- Requisitions and approvals
- Candidate and application tracking
- Interviews and scorecards
- Offer generation, approval and acceptance
- Recruitment funnel reports

**Exit:** requisition-to-accepted-offer journey passes with permissions and audit evidence.

### Phase 3 - Employee self-service

- Employee identity mapping
- Self-service profile
- Leave balances and requests
- Payslip list and secure downloads
- Documents and HR requests
- Announcements

**Exit:** an employee can access only their own records and complete a leave-to-payslip self-service journey.

### Phase 4 - Attendance, leave and compensation

- Work schedules and attendance
- Leave policies, balances and accrual ledger
- Overtime and payroll inputs
- Salary structures and effective-dated revisions
- Claims and advances

**Exit:** approved inputs produce a reproducible payroll preview with exception reporting.

### Phase 5 - Payroll and employee payment

- Payroll runs and employee inclusion
- Lock, calculate, review, approve and process
- Payslip generation
- Payment profiles and verification
- Payment batches, maker-checker and reconciliation
- Accounting journals and correction workflow

**Exit:** payroll can be processed, approved, paid, reconciled and safely retried without duplicates.

### Phase 6 - Advanced HR

- Performance and reviews
- Training and certifications
- Advanced reports and dashboards
- Statutory exports
- Candidate portal and public careers page
- Provider integrations for bank files, attendance devices and notifications

**Exit:** agreed advanced HR scope is accepted by HR, finance and employee representatives.

## 27. Testing and acceptance strategy

### Security tests

- Tenant isolation on every HR endpoint
- Employee cannot access another employee's profile, payslip, bank details or documents
- Candidate cannot access another candidate's application
- Role checks for salary, payroll, approval and payment operations
- Sensitive bank and statutory fields are masked and not logged
- Expired document links and offer links fail closed

### Workflow tests

- Requisition approval and rejection
- Candidate screening through offer acceptance
- Onboarding blocking tasks
- Employee activation and separation
- Leave balance and overlap validation
- Attendance lock and payroll input import
- Payroll calculation, approval, process, payment and retry
- Accounting journal idempotency and reconciliation

### Business acceptance journeys

1. Requisition -> candidate -> interview -> accepted offer -> onboarding -> active employee
2. Employee profile -> salary structure -> payroll preview -> payslip
3. Employee leave request -> manager approval -> payroll input
4. Payroll run -> approval -> payment batch -> bank reconciliation
5. Employee self-service -> payslip download -> bank change request approval
6. Employee resignation -> final settlement -> access revocation -> separation

## 28. Decisions required from Simhapuri Fresh

- Legal entity, work locations and jurisdictions
- Employee count and expected hiring volume
- Departments, designations and reporting structure
- Employment types and probation rules
- Salary components and pay frequency
- Tax and statutory regime
- Bank payment method and provider or bank-file format
- Attendance device or integration requirement
- Leave policy, holidays and accrual rules
- Payroll cut-off and pay date
- Approval hierarchy and separation of duties
- Required employee documents and retention period
- Whether recruitment should include a public careers page
- Whether performance, training and claims are launch scope or phase two
- Required language, currency and timezone

## 29. Recommended launch scope

For a reliable first HR release, launch with:

- Employee master and organization structure
- Recruitment requisitions, candidates, interviews and offers
- Onboarding checklist and documents
- Employee self-service profile, leave, documents and payslips
- Leave policies and balances
- Salary structures and payroll runs
- Payroll approval, accounting journals and payment batches
- Payment profiles with maker-checker controls
- Core HR, payroll and security reports
- Audit trail and tenant-safe role permissions

Move performance, training, public careers, advanced attendance devices, automated statutory filings and complex revenue-linked incentives to phase two unless they are contractual launch requirements.

## 30. Definition of done

The HR platform is ready for production when:

- Recruitment through onboarding is traceable and permissioned.
- Employee self-service works on desktop and mobile.
- Employee data, documents, bank details and payslips are tenant-safe.
- Leave balances and payroll inputs are reproducible.
- Payroll has run-level approval, immutable snapshots and correction paths.
- Payment batches support maker-checker, provider response and reconciliation.
- Accounting journals are balanced, idempotent and auditable.
- HR and finance reports reconcile to source records.
- UAT covers employees, managers, HR, payroll, finance and administrators.
- Backup, monitoring, support and data-retention procedures are approved.
