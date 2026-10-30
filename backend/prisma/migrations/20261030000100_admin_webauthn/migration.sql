CREATE TABLE AdminWebAuthnCredential (
  id CHAR(36) NOT NULL,
  userId CHAR(36) NOT NULL,
  credentialId VARCHAR(512) NOT NULL,
  publicKey VARBINARY(1024) NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports VARCHAR(255) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  lastUsedAt DATETIME(3) NULL,
  revokedAt DATETIME(3) NULL,
  UNIQUE KEY AdminWebAuthnCredential_credentialId_key (credentialId),
  INDEX AdminWebAuthnCredential_userId_revokedAt_idx (userId, revokedAt),
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE AdminWebAuthnChallenge (
  id CHAR(36) NOT NULL,
  userId CHAR(36) NOT NULL,
  challenge VARCHAR(255) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  expiresAt DATETIME(3) NOT NULL,
  consumedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY AdminWebAuthnChallenge_challenge_key (challenge),
  INDEX AdminWebAuthnChallenge_userId_purpose_expiresAt_idx (userId, purpose, expiresAt),
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE AdminSession (
  id CHAR(36) NOT NULL,
  userId CHAR(36) NOT NULL,
  tokenHash VARCHAR(255) NOT NULL,
  expiresAt DATETIME(3) NOT NULL,
  revokedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  lastSeenAt DATETIME(3) NULL,
  UNIQUE KEY AdminSession_tokenHash_key (tokenHash),
  INDEX AdminSession_userId_expiresAt_idx (userId, expiresAt),
  INDEX AdminSession_revokedAt_idx (revokedAt),
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
