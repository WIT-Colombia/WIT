-- Persist actual invitation expiry to keep hourly scans bounded.
ALTER TABLE `BusinessMembership`
  MODIFY COLUMN `status` ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'REVOKED', 'EXPIRED')
  NOT NULL DEFAULT 'INVITED';
