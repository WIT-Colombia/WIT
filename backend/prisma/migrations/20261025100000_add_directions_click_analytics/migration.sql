-- Add the public directions interaction without changing existing rows.
ALTER TABLE `BusinessAnalyticsEvent`
  MODIFY `eventType` ENUM('BUSINESS_VIEW', 'SEARCH_IMPRESSION', 'WHATSAPP_CLICK', 'PHONE_CLICK', 'DIRECTIONS_CLICK') NOT NULL;
