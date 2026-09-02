"""
Generic PDF export for content that isn't a resume: roadmaps and interview
performance reports. Shares the same dependency-free approach as
core/resume_writer.py (reportlab only, no Word/LibreOffice needed) so it
works identically on any bare department PC.
"""
from __future__ import annotations

import uuid
from typing import Any

import config


def _safe(text: Any) -> str:
    return str(text).strip() if text else ""


def _doc(filename_prefix: str):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate

    out_path = config.GENERATED_DIR / f"{filename_prefix}_{uuid.uuid4().hex}.pdf"
    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=15 * mm, bottomMargin=15 * mm,
    )
    return doc, out_path


def _styles():
    from reportlab.lib.colors import HexColor
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet

    styles = getSampleStyleSheet()
    heading = ParagraphStyle("Section", parent=styles["Heading2"], textColor=HexColor("#0b1f3a"), spaceBefore=10, spaceAfter=4)
    title = ParagraphStyle("Title2", parent=styles["Title"], textColor=HexColor("#0b1f3a"), spaceAfter=2)
    body = styles["BodyText"]
    return title, heading, body


def build_roadmap_pdf(roadmap: dict) -> str:
    from reportlab.platypus import Paragraph, Spacer

    doc, out_path = _doc("roadmap")
    title_style, heading_style, body = _styles()

    story = [
        Paragraph(f"Roadmap: {_safe(roadmap.get('target_role'))}", title_style),
        Paragraph(_safe(roadmap.get("timeframe")), body),
        Spacer(1, 6),
    ]
    if roadmap.get("overview"):
        story.append(Paragraph(_safe(roadmap["overview"]), body))

    for i, phase in enumerate(roadmap.get("phases", []), start=1):
        story.append(Paragraph(f"Phase {i}: {_safe(phase.get('name'))}", heading_style))
        if phase.get("goal"):
            story.append(Paragraph(f"<i>{_safe(phase['goal'])}</i>", body))
        for topic in phase.get("topics", []):
            story.append(Paragraph(f"• {_safe(topic)}", body))
        if phase.get("resources"):
            story.append(Paragraph("<b>Resources:</b> " + ", ".join(_safe(r) for r in phase["resources"]), body))
        if phase.get("milestone"):
            story.append(Paragraph(f"<b>Milestone:</b> {_safe(phase['milestone'])}", body))

    if roadmap.get("weekly_checklist_tip"):
        story.append(Paragraph("Tip", heading_style))
        story.append(Paragraph(_safe(roadmap["weekly_checklist_tip"]), body))

    doc.build(story)
    return str(out_path)


def build_interview_report_pdf(report: dict, role: str, qna: list[dict]) -> str:
    from reportlab.platypus import Paragraph, Spacer

    doc, out_path = _doc("interview_report")
    title_style, heading_style, body = _styles()

    metrics = [
        ("Overall", report.get("overall_score")),
        ("Communication", report.get("communication_score")),
        ("Content depth", report.get("content_depth_score")),
        ("Structure (STAR)", report.get("structure_score")),
    ]

    story = [
        Paragraph(f"Mock Interview Report - {_safe(role)}", title_style),
        Paragraph(" | ".join(f"{label}: {val if val is not None else '-'}" for label, val in metrics), body),
        Spacer(1, 6),
    ]
    if report.get("summary"):
        story.append(Paragraph(_safe(report["summary"]), body))

    if report.get("strengths"):
        story.append(Paragraph("Strengths", heading_style))
        for s in report["strengths"]:
            story.append(Paragraph(f"• {_safe(s)}", body))

    if report.get("areas_to_improve"):
        story.append(Paragraph("Areas to improve", heading_style))
        for s in report["areas_to_improve"]:
            story.append(Paragraph(f"• {_safe(s)}", body))

    if report.get("filler_word_note"):
        story.append(Paragraph("Filler word usage", heading_style))
        story.append(Paragraph(_safe(report["filler_word_note"]), body))

    if qna:
        story.append(Paragraph("Full transcript", heading_style))
        for i, turn in enumerate(qna, start=1):
            story.append(Paragraph(f"<b>Q{i}: {_safe(turn.get('question'))}</b>", body))
            story.append(Paragraph(_safe(turn.get("answer")), body))
            if turn.get("feedback"):
                story.append(Paragraph(f"<i>Feedback: {_safe(turn['feedback'])}</i>", body))

    doc.build(story)
    return str(out_path)


