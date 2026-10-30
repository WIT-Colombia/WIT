CREATE TABLE AdminPasskeyActivation (
  id CHAR(36) NOT NULL,
  googleSub VARCHAR(255) NOT NULL,
  tokenHash VARCHAR(64) NOT NULL,
  expiresAt DATETIME(3) NOT NULL,
  consumedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY AdminPasskeyActivation_tokenHash_key (tokenHash),
  INDEX AdminPasskeyActivation_googleSub_expiresAt_idx (googleSub, expiresAt),
  INDEX AdminPasskeyActivation_expiresAt_idx (expiresAt),
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
