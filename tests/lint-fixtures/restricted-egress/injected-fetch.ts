export const load = (deps: { fetch: (url: string) => Promise<unknown> }) => deps.fetch('https://example.com/data');
