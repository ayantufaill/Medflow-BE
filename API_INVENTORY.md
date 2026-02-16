# API Inventory (Frontend)

Generated from `/src/services` and `src/config/api.js`.

## Global API Client Behavior

- Base URL: `import.meta.env.VITE_API_BASE_URL` or fallback (`https://medflow-be.onrender.com/api` in production, `http://localhost:5001/api` in development).
- Auth: Adds `Authorization: Bearer <accessToken>` from `localStorage.accessToken` on each request.
- Auto refresh: On `401` (except public auth endpoints), it calls `/auth/refresh-token` and retries the original request.
- Public auth endpoints bypass refresh logic: `/auth/login`, `/auth/register/*`, `/auth/forgot-password/*`, `/auth/setup-password`.
- `429` responses are not retried.

## API Endpoints (217)

### allergy.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `createAllergy(...)` | `POST` | `/allergies` | Create a new allergy | `allergyData` | `response.data.data.allergy` | `-` | `/Users/macuser/code/Medflow-FE/src/services/allergy.service.js:20` |
| `getAllergies(...)` | `GET` | `/allergies?patient_id=${patientId}` | Get all allergies for a patient | `-` | `response.data.data.allergies \|\| []` | `-` | `/Users/macuser/code/Medflow-FE/src/services/allergy.service.js:30` |
| `getAllergyById(...)` | `GET` | `/allergies/${allergyId}` | Get allergy by ID | `-` | `response.data.data.allergy` | `-` | `/Users/macuser/code/Medflow-FE/src/services/allergy.service.js:40` |
| `updateAllergy(...)` | `PUT` | `/allergies/${allergyId}` | Update allergy | `updates` | `response.data.data.allergy` | `-` | `/Users/macuser/code/Medflow-FE/src/services/allergy.service.js:51` |
| `deleteAllergy(...)` | `DELETE` | `/allergies/${allergyId}` | Delete allergy (soft delete) | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/allergy.service.js:61` |

### appointment-type.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllAppointmentTypes(...)` | `GET` | `/appointment-types?${params.toString()}` | Get all appointment types with pagination and search | `-` | `response.data.data` | `page, limit, search, isActive` | `/Users/macuser/code/Medflow-FE/src/services/appointment-type.service.js:17` |
| `getAppointmentTypeById(...)` | `GET` | `/appointment-types/${appointmentTypeId}` | Get appointment type by ID | `-` | `response.data.data.appointmentType` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment-type.service.js:42` |
| `createAppointmentType(...)` | `POST` | `/appointment-types` | Create appointment type | `appointmentTypeData` | `response.data.data.appointmentType` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment-type.service.js:54` |
| `updateAppointmentType(...)` | `PUT` | `/appointment-types/${appointmentTypeId}` | Update appointment type | `updates` | `response.data.data.appointmentType` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment-type.service.js:68` |
| `deleteAppointmentType(...)` | `DELETE` | `/appointment-types/${appointmentTypeId}` | Delete appointment type | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment-type.service.js:81` |

### appointment.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllAppointments(...)` | `GET` | `/appointments?${params.toString()}` | Get all appointments with pagination and filters | `-` | `response.data.data` | `page, limit, providerId, patientId, status, startDate, endDate, appointmentTypeId, search` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:21` |
| `getAppointmentById(...)` | `GET` | `/appointments/${appointmentId}` | Get appointment by ID | `-` | `response.data.data.appointment` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:53` |
| `getProviderSchedule(...)` | `GET` | `/appointments/providers/${providerId}/schedule?${params.toString()}` | Get provider schedule | `-` | `response.data.data` | `view, date` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:65` |
| `getCalendarSchedule(...)` | `GET` | `/appointments/calendar?${params.toString()}` | Get calendar schedule for multiple providers | `-` | `response.data.data` | `startDate, endDate, providerIds` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:83` |
| `getAvailableSlots(...)` | `GET` | `/appointments/providers/${providerId}/available-slots?${params.toString()}` | Get available time slots for a provider | `-` | `response.data.data` | `date, durationMinutes` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:104` |
| `createAppointment(...)` | `POST` | `/appointments` | Create appointment | `appointmentData` | `response.data.data.appointment` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:122` |
| `updateAppointment(...)` | `PUT` | `/appointments/${appointmentId}` | Update appointment | `updates` | `response.data.data.appointment` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:133` |
| `cancelAppointment(...)` | `POST` | `/appointments/${appointmentId}/cancel` | Cancel appointment | `{ cancellationReason, }` | `response.data.data.appointment` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:147` |
| `rescheduleAppointment(...)` | `POST` | `/appointments/${appointmentId}/reschedule` | Reschedule appointment | `rescheduleData` | `response.data.data.appointment` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:163` |
| `checkInAppointment(...)` | `POST` | `/appointments/${appointmentId}/check-in` | Check-in appointment | `-` | `response.data.data.appointment` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:176` |
| `deleteAppointment(...)` | `DELETE` | `/appointments/${appointmentId}` | Delete appointment | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:188` |
| `getAppointmentsByPatient(...)` | `GET` | `/appointments?${params.toString()}` | Get Appointments By Patient | `-` | `response.data.data.appointments` | `page, limit, patientId` | `/Users/macuser/code/Medflow-FE/src/services/appointment.service.js:193` |

