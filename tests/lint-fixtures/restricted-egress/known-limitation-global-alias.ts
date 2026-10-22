const g = globalThis;
export const load = () => g.fetch('https://example.com/data');
export const open = () => globalThis['fetch']('https://example.com/data');
