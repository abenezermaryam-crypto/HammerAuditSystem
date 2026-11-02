module.exports = ({ config }) => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (apiBaseUrl) {
    try {
      const parsedUrl = new URL(apiBaseUrl);
      if (!parsedUrl.pathname.endsWith('/api/v1')) {
        console.warn('[app.config.js] EXPO_PUBLIC_API_URL should typically end in /api/v1:', apiBaseUrl);
      }
    } catch {
      console.warn('[app.config.js] Invalid EXPO_PUBLIC_API_URL format:', apiBaseUrl);
    }
  }

  return config;
};
