-- Preserve all historical analytics events while adding attribution for
-- deliberate openings of individual products and services.
ALTER TABLE `BusinessAnalyticsEvent`
  MODIFY `eventType` ENUM('BUSINESS_VIEW', 'SEARCH_IMPRESSION', 'WHATSAPP_CLICK', 'PHONE_CLICK', 'DIRECTIONS_CLICK', 'OFFER_VIEW') NOT NULL,
  ADD COLUMN `offerId` CHAR(36) NULL,
  ADD INDEX `BusinessAnalyticsEvent_biz_evt_offer_created_idx` (`businessId`, `eventType`, `offerId`, `createdAt`),
  ADD CONSTRAINT `BusinessAnalyticsEvent_offerId_fkey`
    FOREIGN KEY (`offerId`) REFERENCES `BusinessOffer`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