### auth.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `initiateRegistration(...)` | `POST` | `/auth/register/initiate` | Initiate registration - sends verification code to email | `userData` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:21` |
| `verifyEmailAndRegister(...)` | `POST` | `/auth/register/verify` | Verify email token and complete registration | `{ token, password }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:32` |
| `resendVerificationCode(...)` | `POST` | `/auth/register/resend-link` | Resend verification link | `{ email }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:42` |
| `login(...)` | `POST` | `/auth/login` | Login user | `credentials` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:54` |
| `refreshToken(...)` | `POST` | `/auth/refresh-token` | Refresh access token | `{ refreshToken }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:64` |
| `getProfile(...)` | `GET` | `/auth/profile` | Get current user profile | `-` | `response.data.data.user` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:73` |
| `changePassword(...)` | `POST` | `/users/profile/change-password` | Change user password | `passwordData` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:85` |
| `requestPasswordReset(...)` | `POST` | `/auth/forgot-password` | Request password reset - sends reset code to email | `{ email }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:95` |
| `verifyPasswordResetCode(...)` | `POST` | `/auth/forgot-password/verify` | Verify password reset code | `{ email, code }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:106` |
| `resetPassword(...)` | `POST` | `/auth/forgot-password/reset` | Reset password with new password | `{ email, code, newPassword, }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:118` |
| `resendPasswordResetCode(...)` | `POST` | `/auth/forgot-password/resend-code` | Resend password reset code | `{ email }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:132` |
| `setupPassword(...)` | `POST` | `/auth/setup-password` | Verify token and set password (for admin-created users) | `{ token, password }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:143` |
| `logout(...)` | `POST` | `/auth/logout` | Logout user (clears local storage and calls logout endpoint) | `{ refreshToken }` | `-` | `-` | `/Users/macuser/code/Medflow-FE/src/services/auth.service.js:151` |

### authorization.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllAuthorizations(...)` | `GET` | `/authorizations?${params.toString()}` | Get all authorizations | `-` | `data` | `page, limit, search, status, patientId, insuranceCompanyId, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/authorization.service.js:14` |
| `getAuthorizationById(...)` | `GET` | `/authorizations/${authorizationId}` | Get authorization by ID | `-` | `{ ...auth, id: auth._id \|\| auth.id, patient: auth.patientId \|\| auth.patient, insuranceCompany: auth.insuranceCompanyId \|\| auth.insuranceC...` | `-` | `/Users/macuser/code/Medflow-FE/src/services/authorization.service.js:58` |
| `requestAuthorization(...)` | `POST` | `/authorizations` | Request new authorization | `authorizationData` | `response.data.data.authorization` | `-` | `/Users/macuser/code/Medflow-FE/src/services/authorization.service.js:75` |
| `updateAuthorization(...)` | `PATCH` | `/authorizations/${authorizationId}` | Update authorization | `updates` | `response.data.data.authorization` | `-` | `/Users/macuser/code/Medflow-FE/src/services/authorization.service.js:86` |
| `getAuthorizationStatusHistory(...)` | `GET` | `/authorizations/${authorizationId}/status-history` | Get authorization status history | `-` | `response.data.data.statusHistory \|\| []` | `-` | `/Users/macuser/code/Medflow-FE/src/services/authorization.service.js:96` |
| `printAuthorizationForm(...)` | `GET` | `/authorizations/${authorizationId}/print` | Generate authorization form PDF | `{ responseType: 'blob', }` | `response.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/authorization.service.js:106` |

### claim.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllClaims(...)` | `GET` | `/claims?${params.toString()}` | Get all claims with pagination and filters | `-` | `data` | `page, limit, search, status, patientId, invoiceId, insuranceCompanyId, insuranceType, startDate, endDate, deniedOnly` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:14` |
| `getClaimById(...)` | `GET` | `/claims/${claimId}` | Get claim by ID | `-` | `{ ...claim, id: claim._id \|\| claim.id, patient: patientObj \|\| claim.patient, invoice: claim.invoiceId \|\| claim.invoice, insuranceCompany:...` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:70` |
| `createClaimFromInvoice(...)` | `POST` | `/claims/from-invoice/${invoiceId}` | Create claim from invoice | `claimData` | `response.data.data.claim` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:102` |
| `updateClaim(...)` | `PATCH` | `/claims/${claimId}` | Update claim | `updates` | `response.data.data.claim` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:113` |
| `validateClaim(...)` | `POST` | `/claims/${claimId}/validate` | Validate claim for errors before submission | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:123` |
| `submitClaim(...)` | `POST` | `/claims/${claimId}/submit` | Submit claim electronically | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:133` |
| `getClaimStatusHistory(...)` | `GET` | `/claims/${claimId}/status-history` | Get claim status history | `-` | `response.data.data.statusHistory \|\| []` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:143` |
| `resubmitClaim(...)` | `POST` | `/claims/${claimId}/resubmit` | Resubmit denied claim | `corrections` | `response.data.data.claim` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:154` |
| `attachDocument(...)` | `POST` | `/claims/${claimId}/documents` | Attach document to claim | `formData` | `response.data.data.document` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:165` |
| `getClaimDocuments(...)` | `GET` | `/claims/${claimId}/documents` | Get documents attached to claim | `-` | `response.data.data.documents \|\| []` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:179` |
| `removeClaimDocument(...)` | `DELETE` | `/claims/${claimId}/documents/${documentId}` | Remove document from claim | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:190` |

