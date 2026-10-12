// Owner-run, once: generates the RSA-2048 key pair that pins the extension ID (SHELL-2, ADR-15).
// The private key is written OUTSIDE the repository (default ~/.config/cv-tracker-extension) and never printed.
// Only the public key (base64 SPKI DER, for manifest `key`) goes to stdout; the ID goes to docs/extension-id.txt.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { deriveExtensionId } from '../src/core/extensionId.ts';

const root = resolve(import.meta.dirname, '..');
const privatePath =
  process.argv[2] ?? join(homedir(), '.config/cv-tracker-extension/extension-key.pem');

if (resolve(privatePath).startsWith(`${root}/`)) {
  console.error('Refusing to write the private key inside the repository.');
  process.exit(1);
}
if (existsSync(privatePath)) {
  console.error(
    `A key already exists at ${privatePath}; refusing to replace it (the ID would change).`,
  );
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicDer = publicKey.export({ type: 'spki', format: 'der' });
const id = await deriveExtensionId(new Uint8Array(publicDer));

mkdirSync(dirname(privatePath), { recursive: true, mode: 0o700 });
writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
writeFileSync(join(root, 'docs/extension-id.txt'), `${id}\n`);

console.log(`extension id: ${id}`);
console.log(`private key written to ${privatePath} (mode 600); back it up outside this machine.`);
console.log(`manifest key: ${publicDer.toString('base64')}`);
