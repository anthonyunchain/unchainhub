-- Fix freelancer_payments_status_check to allow English status values
ALTER TABLE freelancer_payments DROP CONSTRAINT IF EXISTS freelancer_payments_status_check;

ALTER TABLE freelancer_payments ADD CONSTRAINT freelancer_payments_status_check
  CHECK (status IN ('Paid', 'Pending', 'Overdue', 'Payé', 'En attente', 'En retard'));
