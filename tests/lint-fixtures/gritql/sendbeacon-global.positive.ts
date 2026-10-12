export function track(payload: string) {
  globalThis.navigator.sendBeacon('https://example.com/collect', payload);
}
