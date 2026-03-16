export const getJwtConfig = () => ({
  secret: process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod-vaultox-12345',
  signOptions: {
    expiresIn: process.env.JWT_EXPIRY || '24h',
  },
});
