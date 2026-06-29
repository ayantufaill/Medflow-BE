# Database Schema Documentation

**Database:** SQL Server  
**ORM:** Prisma  
**Last Updated:** 2026-06-29

---

## Table of Contents

1. [rxpat (RX)](#rxpat-rx)
2. [labcase (Lab Case)](#labcase-lab-case)
3. [medication](#medication)
4. [recurringcharge (Recurring)](#recurringcharge-recurring)
5. [creditcard (Waitlist / Recurring CC)](#creditcard-waitlist--recurring-cc)

---

## rxpat (RX)

Stores prescriptions written for patients.

| Column | Type | Nullable | Description |
|---|---|---|---|
| RxNum | BigInt | PK | Primary key |
| PatNum | BigInt | Yes | FK → patient.PatNum |
| RxDate | Date | Yes | Date prescription was written |
| Drug | VarChar(255) | Yes | Drug name |
| Sig | VarChar(255) | Yes | Sig / dosage instructions |
| Disp | VarChar(255) | Yes | Dispense quantity/instructions |
| Refills | VarChar(30) | Yes | Number of refills |
| ProvNum | BigInt | Yes | FK → provider.ProvNum |
| Notes | VarChar(255) | Yes | Internal notes |
| PharmacyNum | BigInt | Yes | FK → pharmacy.PharmacyNum |
| IsControlled | Int | Yes | Flag: controlled substance |
| DateTStamp | DateTime | Yes | Last modified timestamp |
| SendStatus | Int | Yes | ERx send status |
| RxCui | BigInt | Yes | RxNorm concept identifier |
| DosageCode | VarChar(255) | Yes | Dosage code |
| ErxGuid | VarChar(40) | Yes | ERx unique identifier |
| IsErxOld | Int | Yes | Flag: legacy ERx |
| ErxPharmacyInfo | VarChar(255) | Yes | ERx pharmacy details |
| IsProcRequired | Int | Yes | Flag: procedure required before dispensing |
| ProcNum | BigInt | Yes | Associated procedure |
| DaysOfSupply | Float | Yes | Days of supply |
| PatientInstruction | Text | Yes | Patient-facing instructions |
| ClinicNum | BigInt | Yes | FK → clinic.ClinicNum |
| UserNum | BigInt | Yes | FK → userod.UserNum (entry user) |
| RxType | Int | Yes | Prescription type enum |

**Indexes:** Primary key on `RxNum`.

**Relationships:**
- `PatNum` → `patient`
- `ProvNum` → `provider`
- `PharmacyNum` → `pharmacy`
- `ClinicNum` → `clinic`
- `UserNum` → `userod`

---

## labcase (Lab Case)

Tracks dental lab cases linked to patient appointments.

| Column | Type | Nullable | Description |
|---|---|---|---|
| LabCaseNum | BigInt | PK | Primary key |
| PatNum | BigInt | Yes | FK → patient.PatNum |
| LaboratoryNum | BigInt | Yes | FK → laboratory.LaboratoryNum |
| AptNum | BigInt | Yes | FK → appointment.AptNum (actual appointment) |
| PlannedAptNum | BigInt | Yes | FK → appointment.AptNum (planned appointment) |
| DateTimeDue | DateTime | Yes | Due date from lab |
| DateTimeCreated | DateTime | Yes | Record creation timestamp |
| DateTimeSent | DateTime | Yes | Date/time sent to lab |
| DateTimeRecd | DateTime | Yes | Date/time received from lab |
| DateTimeChecked | DateTime | Yes | Date/time quality-checked |
| ProvNum | BigInt | Yes | FK → provider.ProvNum |
| Instructions | Text | Yes | Instructions to lab |
| LabFee | Float | Yes | Fee charged by lab |
| DateTStamp | DateTime | Yes | Last modified timestamp |
| InvoiceNum | VarChar(255) | Yes | Lab invoice number |

**Indexes:** Primary key on `LabCaseNum`.

**Relationships:**
- `PatNum` → `patient`
- `LaboratoryNum` → `laboratory`
- `AptNum` → `appointment` (actual)
- `PlannedAptNum` → `appointment` (planned)
- `ProvNum` → `provider`

---

## medication

Master list of medications used across allergy definitions, patient medications, and ERx alerts.

| Column | Type | Nullable | Description |
|---|---|---|---|
| MedicationNum | BigInt | PK | Primary key |
| MedName | VarChar(255) | Yes | Medication name |
| GenericNum | BigInt | Yes | FK → medication.MedicationNum (generic equivalent) |
| Notes | Text | Yes | Notes about the medication |
| DateTStamp | DateTime | Yes | Last modified timestamp |
| RxCui | BigInt | Yes | RxNorm concept identifier |
| IsHidden | Int | Yes | Flag: hidden from active lists |

**Indexes:** Primary key on `MedicationNum`.

**Relationships:**
- `GenericNum` → `medication` (self-referential: brand → generic)
- Referenced by: `allergydef`, `eduresource`, `medicationpat`, `rxalert`

---

## recurringcharge (Recurring)

Logs recurring credit card charge attempts and results for patients.

| Column | Type | Nullable | Description |
|---|---|---|---|
| RecurringChargeNum | BigInt | PK | Primary key |
| PatNum | BigInt | Yes | FK → patient.PatNum |
| ClinicNum | BigInt | Yes | FK → clinic.ClinicNum |
| DateTimeCharge | DateTime | Yes | Timestamp of charge attempt |
| ChargeStatus | Int | Yes | Status enum (success, failed, pending, etc.) |
| FamBal | Float | Yes | Family balance at time of charge |
| PayPlanDue | Float | Yes | Payment plan amount due |
| TotalDue | Float | Yes | Total amount due |
| RepeatAmt | Float | Yes | Configured repeat charge amount |
| ChargeAmt | Float | Yes | Actual amount charged |
| UserNum | BigInt | Yes | FK → userod.UserNum (user who ran charge) |
| PayNum | BigInt | Yes | FK → payment.PayNum (resulting payment) |
| CreditCardNum | BigInt | Yes | FK → creditcard.CreditCardNum |
| ErrorMsg | Text | Yes | Error message if charge failed |

**Indexes:** Primary key on `RecurringChargeNum`.

**Relationships:**
- `PatNum` → `patient`
- `ClinicNum` → `clinic`
- `UserNum` → `userod`
- `PayNum` → `payment`
- `CreditCardNum` → `creditcard`

---

## creditcard (Waitlist / Recurring CC)

Stores tokenized credit card records for patients, used for recurring charges and payment plans. The `IsRecurringActive` flag and `ChargeFrequency` field drive the recurring/waitlist charge workflows.

| Column | Type | Nullable | Description |
|---|---|---|---|
| CreditCardNum | BigInt | PK | Primary key |
| PatNum | BigInt | Yes | FK → patient.PatNum |
| Address | VarChar(255) | Yes | Billing address |
| Zip | VarChar(255) | Yes | Billing zip code |
| XChargeToken | VarChar(255) | Yes | XCharge payment token |
| CCNumberMasked | VarChar(255) | Yes | Masked card number (last 4) |
| CCExpiration | Date | Yes | Card expiration date |
| ItemOrder | Int | Yes | Display order for patient |
| ChargeAmt | Float | Yes | Default charge amount |
| DateStart | Date | Yes | Start date for recurring charges |
| DateStop | Date | Yes | Stop date for recurring charges |
| Note | VarChar(255) | Yes | Internal note |
| PayPlanNum | BigInt | Yes | FK → payplan.PayPlanNum |
| PayConnectToken | VarChar(255) | Yes | PayConnect token |
| PayConnectTokenExp | Date | Yes | PayConnect token expiration |
| Procedures | Text | Yes | Associated procedure codes |
| CCSource | Int | Yes | Source enum (web, terminal, manual) |
| ClinicNum | BigInt | Yes | FK → clinic.ClinicNum |
| ExcludeProcSync | Int | Yes | Flag: exclude from procedure sync |
| PaySimpleToken | VarChar(255) | Yes | PaySimple token |
| ChargeFrequency | VarChar(150) | Yes | Frequency definition string (e.g. monthly) |
| CanChargeWhenNoBal | Int | Yes | Flag: allow charge even with zero balance |
| PaymentType | BigInt | Yes | FK → definition.DefNum (payment type) |
| IsRecurringActive | Int | Yes | Flag: card is active for recurring charges |
| Nickname | VarChar(255) | Yes | User-facing card nickname |
| CardHolderName | VarChar(255) | Yes | Name on card |

**Indexes:** Primary key on `CreditCardNum`.

**Relationships:**
- `PatNum` → `patient`
- `PayPlanNum` → `payplan`
- `ClinicNum` → `clinic`
- `PaymentType` → `definition`
- Referenced by: `recurringcharge`

---

*Documentation generated from Prisma schema — SQL Server provider.*