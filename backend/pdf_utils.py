from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (HRFlowable, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

NAVY = colors.HexColor("#0f2a4a")
BLUE = colors.HexColor("#1d5fd1")
LIGHT = colors.HexColor("#eef3fb")
GREY = colors.HexColor("#5b6675")


def _p(text, style):
    return Paragraph(escape(str(text)) if text not in (None, "") else "-", style)


def build_prescription_pdf(rx, doctor, patient, medicines):
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"Prescription #{rx['id']}")
    base = getSampleStyleSheet()["Normal"]
    body = ParagraphStyle("body", parent=base, fontSize=10, leading=14)
    small = ParagraphStyle("small", parent=body, fontSize=9, textColor=GREY)
    label = ParagraphStyle("label", parent=body, fontSize=8.5, textColor=GREY)
    h_clinic = ParagraphStyle("hc", parent=body, fontSize=18, leading=22, textColor=NAVY, fontName="Helvetica-Bold")
    h_sec = ParagraphStyle("hs", parent=body, fontSize=11, textColor=BLUE, fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=4)
    cell = ParagraphStyle("cell", parent=body, fontSize=9.5, leading=12)
    cell_h = ParagraphStyle("cellh", parent=cell, textColor=colors.white, fontName="Helvetica-Bold")

    story = []
    clinic = doctor.get("clinic_name") or "Veterinary Clinic"
    story.append(Paragraph(escape(clinic), h_clinic))
    if doctor.get("clinic_address"):
        story.append(Paragraph(escape(doctor["clinic_address"]), small))
    contact = " | ".join(x for x in [doctor.get("phone"), doctor.get("email")] if x)
    if contact:
        story.append(Paragraph(escape(contact), small))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BLUE))
    story.append(Spacer(1, 6))

    # doctor + prescription meta
    doc_lines = f"<b>Dr. {escape(doctor['full_name'])}</b>"
    if doctor.get("qualification"):
        doc_lines += f"<br/>{escape(doctor['qualification'])}"
    if doctor.get("specialization"):
        doc_lines += f"<br/>{escape(doctor['specialization'])}"
    meta = (f"<b>Prescription #</b> {rx['id']}<br/>"
            f"<b>Date:</b> {rx['prescribed_on'].strftime('%d %b %Y')}")
    t = Table([[Paragraph(doc_lines, body), Paragraph(meta, body)]], colWidths=[100 * mm, 74 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (1, 0), (1, 0), "RIGHT")]))
    story.append(t)

    # patient box
    story.append(Paragraph("Patient &amp; Owner", h_sec))
    age = f"{patient['age']:g} yrs" if patient.get("age") is not None else "-"
    weight = f"{patient['weight']:g} kg" if patient.get("weight") is not None else "-"
    rows = [
        [Paragraph("Pet name", label), _p(patient["pet_name"], cell),
         Paragraph("Species / Breed", label), _p(f"{patient['species']} / {patient.get('breed') or '-'}", cell)],
        [Paragraph("Age", label), _p(age, cell), Paragraph("Gender", label), _p(patient.get("gender"), cell)],
        [Paragraph("Weight", label), _p(weight, cell), Paragraph("Blood group", label), _p(patient.get("blood_group"), cell)],
        [Paragraph("Owner", label), _p(patient["owner_name"], cell), Paragraph("Phone", label), _p(patient["owner_phone"], cell)],
    ]
    pt = Table(rows, colWidths=[24 * mm, 63 * mm, 30 * mm, 57 * mm])
    pt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cdd8ea")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(pt)

    story.append(Paragraph("Diagnosis", h_sec))
    story.append(Paragraph(escape(rx["diagnosis"]), body))

    story.append(Paragraph("Medicines (Rx)", h_sec))
    data = [[Paragraph(h, cell_h) for h in ("#", "Medicine", "Dosage", "Frequency", "Duration", "Instructions")]]
    for i, m in enumerate(medicines, 1):
        data.append([_p(i, cell), _p(m["medicine_name"], cell), _p(m["dosage"], cell),
                     _p(m["frequency"], cell), _p(m["duration"], cell), _p(m["instructions"], cell)])
    mt = Table(data, colWidths=[8 * mm, 42 * mm, 24 * mm, 28 * mm, 24 * mm, 48 * mm], repeatRows=1)
    mt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cdd8ea")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(mt)

    if rx.get("notes"):
        story.append(Paragraph("Additional Notes", h_sec))
        story.append(Paragraph(escape(rx["notes"]).replace("\n", "<br/>"), body))

    story.append(Spacer(1, 28))
    sig = Table([["", Paragraph(f"<b>Dr. {escape(doctor['full_name'])}</b><br/>Signature", body)]],
                colWidths=[110 * mm, 64 * mm])
    sig.setStyle(TableStyle([("LINEABOVE", (1, 0), (1, 0), 0.8, NAVY), ("TOPPADDING", (1, 0), (1, 0), 4)]))
    story.append(sig)

    doc.build(story)
    buf.seek(0)
    return buf