### clinical-note.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllClinicalNotes(...)` | `GET` | `/clinical-notes?${params.toString()}` | Get All Clinical Notes | `-` | `response.data.data` | `page, limit, search, patientId, providerId, appointmentId, noteType, isSigned, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:4` |
| `getClinicalNoteById(...)` | `GET` | `/clinical-notes/${clinicalNoteId}` | Get Clinical Note By Id | `-` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:28` |
| `getClinicalNotesByPatient(...)` | `GET` | `/clinical-notes/patient/${patientId}?${params.toString()}` | Get Clinical Notes By Patient | `-` | `response.data.data` | `page, limit` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:33` |
| `getClinicalNoteByAppointment(...)` | `GET` | `/clinical-notes/appointment/${appointmentId}` | Get Clinical Note By Appointment | `-` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:44` |
| `getUnsignedNotes(...)` | `GET` | `/clinical-notes/unsigned/${providerId}` | Get Unsigned Notes | `-` | `response.data.data.unsignedNotes` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:51` |
| `createClinicalNote(...)` | `POST` | `/clinical-notes` | Create Clinical Note | `noteData` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:58` |
| `createNoteFromTemplate(...)` | `POST` | `/clinical-notes/from-template/${templateId}` | Create Note From Template | `noteData` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:63` |
| `updateClinicalNote(...)` | `PUT` | `/clinical-notes/${clinicalNoteId}` | Update Clinical Note | `updates` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:71` |
| `saveDraft(...)` | `PUT` | `/clinical-notes/${clinicalNoteId}/draft` | Save Draft | `draftData` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:79` |
| `signClinicalNote(...)` | `POST` | `/clinical-notes/${clinicalNoteId}/sign` | Sign Clinical Note | `-` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:87` |
| `addAttachment(...)` | `POST` | `/clinical-notes/${clinicalNoteId}/attachments` | Add Attachment | `{ attachmentUrl }` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:94` |
| `removeAttachment(...)` | `DELETE` | `/clinical-notes/${clinicalNoteId}/attachments` | Remove Attachment | `{ data: { attachmentUrl } }` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:102` |
| `deleteClinicalNote(...)` | `DELETE` | `/clinical-notes/${clinicalNoteId}` | Delete Clinical Note | `-` | `response.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:110` |
| `getPatientMedicalHistory(...)` | `GET` | `url (`/clinical-notes/patient/${patientId}/medical-history${queryString ? `?${queryString}` : ''}`)` | Get Patient Medical History | `-` | `response.data.data` | `includeAllergies, includeVitals, includePrescriptions, includeLabOrders, includeLabResults, includeDocuments, includeNotes, startDate, endDate, limit` | `/Users/macuser/code/Medflow-FE/src/services/clinical-note.service.js:117` |

### document.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllDocuments(...)` | `GET` | `/documents?${params.toString()}` | Get All Documents | `-` | `response.data.data` | `page, limit, patientId, appointmentId, documentType, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:4` |
| `getDocumentById(...)` | `GET` | `/documents/${documentId}` | Get Document By Id | `-` | `response.data.data.document` | `-` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:19` |
| `getDocumentsByPatient(...)` | `GET` | `/documents/patient/${patientId}?${params.toString()}` | Get Documents By Patient | `-` | `response.data.data` | `page, limit, documentType` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:24` |
| `getDocumentsByAppointment(...)` | `GET` | `/documents/appointment/${appointmentId}` | Get Documents By Appointment | `-` | `response.data.data.documents` | `-` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:36` |
| `createDocument(...)` | `POST` | `/documents` | Create Document | `documentData` | `response.data.data.document` | `-` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:41` |
| `uploadDocument(...)` | `POST` | `/documents/upload` | Upload Document | `formData` | `response.data.data.document` | `-` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:46` |
| `updateDocument(...)` | `PUT` | `/documents/${documentId}` | Update Document | `updates` | `response.data.data.document` | `-` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:55` |
| `deleteDocument(...)` | `DELETE` | `/documents/${documentId}` | Delete Document | `-` | `response.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:60` |
| `attachToNote(...)` | `POST` | `/documents/${documentId}/attach-to-note` | Attach To Note | `{ clinicalNoteId, }` | `response.data.data.clinicalNote` | `-` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:65` |
| `getDocumentTypes(...)` | `GET` | `/documents/types` | Get Document Types | `-` | `response.data.data.types` | `-` | `/Users/macuser/code/Medflow-FE/src/services/document.service.js:72` |

### era.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `importERAFile(...)` | `POST` | `/era/import` | Import ERA/EOB file | `formData` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/era.service.js:14` |
| `getAllERAs(...)` | `GET` | `/era?${params.toString()}` | Get all ERA records | `-` | `response.data.data` | `page, limit, search, status, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/era.service.js:28` |
| `getERAById(...)` | `GET` | `/era/${eraId}` | Get ERA by ID | `-` | `response.data.data.era` | `-` | `/Users/macuser/code/Medflow-FE/src/services/era.service.js:55` |
| `getERAItems(...)` | `GET` | `/era/${eraId}/items` | Get ERA items (payment lines) for an ERA | `-` | `response.data.data.items \|\| []` | `-` | `/Users/macuser/code/Medflow-FE/src/services/era.service.js:65` |
| `autoPostPayments(...)` | `POST` | `/era/${eraId}/auto-post` | Auto-post payments from ERA | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/era.service.js:75` |
| `getUnmatchedItems(...)` | `GET` | `/era/unmatched?${params.toString()}` | Get unmatched ERA items | `-` | `response.data.data` | `page, limit, search, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/era.service.js:85` |
| `matchERAItem(...)` | `POST` | `/era/items/${eraItemId}/match` | Manually match ERA item to claim/invoice | `{ claimId, invoiceId, }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/era.service.js:112` |

### estimate.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllEstimates(...)` | `GET` | `/estimates?${params.toString()}` | Get all estimates with pagination and filters | `-` | `data` | `page, limit, search, status, patientId` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:12` |
| `getEstimateById(...)` | `GET` | `/estimates/${estimateId}` | Get estimate by ID | `-` | `{ ...estimate, id: estimate._id \|\| estimate.id, }` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:35` |
| `getEstimatesByPatient(...)` | `GET` | `/estimates/patient/${patientId}` | Get estimates by patient | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:47` |
| `createEstimate(...)` | `POST` | `/estimates` | Create estimate | `estimateData` | `{ ...estimate, id: estimate._id \|\| estimate.id, }` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:55` |
| `deleteEstimate(...)` | `DELETE` | `/estimates/${estimateId}` | Delete estimate | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:67` |
| `updateEstimate(...)` | `PATCH` | `/estimates/${estimateId}` | Update estimate | `updates` | `response.data.data.estimate` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:75` |
| `sendToPatient(...)` | `POST` | `/estimates/${estimateId}/send` | Send estimate to patient by email (draft only). Sets status to 'sent'. | `-` | `response.data.data?.estimate ?? response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:84` |
| `convertToInvoice(...)` | `POST` | `/estimates/${estimateId}/convert` | Convert estimate to invoice | `data` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:94` |
| `acceptEstimate(...)` | `PATCH` | `/estimates/${estimateId}/accept` | Mark estimate as accepted | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:102` |
| `declineEstimate(...)` | `PATCH` | `/estimates/${estimateId}/decline` | Mark estimate as declined | `{ reason }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:110` |
| `expireEstimate(...)` | `PATCH` | `/estimates/${estimateId}/expire` | Expire estimate | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/estimate.service.js:118` |

### insurance.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllInsuranceCompanies(...)` | `GET` | `/insurance-companies?${params.toString()}` | Get all insurance companies with pagination, search, and status filter | `-` | `response.data.data` | `page, limit, search, isActive` | `/Users/macuser/code/Medflow-FE/src/services/insurance.service.js:17` |
| `getInsuranceCompanyById(...)` | `GET` | `/insurance-companies/${insuranceCompanyId}` | Get insurance company by ID | `-` | `response.data.data.company` | `-` | `/Users/macuser/code/Medflow-FE/src/services/insurance.service.js:39` |
| `createInsuranceCompany(...)` | `POST` | `/insurance-companies` | Create insurance company | `payload` | `response.data.data.company` | `-` | `/Users/macuser/code/Medflow-FE/src/services/insurance.service.js:49` |
| `updateInsuranceCompany(...)` | `PUT` | `/insurance-companies/${insuranceCompanyId}` | Update insurance company | `updates` | `response.data.data.company` | `-` | `/Users/macuser/code/Medflow-FE/src/services/insurance.service.js:60` |
| `deleteInsuranceCompany(...)` | `DELETE` | `/insurance-companies/${insuranceCompanyId}` | Delete insurance company | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/insurance.service.js:73` |

### invoice.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllInvoices(...)` | `GET` | `/invoices?${params.toString()}` | Get all invoices with pagination and filters | `-` | `data` | `page, limit, search, status, patientId, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:12` |
| `getInvoiceById(...)` | `GET` | `/invoices/${invoiceId}` | Get invoice by ID (includes line items) | `-` | `{ ...invoice, id: invoice._id \|\| invoice.id, lineItems: items?.map(item => ({ ...item, id: item._id \|\| item.id, total: item.totalPrice, }...` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:39` |
| `getInvoicesByPatient(...)` | `GET` | `/invoices/patient/${patientId}` | Get invoices by patient | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:57` |
| `createInvoiceFromAppointment(...)` | `POST` | `/invoices/from-appointment/${appointmentId}` | Create invoice from appointment | `invoiceData` | `{ ...invoice, id: invoice._id \|\| invoice.id, }` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:66` |
| `updateInvoice(...)` | `PATCH` | `/invoices/${invoiceId}` | Update invoice | `updates` | `response.data.data.invoice` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:79` |
| `deleteInvoice(...)` | `DELETE` | `/invoices/${invoiceId}` | Delete invoice (only draft invoices can be deleted) | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:87` |
| `addInvoiceItem(...)` | `POST` | `/invoices/${invoiceId}/items` | Add item to invoice | `itemData` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:95` |
| `updateInvoiceItem(...)` | `PATCH` | `/invoices/${invoiceId}/items/${itemId}` | Update invoice item | `updates` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:103` |
| `deleteInvoiceItem(...)` | `DELETE` | `/invoices/${invoiceId}/items/${itemId}` | Delete invoice item | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:111` |
| `recalculateInvoice(...)` | `POST` | `/invoices/${invoiceId}/recalculate` | Recalculate invoice totals | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:119` |
| `generateFromAppointment(...)` | `POST` | `/invoices/from-appointment/${appointmentId}` | Generate invoice from appointment | `-` | `response.data.data.invoice` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:127` |
| `finalizeInvoice(...)` | `PATCH` | `/invoices/${invoiceId}/finalize` | Finalize invoice (change from draft to pending) | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:135` |
| `voidInvoice(...)` | `PATCH` | `/invoices/${invoiceId}/void` | Void invoice | `{ reason }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:143` |
| `getPatientBalance(...)` | `GET` | `/invoices/patient/${patientId}/balance` | Get patient account balance | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/invoice.service.js:151` |

