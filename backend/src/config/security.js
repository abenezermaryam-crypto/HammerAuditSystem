function getJwtSecret() {
  let secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be set in the environment and contain at least 32 bytes.');
  }

  return secret;
}

function getAllowedOrigins() {
  const configuredOrigins = process.env.CORS_ORIGIN;
  if (!configuredOrigins) {
    throw new Error('CORS_ORIGIN must contain a comma-separated list of allowed origins.');
  }

  const origins = configuredOrigins.split(',').map((origin) => origin.trim());
  if (origins.some((origin) => !origin)) {
    throw new Error('CORS_ORIGIN contains an empty origin.');
  }

  for (const origin of origins) {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
      throw new Error(`CORS_ORIGIN entries must be exact HTTP(S) origins: ${origin}`);
    }
  }

  return origins;
}

module.exports = {
  getJwtSecret,
  getAllowedOrigins
};
