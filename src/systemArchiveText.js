import { getSystemPublicDomainEdition } from "./systemArchiveReaderCatalog.js";

export function archiveTextIsValid(text) {
  const value = String(text || "");
  return value.length >= 500 && value.length <= 3000000 &&
    !/^\s*(?:<!doctype\s+html|<html)/i.test(value) &&
    value.includes("*** START OF") && value.includes("*** END OF");
}

export function bundledArchivePath(readerKey) {
  const edition = getSystemPublicDomainEdition({embedded_reader_key:readerKey});
  return edition ? `/books/text/${edition.ebookNumber}.txt` : null;
}

export async function loadBundledArchiveText(readerKey, {fetchImpl = globalThis.fetch, signal} = {}) {
  const path = bundledArchivePath(readerKey);
  if (!path) throw new Error("ARCHIVE_READER_NOT_FOUND");
  const edition = getSystemPublicDomainEdition({embedded_reader_key:readerKey});
  const response = await fetchImpl(path, {signal});
  if (!response.ok) throw new Error("ARCHIVE_TEXT_UNAVAILABLE");
  const text = await response.text();
  if (!archiveTextIsValid(text)) throw new Error("ARCHIVE_TEXT_INVALID");
  return {provider:"SYSTEM_BUNDLED", reader_key:readerKey, ebook_number:edition.ebookNumber, source_url:edition.sourceUrl, text};
}
