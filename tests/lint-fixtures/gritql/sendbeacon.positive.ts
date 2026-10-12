export function track(payload: string) {
  navigator.sendBeacon('https://example.com/collect', payload);
}
