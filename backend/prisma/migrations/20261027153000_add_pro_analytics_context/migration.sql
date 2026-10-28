-- Contextual analytics are nullable so historical events and existing data remain untouched.
ALTER TABLE `BusinessAnalyticsEvent`
  ADD COLUMN `visitorKey` CHAR(64) NULL,
  ADD COLUMN `source` VARCHAR(32) NULL,
  ADD COLUMN `searchTerm` VARCHAR(120) NULL,
  ADD COLUMN `searchPosition` INTEGER NULL,
  ADD COLUMN `category` VARCHAR(120) NULL,
  ADD COLUMN `isFeatured` BOOLEAN NULL DEFAULT false;

CREATE INDEX `BusinessAnalyticsEvent_biz_evt_visitor_created_idx`
  ON `BusinessAnalyticsEvent`(`businessId`, `eventType`, `visitorKey`, `createdAt`);
CREATE INDEX `BusinessAnalyticsEvent_biz_evt_source_created_idx`
  ON `BusinessAnalyticsEvent`(`businessId`, `eventType`, `source`, `createdAt`);
CREATE INDEX `BusinessAnalyticsEvent_biz_evt_term_created_idx`
  ON `BusinessAnalyticsEvent`(`businessId`, `eventType`, `searchTerm`, `createdAt`);