### language.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllLanguages(...)` | `GET` | `/languages?${params.toString()}` | Get All Languages | `-` | `response.data.data \|\| []` | `isActive` | `/Users/macuser/code/Medflow-FE/src/services/language.service.js:4` |

### note-template.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllNoteTemplates(...)` | `GET` | `/note-templates?${params.join('&')}` | Get All Note Templates | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:4` |
| `getNoteTemplateById(...)` | `GET` | `/note-templates/${noteTemplateId}` | Get Note Template By Id | `-` | `response.data.data.noteTemplate` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:26` |
| `createNoteTemplate(...)` | `POST` | `/note-templates` | Create Note Template | `noteTemplateData` | `response.data.data.noteTemplate` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:33` |
| `updateNoteTemplate(...)` | `PUT` | `/note-templates/${noteTemplateId}` | Update Note Template | `updates` | `response.data.data.noteTemplate` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:41` |
| `deleteNoteTemplate(...)` | `DELETE` | `/note-templates/${noteTemplateId}` | Delete Note Template | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:49` |
| `duplicateNoteTemplate(...)` | `POST` | `/note-templates/${noteTemplateId}/duplicate` | Duplicate Note Template | `{ newName }` | `response.data.data.noteTemplate` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:56` |
| `getTemplatesBySpecialty(...)` | `GET` | `/note-templates/specialty/${specialty}` | Get Templates By Specialty | `-` | `response.data.data.noteTemplates` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:64` |
| `getActiveTemplates(...)` | `GET` | `/note-templates/active` | Get Active Templates | `-` | `response.data.data.noteTemplates` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:71` |
| `getSpecialties(...)` | `GET` | `/providers/specialties` | Get Specialties | `-` | `response.data.data.specialties` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:76` |
| `toggleNoteTemplateStatus(...)` | `PATCH` | `/note-templates/${noteTemplateId}/status` | Toggle Note Template Status | `-` | `response.data.data.noteTemplate` | `-` | `/Users/macuser/code/Medflow-FE/src/services/note-template.service.js:81` |

