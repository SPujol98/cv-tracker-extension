import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DOCS = [
  'LICENSE',
  'README.md',
  'PRIVACY.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'docs/architecture.md',
];

const read = (file: string) => readFileSync(file, 'utf8');

describe('public documentation skeleton (SHELL-9, PRIV-6)', () => {
  it.each(DOCS)('%s exists and is not empty', (file) => {
    expect(existsSync(file)).toBe(true);
    expect(read(file).trim().length).toBeGreaterThan(0);
  });

  it('LICENSE is MIT with the repository owner handle and year', () => {
    const license = read('LICENSE');
    expect(license).toContain('MIT License');
    expect(license).toContain('Copyright (c) 2026 SPujol98');
    expect(license).toContain('Permission is hereby granted, free of charge');
  });

  it('SECURITY.md names private vulnerability reporting through GitHub security advisories', () => {
    const security = read('SECURITY.md');
    expect(security).toMatch(/private vulnerability reporting/i);
    expect(security).toMatch(/security advisor(y|ies)/i);
    expect(security).not.toMatch(/@/);
  });

  it('CHANGELOG.md follows Keep a Changelog', () => {
    const changelog = read('CHANGELOG.md');
    expect(changelog).toContain('https://keepachangelog.com/en/1.1.0/');
    expect(changelog).toMatch(/^## \[Unreleased\]/m);
  });

  it('docs/architecture.md contains a Mermaid block', () => {
    expect(read('docs/architecture.md')).toMatch(/```mermaid\n[\s\S]+?\n```/);
  });

  it('README.md has install steps for Chrome and Edge and a terms-of-service risk section', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/^## Install/m);
    expect(readme).toMatch(/Chrome/);
    expect(readme).toMatch(/Edge/);
    expect(readme).toMatch(/^## .*terms of service/im);
  });

  it('PRIVACY.md and README.md carry headed placeholders for the PRIV-6 statements', () => {
    for (const file of ['PRIVACY.md', 'README.md']) {
      const text = read(file);
      for (const heading of [
        'What is stored locally',
        'What leaves the browser',
        'API key storage',
        'No telemetry',
      ]) {
        expect(text, `${file}: ${heading}`).toMatch(new RegExp(`^## ${heading}`, 'm'));
      }
    }
  });

  it('CONTRIBUTING.md covers clean-room rules, TDD, Conventional Commits and required checks', () => {
    const contributing = read('CONTRIBUTING.md');
    expect(contributing).toMatch(/clean-room/i);
    expect(contributing).toMatch(/test-driven|TDD/);
    expect(contributing).toMatch(/Conventional Commits/);
    expect(contributing).toMatch(/^## Required status checks/m);
    expect(contributing).toContain('CodeQL');
  });

  it.each(DOCS)('%s contains no process residue', (file) => {
    expect(read(file)).not.toMatch(/Revision 2|validator fix|orchestrator|sub-agent/i);
  });
});
