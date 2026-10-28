module.exports = ({ config }) => {
  const isProductionBuild = process.env.NODE_ENV === 'production'
    || Boolean(process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== 'development');

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (apiBaseUrl) {
    let parsedUrl;
    try {
      parsedUrl = new URL(apiBaseUrl);
    } catch {
      throw new Error('EXPO_PUBLIC_API_URL must be a complete URL ending in /api/v1.');
    }

    const isPrivateIp = /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(parsedUrl.hostname);
    if (isProductionBuild && parsedUrl.protocol !== 'https:' && !isPrivateIp) {
      throw new Error('Production EXPO_PUBLIC_API_URL must be an HTTPS URL ending in /api/v1 for public domains.');
    }
  }

  return config;
};