### ocr.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `extractTextFromImage(...)` | `POST` | `${API_BASE_URL}/ocr/extract-text` | Extract text from an image using Google Cloud Vision OCR (via backend) | `formData` | `response.data.data.text \|\| ''` | `-` | `/Users/macuser/code/Medflow-FE/src/services/ocr.service.js:11` |

### patient.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllPatients(...)` | `GET` | `/patients?${params.toString()}` | Get all patients with pagination and search | `-` | `response.data.data` | `page, limit, search, status, dobStart, dobEnd` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:19` |
| `getPatientById(...)` | `GET` | `url (query ? `/patients/${patientId}?${query}` : `/patients/${patientId}`)` | Get patient by ID | `-` | `response.data.data.patient` | `includeSSN` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:38` |
| `checkDuplicates(...)` | `POST` | `/patients/check-duplicates` | Check for duplicate patients | `data` | `response.data.data.duplicates \|\| []` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:54` |
| `createPatient(...)` | `POST` | `/patients` | Create patient | `patientData` | `response.data.data.patient` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:64` |
| `updatePatient(...)` | `PUT` | `/patients/${patientId}` | Update patient | `updates` | `response.data.data.patient` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:75` |
| `deletePatient(...)` | `DELETE` | `/patients/${patientId}` | Delete (deactivate) patient | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:85` |
| `getPatientInsurances(...)` | `GET` | `url (query ? `/patients/${patientId}/insurance?${query}` : `/patients/${patientId}/insurance`)` | Get all insurances for a patient | `-` | `response.data.data.insurances \|\| []` | `isActive` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:98` |
| `getPatientInsuranceById(...)` | `GET` | `/patients/${patientId}/insurance/${patientInsuranceId}` | Get patient insurance by ID | `-` | `response.data.data.insurance` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:118` |
| `createPatientInsurance(...)` | `POST` | `/patients/${patientId}/insurance` | Create patient insurance | `payload` | `response.data.data.insurance` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:131` |
| `updatePatientInsurance(...)` | `PUT` | `/patients/${patientId}/insurance/${patientInsuranceId}` | Update patient insurance | `updates` | `response.data.data.insurance` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:143` |
| `deletePatientInsurance(...)` | `DELETE` | `/patients/${patientId}/insurance/${patientInsuranceId}` | Delete patient insurance | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:157` |
| `getPatientAllergies(...)` | `GET` | `url (query ? `/patients/${patientId}/allergies?${query}` : `/patients/${patientId}/allergies`)` | Get all allergies for a patient | `-` | `response.data.data.allergies \|\| []` | `isActive` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:172` |
| `getAllergyById(...)` | `GET` | `/patients/${patientId}/allergies/${allergyId}` | Get allergy by ID | `-` | `response.data.data.allergy` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:192` |
| `createPatientAllergy(...)` | `POST` | `/patients/${patientId}/allergies` | Create patient allergy | `payload` | `response.data.data.allergy` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:203` |
| `updatePatientAllergy(...)` | `PUT` | `/patients/${patientId}/allergies/${allergyId}` | Update patient allergy | `updates` | `response.data.data.allergy` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:215` |
| `deletePatientAllergy(...)` | `DELETE` | `/patients/${patientId}/allergies/${allergyId}` | Delete patient allergy | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/patient.service.js:229` |

### payment.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllPayments(...)` | `GET` | `/payments?${params.toString()}` | Get all payments with pagination and filters | `-` | `data` | `page, limit, search, patientId, paymentMethod, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/payment.service.js:12` |
| `getPaymentById(...)` | `GET` | `/payments/${paymentId}` | Get payment by ID | `-` | `{ ...payment, id: payment._id \|\| payment.id, receiptNumber: payment.paymentCode \|\| payment.receiptNumber, patient: payment.patientId \|\| p...` | `-` | `/Users/macuser/code/Medflow-FE/src/services/payment.service.js:40` |
| `getPaymentsByPatient(...)` | `GET` | `/payments/patient/${patientId}` | Get payments by patient | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/payment.service.js:55` |
| `getPaymentsByInvoice(...)` | `GET` | `/payments/invoice/${invoiceId}` | Get payments by invoice | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/payment.service.js:63` |
| `recordPayment(...)` | `POST` | `/payments` | Record payment | `paymentData` | `{ ...payment, id: payment._id \|\| payment.id, receiptNumber: payment.paymentCode \|\| payment.receiptNumber, patient: payment.patientId \|\| p...` | `-` | `/Users/macuser/code/Medflow-FE/src/services/payment.service.js:71` |
| `applyPayment(...)` | `POST` | `/payments/${paymentId}/apply` | Apply payment to invoice | `{ invoiceId, amount }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/payment.service.js:93` |
| `voidPayment(...)` | `PATCH` | `/payments/${paymentId}/void` | Void payment | `{ reason }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/payment.service.js:101` |

