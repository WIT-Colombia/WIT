-- Add optional adult classification with a safe default for existing businesses.
ALTER TABLE `Business`
  ADD COLUMN `adultOnly` BOOLEAN NOT NULL DEFAULT false;