def build_technical_stats_pdf(student_name: str, stats: dict) -> str:
    """A student's own DSA/quiz solve-rate breakdown as a printable PDF -
    something to bring to a placement drive or keep as a personal record,
    mirroring the resume/roadmap/interview-report export pattern."""
    import time as _time

    from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors
    from reportlab.lib.colors import HexColor

    doc, out_path = _doc("technical_stats")
    title_style, heading_style, body = _styles()

    overall = stats.get("overall", {})
    story = [
        Paragraph("Technical Interview - Solve Rate Report", title_style),
        Paragraph(f"{_safe(student_name)} - generated {_time.strftime('%d %b %Y')}", body),
        Spacer(1, 8),
        Paragraph(
            f"Overall solve rate: <b>{overall.get('solve_rate', 0)}%</b> "
            f"({overall.get('correct', 0)}/{overall.get('total', 0)} graded attempts)",
            body,
        ),
        Spacer(1, 6),
    ]

    def _table(section_title: str, rows: list[dict]) -> None:
        if not rows:
            return
        story.append(Paragraph(section_title, heading_style))
        data = [["Name", "Attempts", "Correct", "Solve rate"]]
        for r in rows:
            data.append([_safe(r.get("name")), str(r.get("total", 0)), str(r.get("correct", 0)), f"{r.get('solve_rate', 0)}%"])
        table = Table(data, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#0b1f3a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HexColor("#f1f5f9")]),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(table)
        story.append(Spacer(1, 8))

    _table("By topic", stats.get("by_topic", []))
    _table("By difficulty", stats.get("by_difficulty", []))
    _table("By round type", stats.get("by_round_type", []))

    if overall.get("total", 0) == 0:
        story.append(Paragraph("No graded attempts recorded yet.", body))

    doc.build(story)
    return str(out_path)


def build_cohort_report_pdf(department_name: str, counts: dict, students: list[dict]) -> str:
    """A one-page department readiness report a TPO can print or bring into
    a placement-drive planning meeting: department totals, then one row per
    student with their readiness signal."""
    import time as _time

    from reportlab.lib import colors
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

    doc, out_path = _doc("cohort_report")
    title_style, heading_style, body = _styles()

    readiness_color = {"green": HexColor("#15803d"), "amber": HexColor("#b45309"), "red": HexColor("#b91c1c")}
    readiness_label = {"green": "Ready", "amber": "In progress", "red": "Not started"}

    story = [
        Paragraph("Placement Readiness Report", title_style),
        Paragraph(f"{_safe(department_name)} - generated {_time.strftime('%d %b %Y')}", body),
        Spacer(1, 8),
        Paragraph(
            f"Chat sessions: {counts.get('chat_sessions', 0)}  |  "
            f"Resumes built: {counts.get('resumes_built', 0)}  |  "
            f"Roadmaps generated: {counts.get('roadmaps_generated', 0)}  |  "
            f"Mock interviews: {counts.get('mock_interviews', 0)}  |  "
            f"Technical rounds: {counts.get('technical_interviews', 0)}",
            body,
        ),
        Spacer(1, 10),
        Paragraph(
            "Readiness: green = has a resume, DSA/quiz solve rate ≥ 60%, and a mock interview scored ≥ 60. "
            "amber = some activity recorded. red = no activity yet.",
            body,
        ),
        Spacer(1, 6),
    ]

    header = ["Student", "Stream / specialization", "Sem", "Resumes", "DSA/Quiz solve rate", "Mock interviews", "Readiness"]
    rows = [header]
    for s in students:
        mock = s.get("mock", {})
        mock_txt = f"{mock.get('count', 0)} (avg {mock.get('avg_score')})" if mock.get("count") else "0"
        stream_spec = _safe(s.get("stream"))
        if s.get("specialization"):
            stream_spec = f"{stream_spec} · {_safe(s['specialization'])}" if stream_spec else _safe(s["specialization"])
        rows.append([
            _safe(s.get("name")),
            stream_spec,
            _safe(s.get("semester")),
            str(s.get("resumes_count", 0)),
            f"{s.get('technical', {}).get('solve_rate', 0)}%",
            mock_txt,
            readiness_label.get(s.get("readiness"), s.get("readiness", "")),
        ])

    table = Table(rows, repeatRows=1, hAlign="LEFT")
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#0b1f3a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HexColor("#f1f5f9")]),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    readiness_col = len(header) - 1
    for i, s in enumerate(students, start=1):
        color = readiness_color.get(s.get("readiness"))
        if color:
            style_cmds.append(("TEXTCOLOR", (readiness_col, i), (readiness_col, i), color))
    table.setStyle(TableStyle(style_cmds))
    story.append(table)

    if not students:
        story.append(Spacer(1, 6))
        story.append(Paragraph("No student activity recorded yet.", body))

    doc.build(story)
    return str(out_path)
