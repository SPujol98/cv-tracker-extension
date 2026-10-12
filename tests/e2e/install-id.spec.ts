import { readFile } from 'node:fs/promises';
import { copyBuildToTempFolder, expect, launchWithExtension, test } from './fixtures/extension.ts';

async function documentedId(): Promise<string> {
  return (await readFile('docs/extension-id.txt', 'utf8')).trim();
}

test.describe('stable extension ID (SHELL-2)', () => {
  test('equals the documented ID when loaded from two different folders', async () => {
    const expected = await documentedId();
    const ids: string[] = [];
    const folders: string[] = [];
    for (let run = 0; run < 2; run++) {
      const folder = await copyBuildToTempFolder();
      folders.push(folder.dir);
      const { context, extensionId } = await launchWithExtension(folder.dir);
      ids.push(extensionId);
      await context.close();
      await folder.cleanup();
    }
    expect(new Set(folders).size).toBe(2);
    expect(ids).toEqual([expected, expected]);
  });

  test('the fixture exposes an extension page under that ID', async ({ extension }) => {
    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
    await expect(page.locator('#root')).toContainText('Settings');
  });
});
