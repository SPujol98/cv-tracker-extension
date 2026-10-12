// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../src/ui/i18n/en.ts';
import { es } from '../../src/ui/i18n/es.ts';
import { createI18n, I18nProvider, useI18n } from '../../src/ui/i18n/index.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Label() {
  const { t } = useI18n();
  return <span data-testid="label">{t('common.save')}</span>;
}

describe('live language switch (SHELL-8)', () => {
  let host: HTMLElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('re-renders with the Spanish catalog without remounting', () => {
    const i18n = createI18n('en');
    act(() =>
      root.render(
        <I18nProvider i18n={i18n}>
          <Label />
        </I18nProvider>,
      ),
    );
    const node = host.querySelector('[data-testid="label"]');
    expect(node?.textContent).toBe(en['common.save']);

    act(() => i18n.setLanguage('es'));

    expect(host.querySelector('[data-testid="label"]')).toBe(node);
    expect(node?.textContent).toBe(es['common.save']);
  });
});
