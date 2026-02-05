const localIpPatterns = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/[a-z0-9-]+\.local(:\d+)?$/i,
];

export function isAllowedOrigin(origin: string, explicitFrontendUrl?: string): boolean {
  if (!origin) {
    return true;
  }

  if (explicitFrontendUrl && origin === explicitFrontendUrl) {
    return true;
  }

  return localIpPatterns.some((pattern) => pattern.test(origin));
}
