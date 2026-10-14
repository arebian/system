import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {errorEvent, recoveryMessage} from '../src/systemErrors.js';
import {archiveTextIsValid, loadBundledArchiveText, bundledArchivePath} from '../src/systemArchiveText.js';
import {SYSTEM_ARCHIVE_CURATED_BOOKS} from '../src/systemArchiveReaderCatalog.js';

test('error reporting discards credentials, arbitrary messages and URLs', () => {
  for (const sensitive of ['USER_PRIVATE_VALUE', 'Bearer abc123', 'https://site.invalid?token=secret', 'person@example.invalid']) {
    assert.equal(errorEvent(new Error(sensitive),'AI').code,'UNEXPECTED_ERROR');
    assert.ok(!JSON.stringify(errorEvent(new Error(sensitive),'AI')).includes(sensitive));
  }
  assert.equal(errorEvent(new Error('Failed to fetch'),'AI').code,'NETWORK_UNAVAILABLE');
  assert.match(recoveryMessage(new Error('AUTH_REQUEST_TIMEOUT')), /current status before retrying/);
});

test('every book has a complete bundled edition matching its manifest', async () => {
  const manifest=JSON.parse(await readFile(new URL('../public/books/text/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.editions.length,31);
  for (const book of SYSTEM_ARCHIVE_CURATED_BOOKS) {
    const entry=manifest.editions.find(row=>row.key===book.key);
    assert.equal(entry.id,book.edition.ebookNumber);
    const bytes=await readFile(new URL(`../public${bundledArchivePath(book.key)}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
    assert.ok(archiveTextIsValid(bytes.toString('utf8')),book.title);
  }
});

test('a successful HTML error page is rejected instead of becoming a book', async () => {
  await assert.rejects(loadBundledArchiveText('the-alchemist',{fetchImpl:async()=>({ok:true,text:async()=>'<html>Error 404</html>'.repeat(100)})}),/ARCHIVE_TEXT_INVALID/);
  assert.equal(bundledArchivePath('../../private'),null);
  assert.ok(!archiveTextIsValid('short content'));
});
