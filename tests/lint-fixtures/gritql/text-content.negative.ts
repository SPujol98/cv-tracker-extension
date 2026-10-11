export function read(el: HTMLElement, text: string) {
  el.textContent = text;
  return el.textContent;
}
