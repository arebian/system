#!/usr/bin/env python3
"""Build the locally embedded public-domain Archive edition.

Input is Project Gutenberg eBook #132.  The full source text, including its
licence notice, is retained in the generated PDF so the application never has
to depend on an external reader just to show this public-domain work.
"""

from __future__ import annotations

import html
import sys
from pathlib import Path

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
DEJAVU_DIR = Path("/usr/share/fonts/truetype/dejavu")


def register_fonts() -> tuple[str, str]:
    regular = DEJAVU_DIR / "DejaVuSerif.ttf"
    bold = DEJAVU_DIR / "DejaVuSerif-Bold.ttf"
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("ArchiveSerif", str(regular)))
        pdfmetrics.registerFont(TTFont("ArchiveSerifBold", str(bold)))
        return "ArchiveSerif", "ArchiveSerifBold"
    return "Times-Roman", "Times-Bold"


def page_footer(canvas, document) -> None:
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#C8B27A"))
    canvas.setLineWidth(0.35)
    canvas.line(0.7 * inch, 0.55 * inch, letter[0] - 0.7 * inch, 0.55 * inch)
    canvas.setFillColor(colors.HexColor("#5D536A"))
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawString(0.7 * inch, 0.37 * inch, "THE SYSTEM // GRAND ARCHIVE // PUBLIC-DOMAIN EDITION")
    canvas.drawRightString(letter[0] - 0.7 * inch, 0.37 * inch, f"PAGE {document.page}")
    canvas.restoreState()


def paragraph_text(raw: str) -> str:
    cleaned = " ".join(raw.replace("\t", " ").split())
    return html.escape(cleaned, quote=False)


def main(source: Path, output: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(source)

    regular, bold = register_fonts()
    raw = source.read_text(encoding="utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = [piece.strip() for piece in raw.split("\n\n") if piece.strip()]

    output.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(output),
        pagesize=letter,
        leftMargin=0.78 * inch,
        rightMargin=0.78 * inch,
        topMargin=0.78 * inch,
        bottomMargin=0.78 * inch,
        title="The Art of War - Public-Domain Edition",
        author="Sun Tzu; translated by Lionel Giles",
        subject="Public-domain edition included in THE SYSTEM Grand Archive",
    )

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "ArchiveBody",
        parent=styles["BodyText"],
        fontName=regular,
        fontSize=10.1,
        leading=15.0,
        textColor=colors.HexColor("#241D2B"),
        alignment=TA_JUSTIFY,
        spaceAfter=8,
    )
    heading = ParagraphStyle(
        "ArchiveHeading",
        parent=body,
        fontName=bold,
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#2B143C"),
        spaceBefore=14,
        spaceAfter=9,
    )
    cover_kicker = ParagraphStyle(
        "CoverKicker",
        parent=body,
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#72549A"),
        alignment=TA_CENTER,
        spaceAfter=18,
    )
    cover_title = ParagraphStyle(
        "CoverTitle",
        parent=body,
        fontName=bold,
        fontSize=34,
        leading=40,
        textColor=colors.HexColor("#24112F"),
        alignment=TA_CENTER,
        spaceAfter=14,
    )
    cover_subtitle = ParagraphStyle(
        "CoverSubtitle",
        parent=body,
        fontName=regular,
        fontSize=15,
        leading=22,
        textColor=colors.HexColor("#5A4F64"),
        alignment=TA_CENTER,
        spaceAfter=20,
    )
    cover_note = ParagraphStyle(
        "CoverNote",
        parent=body,
        fontName=regular,
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#645B69"),
        alignment=TA_CENTER,
    )

    story = [
        Spacer(1, 1.75 * inch),
        Paragraph("THE GRAND ARCHIVE // E-RANK", cover_kicker),
        Paragraph("The Art of War", cover_title),
        Paragraph("Sun Tzu<br/>Translated by Lionel Giles", cover_subtitle),
        Spacer(1, 0.6 * inch),
        Paragraph(
            "A complete locally embedded public-domain edition. Source: "
            "Project Gutenberg eBook #132. The original Project Gutenberg "
            "notice and licence are retained within this PDF.",
            cover_note,
        ),
        PageBreak(),
    ]

    for raw_paragraph in paragraphs:
        text = paragraph_text(raw_paragraph)
        if not text:
            continue
        looks_like_heading = (
            len(text) <= 90
            and text.upper() == text
            and any(character.isalpha() for character in text)
        )
        story.append(Paragraph(text, heading if looks_like_heading else body))

    document.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    page_count = len(PdfReader(str(output)).pages)
    print(f"PDF_PAGES={page_count}")
    print(f"PDF_PATH={output}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: generate_public_domain_art_of_war_pdf.py SOURCE.txt OUTPUT.pdf")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
