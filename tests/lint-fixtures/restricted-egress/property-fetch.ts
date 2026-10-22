const client = { fetch: (url: string) => url };
export const load = () => client.fetch('https://example.com/data');
