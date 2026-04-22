-- Prevent duplicate freelancer rows sharing the same email (case-insensitive).
-- NULL / empty emails are allowed through the partial index filter.
CREATE UNIQUE INDEX IF NOT EXISTS freelancers_email_unique
  ON freelancers (LOWER(email))
  WHERE email IS NOT NULL AND email <> '';
