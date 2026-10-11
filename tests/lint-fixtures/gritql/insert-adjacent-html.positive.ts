export function render(el: HTMLElement, html: string) {
  el.insertAdjacentHTML('beforeend', html);
}
