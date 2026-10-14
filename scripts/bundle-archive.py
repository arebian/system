"""Fetch the curated editions without changing their text or license notices."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
books = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    "import {SYSTEM_ARCHIVE_CURATED_BOOKS as books} from './src/systemArchiveReaderCatalog.js'; console.log(JSON.stringify(books.map(b=>({key:b.key,title:b.title,author:b.author,id:b.edition.ebookNumber}))));",
], cwd=root))
destination = root / "public" / "books" / "text"
destination.mkdir(parents=True, exist_ok=True)

def download(book):
    ebook = book["id"]
    target = destination / (ebook + ".txt")
    sources = [
        f"https://www.gutenberg.org/cache/epub/{ebook}/pg{ebook}.txt",
        f"https://www.gutenberg.org/ebooks/{ebook}.txt.utf-8",
        f"https://www.gutenberg.org/files/{ebook}/{ebook}-0.txt",
    ]
    for url in sources:
        result = subprocess.run(["curl", "-fsSL", "--max-time", "20", "--max-filesize", "3000000", url], capture_output=True)
        if result.returncode:
            continue
        data = result.stdout
        text = data.decode("utf-8-sig")
        if len(data) < 500 or "*** START OF" not in text or "*** END OF" not in text or "Project Gutenberg" not in text or text.lstrip().lower().startswith(("<!doctype", "<html")):
            continue
        target.write_bytes(data)
        return {**book, "source": url, "sourcePage": f"https://www.gutenberg.org/ebooks/{ebook}", "bytes":len(data), "sha256":hashlib.sha256(data).hexdigest()}
    raise RuntimeError("No verified full text for " + book["key"])

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    records = list(pool.map(download, books))
(destination / "manifest.json").write_text(json.dumps({"provider":"Project Gutenberg", "licenseNotice":"Original edition text and Project Gutenberg license notices retained. Public-domain status is jurisdiction dependent; see each edition's source page.", "editions":records}, indent=2) + "\n")
print(json.dumps({"verifiedBooks":len(records), "bytes":sum(b["bytes"] for b in records)}))