### practice-info.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllPracticeInfo(...)` | `GET` | `/practice-info?${params.toString()}` | Get all practice info records (Admin only) | `-` | `response.data.data` | `page, limit, search` | `/Users/macuser/code/Medflow-FE/src/services/practice-info.service.js:16` |
| `getCurrentPracticeInfo(...)` | `GET` | `/practice-info/current` | Get current practice info (most recent) | `-` | `response.data.data.practiceInfo` | `-` | `/Users/macuser/code/Medflow-FE/src/services/practice-info.service.js:30` |
| `getPracticeInfoById(...)` | `GET` | `/practice-info/${practiceInfoId}` | Get practice info by ID | `-` | `response.data.data.practiceInfo` | `-` | `/Users/macuser/code/Medflow-FE/src/services/practice-info.service.js:40` |
| `createPracticeInfo(...)` | `POST` | `/practice-info` | Create practice info | `formData` | `response.data.data.practiceInfo` | `-` | `/Users/macuser/code/Medflow-FE/src/services/practice-info.service.js:50` |
| `updatePracticeInfo(...)` | `PUT` | `/practice-info/${practiceInfoId}` | Update practice info | `formData` | `response.data.data.practiceInfo` | `-` | `/Users/macuser/code/Medflow-FE/src/services/practice-info.service.js:80` |
| `deletePracticeInfo(...)` | `DELETE` | `/practice-info/${practiceInfoId}` | Delete practice info | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/practice-info.service.js:109` |

### provider.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllProviders(...)` | `GET` | `/providers?${params.toString()}` | Get all providers with pagination and search | `-` | `response.data.data` | `page, limit, search, specialty, isActive` | `/Users/macuser/code/Medflow-FE/src/services/provider.service.js:17` |
| `getProviderById(...)` | `GET` | `/providers/${providerId}` | Get provider by ID | `-` | `response.data.data.provider` | `-` | `/Users/macuser/code/Medflow-FE/src/services/provider.service.js:42` |
| `createProvider(...)` | `POST` | `/providers` | Create provider | `providerData` | `response.data.data.provider` | `-` | `/Users/macuser/code/Medflow-FE/src/services/provider.service.js:52` |
| `updateProvider(...)` | `PUT` | `/providers/${providerId}` | Update provider | `updates` | `response.data.data.provider` | `-` | `/Users/macuser/code/Medflow-FE/src/services/provider.service.js:63` |
| `activateProvider(...)` | `PATCH` | `/providers/${providerId}/activate` | Activate provider | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/provider.service.js:73` |
| `deactivateProvider(...)` | `PATCH` | `/providers/${providerId}/deactivate` | Deactivate provider | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/provider.service.js:83` |
| `deleteProvider(...)` | `DELETE` | `/providers/${providerId}` | Delete provider permanently | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/provider.service.js:93` |
| `getSpecialties(...)` | `GET` | `/providers/specialties` | Get Specialties | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/provider.service.js:98` |

### recurring-appointment.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllRecurringAppointments(...)` | `GET` | `/recurring-appointments?${params.toString()}` | Get all recurring appointments with pagination and filters | `-` | `response.data.data` | `page, limit, providerId, patientId, isActive, search, startDateFrom, startDateTo` | `/Users/macuser/code/Medflow-FE/src/services/recurring-appointment.service.js:18` |
| `getRecurringAppointmentById(...)` | `GET` | `/recurring-appointments/${recurringAppointmentId}` | Get recurring appointment by ID | `-` | `response.data.data.recurringAppointment` | `-` | `/Users/macuser/code/Medflow-FE/src/services/recurring-appointment.service.js:51` |
| `previewRecurringAppointments(...)` | `POST` | `/recurring-appointments/preview` | Preview recurring appointment dates/times without creating them | `recurringAppointmentData` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/recurring-appointment.service.js:63` |
| `createRecurringAppointment(...)` | `POST` | `/recurring-appointments` | Create recurring appointment | `recurringAppointmentData` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/recurring-appointment.service.js:76` |
| `createRecurringAppointmentWithResolution(...)` | `POST` | `/recurring-appointments/with-resolution` | Create recurring appointment with conflict resolution | `recurringAppointmentData` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/recurring-appointment.service.js:90` |
| `generateAppointments(...)` | `POST` | `/recurring-appointments/${recurringAppointmentId}/generate` | Generate appointments from recurring series | `{ count }` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/recurring-appointment.service.js:104` |
| `updateRecurringAppointment(...)` | `PUT` | `/recurring-appointments/${recurringAppointmentId}` | Update recurring appointment | `updates` | `response.data.data.recurringAppointment` | `-` | `/Users/macuser/code/Medflow-FE/src/services/recurring-appointment.service.js:118` |
| `deleteRecurringAppointment(...)` | `DELETE` | `/recurring-appointments/${recurringAppointmentId}` | Delete recurring appointment and all associated appointments | `-` | `response.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/recurring-appointment.service.js:131` |
| `getLinkedAppointments(...)` | `GET` | `/recurring-appointments/${recurringAppointmentId}/appointments` | Get all actual appointments linked to a recurring appointment | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/recurring-appointment.service.js:143` |

### role.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllRoles(...)` | `GET` | `/roles` | Get all roles | `-` | `response.data.data.roles \|\| response.data.data \|\| [] \| []` | `-` | `/Users/macuser/code/Medflow-FE/src/services/role.service.js:13` |
| `getRoleById(...)` | `GET` | `/roles/${roleId}` | Get role by ID | `-` | `response.data.data.role \|\| response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/role.service.js:33` |

