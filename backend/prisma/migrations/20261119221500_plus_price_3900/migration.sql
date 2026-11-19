-- Monthly Plus price changed from COP 4,900 to COP 3,900 on owner's instruction.
-- Keep CLOSED requests immutable for historical auditing.
-- Pending requests have not been charged by Xamuko; apply the lower price.
ALTER TABLE `UserPlusPurchaseRequest`
  MODIFY COLUMN `amountCop` INTEGER NOT NULL DEFAULT 3900;

UPDATE `UserPlusPurchaseRequest`
SET `amountCop` = 3900
WHERE `status` = 'PENDING_PAYMENT' AND `amountCop` = 4900;
