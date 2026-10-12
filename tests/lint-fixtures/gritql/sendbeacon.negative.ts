export function describe(payload: string) {
  const sendBeaconLabel = 'beacon';
  return `${sendBeaconLabel}: ${payload}`;
}