### room.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllRooms(...)` | `GET` | `/rooms?${params.toString()}` | Get all rooms with pagination and search | `-` | `response.data.data` | `page, limit, search, isActive` | `/Users/macuser/code/Medflow-FE/src/services/room.service.js:17` |
| `getRoomById(...)` | `GET` | `/rooms/${roomId}` | Get room by ID | `-` | `response.data.data.room` | `-` | `/Users/macuser/code/Medflow-FE/src/services/room.service.js:42` |
| `createRoom(...)` | `POST` | `/rooms` | Create room | `roomData` | `response.data.data.room` | `-` | `/Users/macuser/code/Medflow-FE/src/services/room.service.js:54` |
| `updateRoom(...)` | `PUT` | `/rooms/${roomId}` | Update room | `updates` | `response.data.data.room` | `-` | `/Users/macuser/code/Medflow-FE/src/services/room.service.js:68` |
| `deleteRoom(...)` | `DELETE` | `/rooms/${roomId}` | Delete room | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/room.service.js:81` |

### service-catalog.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllServices(...)` | `GET` | `/services?${params.toString()}` | Get all services with pagination and search | `-` | `data` | `page, limit, search, category, isActive` | `/Users/macuser/code/Medflow-FE/src/services/service-catalog.service.js:12` |
| `getServiceById(...)` | `GET` | `/services/${serviceId}` | Get service by ID | `-` | `{ ...service, id: service._id \|\| service.id, price: service.defaultPrice, duration: service.durationMinutes, }` | `-` | `/Users/macuser/code/Medflow-FE/src/services/service-catalog.service.js:44` |
| `createService(...)` | `POST` | `/services` | Create service | `serviceData` | `{ ...service, id: service._id \|\| service.id, }` | `-` | `/Users/macuser/code/Medflow-FE/src/services/service-catalog.service.js:59` |
| `updateService(...)` | `PUT` | `/services/${serviceId}` | Update service | `updates` | `{ ...service, id: service._id \|\| service.id, }` | `-` | `/Users/macuser/code/Medflow-FE/src/services/service-catalog.service.js:71` |
| `deleteService(...)` | `DELETE` | `/services/${serviceId}` | Delete service | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/service-catalog.service.js:83` |
| `activateService(...)` | `PATCH` | `/services/${serviceId}/activate` | Activate service | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/service-catalog.service.js:91` |
| `deactivateService(...)` | `PATCH` | `/services/${serviceId}/deactivate` | Deactivate service | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/service-catalog.service.js:99` |
| `getCategories(...)` | `GET` | `/services/categories` | Get service categories | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/service-catalog.service.js:107` |

