"""Extract the supplied text PDF. Requires pypdf; does not connect to a database."""
import argparse
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument("pdf", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
reader = PdfReader(args.pdf)
first_page = reader.pages[0].extract_text() or ""
if "Effective 10-1-2016" not in first_page:
    raise SystemExit("Unexpected source edition; review the PDF before importing.")
entries = []
current = None
for page_number, page in enumerate(reader.pages, 1):
    if page_number % 200 == 0:
        print(f"Extracting page {page_number}/{len(reader.pages)}", flush=True)
    for line in (page.extract_text() or "").splitlines():
        line = " ".join(line.split())
        if not line or line.startswith(("COMPLETE LIST", "Effective ")) or line.isdigit():
            continue
        match = re.match(r"^([A-Z][0-9][A-Z0-9]{1,5})\s+(.+)$", line)
        if match:
            raw, description = match.groups()
            code = raw[:3] + ("." + raw[3:] if len(raw) > 3 else "")
            current = {"code": code, "description": description, "page": page_number}
            entries.append(current)
        elif current:
            current["description"] += " " + line
        else:
            raise SystemExit(f"Unrecognized content on page {page_number}: {line}")
duplicates = []
seen = {}
for entry in entries:
    if entry["code"] in seen:
        duplicates.append(entry["code"])
    seen[entry["code"]] = entry
if duplicates:
    raise SystemExit(f"Duplicate codes require review: {duplicates}")
overlong = [entry["code"] for entry in entries if len(entry["description"]) > 255]
data = {
    "source": {
        "filename": args.pdf.name,
        "effectiveDate": "2016-10-01",
        "classification": "ICD-10-CM",
        "scope": "All codes from the supplied PDF",
        "sha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(),
        "pages": len(reader.pages),
    },
    "report": {"records": len(entries), "duplicates": duplicates, "overlongDescriptions": overlong},
    "entries": entries,
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"pages": len(reader.pages), "records": len(entries), "overlongDescriptions": len(overlong), "output": str(args.output)}))
