export function isUnverifiedEmailLoginExceptionAllowed(nodeEnv: string, configured: boolean): boolean {
  return configured && nodeEnv !== 'production';
}

export function shouldRequireEmailVerification(verifiedAt: Date | null, allowUnverifiedEmailLogin: boolean): boolean {
  return verifiedAt === null && !allowUnverifiedEmailLogin;
}