### user.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllUsers(...)` | `GET` | `/users?${params.toString()}` | Get all users (Admin only) | `-` | `response.data.data` | `page, limit, search, roleId, status` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:18` |
| `getUsersByRoleName(...)` | `GET` | `/users/by-role/${encodeURIComponent(roleName)}?${params.toString()}` | Get users by role name (Admin only) | `-` | `response.data.data` | `page, limit, status, excludeWithProvider` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:45` |
| `getUserById(...)` | `GET` | `/users/${userId}` | Get user by ID | `-` | `response.data.data.user` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:63` |
| `updateUser(...)` | `PUT` | `/users/${userId}` | Update user | `updates` | `response.data.data.user` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:74` |
| `updateProfile(...)` | `PUT` | `/users/profile/me` | Update own profile | `updates` | `response.data.data.user` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:84` |
| `assignRole(...)` | `POST` | `/users/${userId}/roles` | Assign role to user (Admin only) | `{ roleId }` | `response.data.data.user` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:95` |
| `removeRole(...)` | `DELETE` | `/users/${userId}/roles/${roleId}` | Remove role from user (Admin only) | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:106` |
| `deleteUser(...)` | `DELETE` | `/users/${userId}` | Delete user (Admin only) | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:116` |
| `getUserRoles(...)` | `GET` | `/users/${userId}/roles` | Get user roles | `-` | `response.data.data.roles \|\| []` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:126` |
| `createUser(...)` | `POST` | `/users` | Create user (Admin only) - creates inactive user and sends verification link | `userData` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:142` |
| `activateUser(...)` | `PATCH` | `/users/${userId}/activate` | Activate user (Admin only) | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:152` |
| `deactivateUser(...)` | `PATCH` | `/users/${userId}/deactivate` | Deactivate user (Admin only) | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:162` |
| `getUserActivity(...)` | `GET` | `/users/${userId}/activity?${params.toString()}` | Get user activity logs (Admin only) | `-` | `response.data.data` | `page, limit, search, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:174` |
| `getUserLoginHistory(...)` | `GET` | `/users/${userId}/login-history?${params.toString()}` | Get user login history (Admin only) | `-` | `response.data.data` | `page, limit, search, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/user.service.js:198` |

### vital-sign.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllVitalSigns(...)` | `GET` | `/vital-signs?${params.toString()}` | Get All Vital Signs | `-` | `response.data.data` | `page, limit, patientId, appointmentId, startDate, endDate` | `/Users/macuser/code/Medflow-FE/src/services/vital-sign.service.js:4` |
| `getVitalSignById(...)` | `GET` | `/vital-signs/${vitalSignId}` | Get Vital Sign By Id | `-` | `response.data.data.vitalSign` | `-` | `/Users/macuser/code/Medflow-FE/src/services/vital-sign.service.js:18` |
| `getVitalSignsByPatient(...)` | `GET` | `/vital-signs/patient/${patientId}?${params.toString()}` | Get Vital Signs By Patient | `-` | `response.data.data` | `page, limit` | `/Users/macuser/code/Medflow-FE/src/services/vital-sign.service.js:23` |
| `getVitalSignByAppointment(...)` | `GET` | `/vital-signs/appointment/${appointmentId}` | Get Vital Sign By Appointment | `-` | `response.data.data.vitalSign` | `-` | `/Users/macuser/code/Medflow-FE/src/services/vital-sign.service.js:34` |
| `getLatestVitalsByPatient(...)` | `GET` | `/vital-signs/patient/${patientId}/latest` | Get Latest Vitals By Patient | `-` | `response.data.data.vitalSign` | `-` | `/Users/macuser/code/Medflow-FE/src/services/vital-sign.service.js:41` |
| `getVitalsTrend(...)` | `GET` | `/vital-signs/patient/${patientId}/trend?days=${days}` | Get Vitals Trend | `-` | `response.data.data.vitals` | `-` | `/Users/macuser/code/Medflow-FE/src/services/vital-sign.service.js:48` |
| `createVitalSign(...)` | `POST` | `/vital-signs` | Create Vital Sign | `vitalSignData` | `response.data.data.vitalSign` | `-` | `/Users/macuser/code/Medflow-FE/src/services/vital-sign.service.js:55` |
| `updateVitalSign(...)` | `PUT` | `/vital-signs/${vitalSignId}` | Update Vital Sign | `updates` | `response.data.data.vitalSign` | `-` | `/Users/macuser/code/Medflow-FE/src/services/vital-sign.service.js:60` |
| `deleteVitalSign(...)` | `DELETE` | `/vital-signs/${vitalSignId}` | Delete Vital Sign | `-` | `response.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/vital-sign.service.js:65` |

### waitlist.service.js

| Client Method | HTTP | Endpoint | What it does | Payload sent | Expects / returns | Query params | Source |
|---|---|---|---|---|---|---|---|
| `getAllWaitlistEntries(...)` | `GET` | `/waitlist?${params.toString()}` | Get all waitlist entries with pagination and filters | `-` | `response.data.data` | `page, limit, providerId, patientId, status, priority, search, dateFrom, dateTo` | `/Users/macuser/code/Medflow-FE/src/services/waitlist.service.js:19` |
| `getWaitlistEntryById(...)` | `GET` | `/waitlist/${waitlistEntryId}` | Get waitlist entry by ID | `-` | `response.data.data.waitlistEntry` | `-` | `/Users/macuser/code/Medflow-FE/src/services/waitlist.service.js:50` |
| `createWaitlistEntry(...)` | `POST` | `/waitlist` | Create waitlist entry | `waitlistEntryData` | `response.data.data.waitlistEntry` | `-` | `/Users/macuser/code/Medflow-FE/src/services/waitlist.service.js:60` |
| `updateWaitlistEntry(...)` | `PUT` | `/waitlist/${waitlistEntryId}` | Update waitlist entry | `updates` | `response.data.data.waitlistEntry` | `-` | `/Users/macuser/code/Medflow-FE/src/services/waitlist.service.js:71` |
| `markAsCalled(...)` | `POST` | `/waitlist/${waitlistEntryId}/called` | Mark waitlist entry as called | `-` | `response.data.data.waitlistEntry` | `-` | `/Users/macuser/code/Medflow-FE/src/services/waitlist.service.js:84` |
| `markAsScheduled(...)` | `POST` | `/waitlist/${waitlistEntryId}/scheduled` | Mark waitlist entry as scheduled | `-` | `response.data.data.waitlistEntry` | `-` | `/Users/macuser/code/Medflow-FE/src/services/waitlist.service.js:96` |
| `convertToAppointment(...)` | `POST` | `/waitlist/${waitlistEntryId}/convert-to-appointment` | Convert waitlist entry to appointment | `appointmentData` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/waitlist.service.js:109` |
| `deleteWaitlistEntry(...)` | `DELETE` | `/waitlist/${waitlistEntryId}` | Delete waitlist entry | `-` | `response.data.data` | `-` | `/Users/macuser/code/Medflow-FE/src/services/waitlist.service.js:122` |

## Wrapper Methods (No Direct HTTP Call)

| Client Method | Behavior | Source |
|---|---|---|
| `getDeniedClaims(...)` | `delegates to getAllClaims(...)` | `/Users/macuser/code/Medflow-FE/src/services/claim.service.js:92` |
| `createPayment(...)` | `delegates to recordPayment(...)` | `/Users/macuser/code/Medflow-FE/src/services/payment.service.js:86` |

## Notes

- Most methods expect backend envelope `response.data.data`, then return either that object or a nested field (for example `data.user`, `data.patient`, `data.invoice`).
- Multipart/form-data endpoints include document upload, claim document attachment, ERA import, practice info create/update, and OCR extract.
- `src/services/ocr.service.js` uses `axios` directly and reads token from `localStorage.token` (not `accessToken`).
