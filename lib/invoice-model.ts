export type InvoiceConceptStatus = 'concept' | 'gecontroleerd';
export type InvoiceControlStatus = 'vereist' | 'bevestigd';
export type InvoiceNumberStatus = 'nog niet toegewezen' | 'toegewezen';
export type InvoicePaymentStatus = 'niet gestart' | 'Klaar voor betaling';
export type InvoiceMailStatus = 'nog niet verzonden' | 'Klaar voor verzending';
export type InvoiceExecutionStatus = 'nog niet klaar' | 'klaar voor uitvoering';
export type InvoiceLastControlStatus = 'nog niet uitgevoerd' | 'uitgevoerd';

export interface InvoiceConcept {
  reference: string;
  customerLabel: 'wacht op bedrijfscontrole';
  sourceLabel: 'transportbevestiging';
  statusLabel: InvoiceConceptStatus;
  amountLabel: 'nog te bepalen';
  paymentStatusLabel: InvoicePaymentStatus;
  stripeStatusLabel: 'Stripe nog niet gekoppeld';
  mailStatusLabel: InvoiceMailStatus;
  dispatchStatusLabel: 'nog niet uitgevoerd';
  lastControlStatusLabel: InvoiceLastControlStatus;
  executionStatusLabel: InvoiceExecutionStatus;
  auditStatusLabel: 'facturatiestappen zichtbaar vastgelegd';
  controlStatusLabel: InvoiceControlStatus;
  invoiceNumberStatusLabel: InvoiceNumberStatus;
  invoiceNumberLabel: string;
}

export function createInvoiceConcept(reference = 'FC-2026-001'): InvoiceConcept {
  return {
    reference,
    customerLabel: 'wacht op bedrijfscontrole',
    sourceLabel: 'transportbevestiging',
    statusLabel: 'concept',
    amountLabel: 'nog te bepalen',
    paymentStatusLabel: 'niet gestart',
    stripeStatusLabel: 'Stripe nog niet gekoppeld',
    mailStatusLabel: 'nog niet verzonden',
    dispatchStatusLabel: 'nog niet uitgevoerd',
    lastControlStatusLabel: 'nog niet uitgevoerd',
    executionStatusLabel: 'nog niet klaar',
    auditStatusLabel: 'facturatiestappen zichtbaar vastgelegd',
    controlStatusLabel: 'vereist',
    invoiceNumberStatusLabel: 'nog niet toegewezen',
    invoiceNumberLabel: 'nog niet toegewezen',
  };
}

export function canReviewInvoiceConcept(concept: InvoiceConcept) {
  return concept.statusLabel === 'concept';
}

export function canAssignInvoiceNumber(concept: InvoiceConcept) {
  return concept.controlStatusLabel === 'bevestigd' && concept.invoiceNumberStatusLabel === 'nog niet toegewezen';
}

export function canPrepareInvoicePaymentStatus(concept: InvoiceConcept) {
  return concept.invoiceNumberStatusLabel === 'toegewezen' && concept.paymentStatusLabel === 'niet gestart';
}

export function canQueueInvoiceCustomerMail(concept: InvoiceConcept) {
  return concept.paymentStatusLabel === 'Klaar voor betaling' && concept.mailStatusLabel === 'nog niet verzonden';
}

export function canRunFinalInvoiceControl(concept: InvoiceConcept) {
  return (
    concept.controlStatusLabel === 'bevestigd' &&
    concept.invoiceNumberStatusLabel === 'toegewezen' &&
    concept.paymentStatusLabel === 'Klaar voor betaling' &&
    concept.mailStatusLabel === 'Klaar voor verzending' &&
    concept.executionStatusLabel === 'nog niet klaar'
  );
}

export function reviewInvoiceConcept(concept: InvoiceConcept): InvoiceConcept {
  if (!canReviewInvoiceConcept(concept)) {
    return concept;
  }

  return {
    ...concept,
    statusLabel: 'gecontroleerd',
    controlStatusLabel: 'bevestigd',
  };
}

export function assignInvoiceNumber(concept: InvoiceConcept, invoiceNumber = 'TAZE-CONCEPT-0001'): InvoiceConcept {
  if (!canAssignInvoiceNumber(concept)) {
    return concept;
  }

  return {
    ...concept,
    invoiceNumberStatusLabel: 'toegewezen',
    invoiceNumberLabel: invoiceNumber,
  };
}

export function prepareInvoicePaymentStatus(concept: InvoiceConcept): InvoiceConcept {
  if (!canPrepareInvoicePaymentStatus(concept)) {
    return concept;
  }

  return {
    ...concept,
    paymentStatusLabel: 'Klaar voor betaling',
  };
}

export function queueInvoiceCustomerMail(concept: InvoiceConcept): InvoiceConcept {
  if (!canQueueInvoiceCustomerMail(concept)) {
    return concept;
  }

  return {
    ...concept,
    mailStatusLabel: 'Klaar voor verzending',
  };
}

export function runFinalInvoiceControl(concept: InvoiceConcept): InvoiceConcept {
  if (!canRunFinalInvoiceControl(concept)) {
    return concept;
  }

  return {
    ...concept,
    lastControlStatusLabel: 'uitgevoerd',
    executionStatusLabel: 'klaar voor uitvoering',
  };
}
