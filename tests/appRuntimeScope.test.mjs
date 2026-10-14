import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  MAGE_ARCHIVE_CURATED_FALLBACK_BOOKS,
  SYSTEM_ARCHIVE_CURATED_BOOKS,
  SYSTEM_PUBLIC_DOMAIN_EDITIONS,
  getSystemPublicDomainEdition,
} from "../src/systemArchiveReaderCatalog.js";

const source = await readFile(
  new URL("../src/SystemGame.jsx", import.meta.url),
  "utf8",
);
const archiveSource = await readFile(new URL("../src/MageArchive.jsx", import.meta.url), "utf8");

const cloudSource = await readFile(
  new URL("../src/systemCloud.js", import.meta.url),
  "utf8",
);

// Inspect active migrations so a recovered baseline keeps these guards.
const migrationDir = new URL('../supabase/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationDir)).filter(name => name.endsWith('.sql')).sort();
const migrationSource = (await Promise.all(migrationFiles.map(name => readFile(new URL(name, migrationDir), 'utf8')))).join('\n');
const rotationMigration = migrationSource;
const archiveCuratedMigration = migrationSource;
const archiveReaderGuardMigration = migrationSource;

function componentBlock(startMarker, endMarker) {
  const moduleSource = startMarker.includes("MageArchive") ? archiveSource : source;
  const start = moduleSource.indexOf(startMarker);
  const declaredEnd = moduleSource.indexOf(endMarker, start);
  const next = moduleSource.slice(start + startMarker.length).search(/\nexport (?:function|async function|const|class) /);
  const end = declaredEnd > start ? declaredEnd : next >= 0 ? start + startMarker.length + next : moduleSource.length;

  assert.ok(start >= 0, `${startMarker} must exist`);
  assert.ok(end > start, `${endMarker} must follow ${startMarker}`);

  return moduleSource.slice(start, end);
}

test("the workout timer is owned by Training, not the Grand Archive", () => {
  const training = componentBlock(
    "function Training(",
    "function SystemField(",
  );
  const archive = componentBlock(
    "function MageArchive(",
    "function ClassTraining(",
  );

  assert.match(training, /const \[timerModalOpen, setTimerModalOpen\]/);
  assert.match(training, /<WorkoutTimerModal/);
  assert.match(training, /<WorkoutTimerInlineStatus/);
  assert.doesNotMatch(archive, /\bactiveTimer\b/);
  assert.doesNotMatch(archive, /\bfinishTimedWorkout\b/);
});

test("background music is started only by the soundtrack toggle intent", () => {
  const musicEngine = componentBlock(
    "function MusicEngine(",
    "async function getCloudUser(",
  );

  assert.match(musicEngine, /system-music-intent/);
  assert.doesNotMatch(musicEngine, /addEventListener\(\s*"pointerdown"/);
  assert.doesNotMatch(musicEngine, /addEventListener\(\s*"keydown"/);
  assert.match(source, /function toggleSoundtrack\(\)/);
});

test("Commander recording has a local discard path before upload", async () => {
  const commander = await readFile(new URL("../src/ClassSpecial.jsx", import.meta.url), "utf8");

  assert.match(commander, /function discardCommanderClip\(\)/);
  assert.match(commander, /× DISCARD CLIP & RETAKE/);
  assert.match(commander, /discardRecordingRef/);
});

test("the Archive opens a native curated edition before provider search", () => {
  const archive = componentBlock(
    "function MageArchive(",
    "function ClassTraining(",
  );

  assert.match(archive, /getSystemPublicDomainEdition\(\s*activeBook/);
  assert.match(archive, /SYSTEM_PUBLIC_DOMAIN/);
  assert.match(archive, /loadSystemArchiveText/);
  assert.match(archive, /mage-reader-native-text/);
  assert.match(archive, /SYSTEM_NATIVE_TEXT/);
  assert.match(archive, /SYSTEM_EMBEDDED_PDF/);
  assert.doesNotMatch(archive, /OPEN LIVE EDITION/);
});

test("every active Archive slot has a curated in-app public-domain reader", async () => {
  const archive = componentBlock(
    "function MageArchive(",
    "function ClassTraining(",
  );
  const pdf = await readFile(
    new URL("../public/books/the-art-of-war-lionel-giles.pdf", import.meta.url),
  );

  assert.equal(SYSTEM_ARCHIVE_CURATED_BOOKS.length, 31);
  assert.equal(MAGE_ARCHIVE_CURATED_FALLBACK_BOOKS.length, 31);
  assert.equal(Object.keys(SYSTEM_PUBLIC_DOMAIN_EDITIONS).length, 31);

  for (const book of SYSTEM_ARCHIVE_CURATED_BOOKS) {
    const edition = getSystemPublicDomainEdition({
      embedded_reader_key: book.key,
    });

    assert.ok(edition, `${book.key} must resolve to an in-app edition`);
    assert.match(edition.sourceUrl, /^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/);

    if (book.key === "the-art-of-war") {
      assert.equal(edition.readerMode, "SYSTEM_LOCAL_PDF");
      assert.equal(edition.pdfUrl, "/books/the-art-of-war-lionel-giles.pdf");
      continue;
    }

    assert.equal(edition.readerMode, "SYSTEM_NATIVE_TEXT");
    assert.match(
      edition.textUrl,
      /^https:\/\/www\.gutenberg\.org\/cache\/epub\/\d+\/pg\d+\.txt$/,
    );
    assert.equal(edition.pdfUrl, undefined);
  }

  assert.match(archiveCuratedMigration, /embedded_reader_key = curated\.slug/);
  assert.match(archiveCuratedMigration, /mage_books_active_in_app_reader/);
  assert.match(archiveReaderGuardMigration, /embedded_reader_key in \(/);
  assert.match(archiveReaderGuardMigration, /'brothers-karamazov'/);
  assert.equal(pdf.subarray(0, 5).toString("utf8"), "%PDF-");
});

test("Daily Command is read from the backend and shares its class directive with Quests", () => {
  const dashboard = componentBlock(
    "function Dashboard(",
    "function dailyCommandClassQuest(",
  );
  const questPage = componentBlock(
    "function QuestPage(",
    "function SectionLabel(",
  );

  assert.match(cloudSource, /system_daily_command_brief_v1/);
  assert.match(source, /loadDailyCommandBrief/);
  assert.match(dashboard, /dailyCommand=\{dailyCommand\}/);
  assert.match(questPage, /dailyCommandClassQuest\(\s*dailyCommand/);
});

test("the backend rotation has an explicit seven-day window", () => {
  assert.match(rotationMigration, /system_generate_daily_quests/);
  assert.match(rotationMigration, /system_resolve_adaptive_quest_v2/);
  assert.match(rotationMigration, /p_for_date - 6/);
  assert.match(rotationMigration, /rotation_window_days/);
  assert.match(rotationMigration, /system_daily_command_brief_v1/);
});
