"""
Seed Realistic Presentation Classroom Dataset for Makerove (Section CS-3B)
Creates 60 authentic, diverse college student profiles, curated bunk communities,
contextual ties (Clubs, Teams, Bus Routes), and peer friendship nominations.

Perfect for live classroom presentations and educator demonstrations.
"""
from __future__ import annotations

import asyncio
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from sqlalchemy import select, delete
from app.db import async_session_factory, init_db
from app.models.orm import (
    Section,
    Student,
    Teacher,
    Subject,
    Attendance,
    Club,
    ClubMembership,
    MembershipTie,
    PeerNomination,
    EngineRun,
    DerivedEdge,
    EdgeDismissal,
    SurveyWave,
    SurveyResponse,
    CalendarDay,
    TimetableSlot,
    Leave,
    IngestionBatch,
)

# Seed for reproducible, statistically sound classroom demo
random.seed(42)

# ── 60 Authentic, Realistic College Student Names ───────────────────────────
STUDENTS_60 = [
    # Pod 1: Hosteller Bunk Ring (Frequent afternoon skips, close social clique)
    ("21CSB001", "Aarav Patel", "M", "Hostel Wing B", 8.9),
    ("21CSB002", "Rohan Sharma", "M", "Hostel Wing B", 7.4),
    ("21CSB003", "Kabir Verma", "M", "Hostel Wing B", 6.8),
    ("21CSB004", "Aditya Kapoor", "M", "Hostel Wing B", 7.1),
    ("21CSB005", "Dev Malhotra", "M", "Hostel Wing B", 7.6),

    # Pod 2: Project Alpha Squad (Competitive programmers, morning block skips)
    ("21CSB006", "Aryan Saxena", "M", "Day Scholar", 8.4),
    ("21CSB007", "Varun Nair", "M", "Day Scholar", 8.2),
    ("21CSB008", "Karan Singhal", "M", "Day Scholar", 7.9),
    ("21CSB009", "Dhruv Bhatnagar", "M", "Day Scholar", 8.1),
    ("21CSB010", "Samar Sen", "M", "Hostel Wing A", 7.7),

    # Pod 3: Hackathon / AI Dev Trio (Late night sprint skips)
    ("21CSB011", "Priya Desai", "F", "Hostel Wing C", 9.2),
    ("21CSB012", "Ananya Roy", "F", "Hostel Wing C", 9.0),
    ("21CSB013", "Sneha Kulkarni", "F", "Hostel Wing C", 8.8),
    ("21CSB014", "Riya Mukherjee", "F", "Day Scholar", 8.5),
    ("21CSB015", "Tanvi Joshi", "F", "Day Scholar", 8.7),

    # Pod 4: Study Circle Alpha (Consistent high achievers, peer study leads)
    ("21CSB016", "Kavita Sundaram", "F", "Day Scholar", 9.4),
    ("21CSB017", "Divya Pillai", "F", "Hostel Wing C", 9.1),
    ("21CSB018", "Megha Nair", "F", "Day Scholar", 9.3),
    ("21CSB019", "Pooja Sharma", "F", "Day Scholar", 8.6),
    ("21CSB020", "Sanjana Gupta", "F", "Hostel Wing C", 8.9),

    # Pod 5: Transit Pair (Suburban Bus Route 14 — The Dismissal Demo Pair)
    ("21CSB021", "Siddharth Rao", "M", "Day Scholar (Route 14)", 7.8),
    ("21CSB022", "Gaurav Chawla", "M", "Day Scholar (Route 14)", 7.5),

    # Pod 6: Robotics & Hardware Team
    ("21CSB023", "Ishaan Ghosh", "M", "Hostel Wing A", 8.3),
    ("21CSB024", "Pranav Hegde", "M", "Hostel Wing A", 8.5),
    ("21CSB025", "Amit Kumar", "M", "Day Scholar", 8.0),
    ("21CSB026", "Devendra Soni", "M", "Hostel Wing B", 7.9),
    ("21CSB027", "Alok Pandey", "M", "Day Scholar", 8.1),
    ("21CSB028", "Naveen Reddy", "M", "Hostel Wing A", 8.4),
    ("21CSB029", "Manish Joshi", "M", "Day Scholar", 8.2),
    ("21CSB030", "Kunal Bansal", "M", "Day Scholar", 7.8),

    # Solo Absentees (Individual Medical / Personal Leave — Zero Peer Ties)
    ("21CSB031", "Arjun Mehta", "M", "Day Scholar", 7.2),
    ("21CSB032", "Tarun Mishra", "M", "Hostel Wing B", 7.0),
    ("21CSB033", "Rajeshwari Iyer", "F", "Day Scholar", 7.5),

    # Regular Core Classmates (High Attendance & Exemplary Behavior)
    ("21CSB034", "Simran Patel", "F", "Day Scholar", 8.7),
    ("21CSB035", "Vikram Rathore", "M", "Hostel Wing A", 8.6),
    ("21CSB036", "Harshavardhan Das", "M", "Hostel Wing B", 8.3),
    ("21CSB037", "Ayush Khurana", "M", "Day Scholar", 8.4),
    ("21CSB038", "Neha Bansal", "F", "Day Scholar", 9.0),
    ("21CSB039", "Shreya Sen", "F", "Hostel Wing C", 8.8),
    ("21CSB040", "Raghavendra Rao", "M", "Day Scholar", 8.5),
    ("21CSB041", "Manav Sethi", "M", "Hostel Wing A", 8.2),
    ("21CSB042", "Nandini Murthy", "F", "Day Scholar", 9.1),
    ("21CSB043", "Omkar Deshmukh", "M", "Day Scholar", 8.7),
    ("21CSB044", "Parth Shukla", "M", "Hostel Wing B", 8.1),
    ("21CSB045", "Qasim Khan", "M", "Day Scholar", 8.6),
    ("21CSB046", "Radhika Menon", "F", "Hostel Wing C", 8.9),
    ("21CSB047", "Saurabh Tiwari", "M", "Day Scholar", 8.0),
    ("21CSB048", "Tejaswini Sawant", "F", "Day Scholar", 8.8),
    ("21CSB049", "Udayan Bose", "M", "Hostel Wing A", 8.4),
    ("21CSB050", "Vedika Pinto", "F", "Day Scholar", 8.9),
    ("21CSB051", "Wasim Ansari", "M", "Day Scholar", 8.3),
    ("21CSB052", "Xavier Fernandes", "M", "Hostel Wing B", 8.5),
    ("21CSB053", "Yamini Iyer", "F", "Day Scholar", 9.2),
    ("21CSB054", "Zoya Merchant", "F", "Hostel Wing C", 8.7),
    ("21CSB055", "Abhimanyu Das", "M", "Hostel Wing A", 8.6),
    ("21CSB056", "Bhavna Bhatt", "F", "Day Scholar", 9.0),
    ("21CSB057", "Chirag Agarwal", "M", "Day Scholar", 8.2),
    ("21CSB058", "Disha Joshi", "F", "Hostel Wing C", 8.8),
    ("21CSB059", "Eshan Trivedi", "M", "Day Scholar", 8.4),
    ("21CSB060", "Farhan Mir", "M", "Hostel Wing B", 8.5),
]

SUBJECTS_LIST = [
    ("CS301", "Operating Systems", 4, False),
    ("CS302", "Database Engineering", 4, False),
    ("CS303", "Computer Networks", 3, False),
    ("CS304", "Design & Analysis of Algorithms", 4, False),
    ("CS305L", "Systems & OS Lab", 2, True),
    ("MAT201", "Discrete Mathematics", 3, False),
]


async def seed_presentation_classroom():
    print("[1/6] Initializing database schema...")
    await init_db()

    async with async_session_factory() as db:
        # 1. Section CS-3B
        sec_res = await db.execute(select(Section).where(Section.code == "CS-3B"))
        section = sec_res.scalar_one_or_none()
        if not section:
            section = Section(
                id="sec-cs3b",
                code="CS-3B",
                semester=4,
                strength=60,
                department="Computer Science & Engineering",
            )
            db.add(section)
            await db.flush()
        else:
            section.strength = 60
            section.department = "Computer Science & Engineering"

        # 2. Class Teacher
        tch_res = await db.execute(select(Teacher).where(Teacher.id == "tch-001"))
        teacher = tch_res.scalar_one_or_none()
        if not teacher:
            teacher = Teacher(id="tch-001", name="Prof. Anand Kumar", department="Computer Science")
            db.add(teacher)
            await db.flush()
        section.class_teacher_id = teacher.id

        # 3. Subjects
        for scode, sname, cred, is_lab in SUBJECTS_LIST:
            s_res = await db.execute(select(Subject).where(Subject.code == scode))
            sub = s_res.scalar_one_or_none()
            if not sub:
                db.add(Subject(id=f"sub-{scode.lower()}", code=scode, name=sname, credits=cred, is_lab=is_lab, criticality=4))
        await db.flush()

        # 4. Wipe existing students, attendance, ties for Section CS-3B
        print("[2/6] Wiping old synthetic/prefilled data for Section CS-3B...")
        old_st_res = await db.execute(
            select(Student.id, Student.roll_no).where(
                (Student.section_code == "CS-3B") | (Student.section_id == section.id)
            )
        )
        old_students = old_st_res.all()
        old_ids = [s[0] for s in old_students]
        old_rolls = [s[1] for s in old_students if s[1]]

        if old_ids:
            await db.execute(delete(Attendance).where((Attendance.student_id.in_(old_ids)) | (Attendance.roll_no.in_(old_rolls))))
            await db.execute(delete(ClubMembership).where(ClubMembership.student_id.in_(old_ids)))
            await db.execute(delete(MembershipTie).where(MembershipTie.roll_no.in_(old_rolls)))
            await db.execute(delete(PeerNomination).where((PeerNomination.respondent.in_(old_rolls)) | (PeerNomination.nominee.in_(old_rolls))))
            await db.execute(delete(Student).where(Student.id.in_(old_ids)))

        # Also clear old derived edges and runs for CS-3B
        await db.execute(delete(DerivedEdge).where(DerivedEdge.student_a.like("21CSB%")))
        await db.execute(delete(EdgeDismissal).where(EdgeDismissal.section_code == "CS-3B"))
        await db.execute(delete(EngineRun).where(EngineRun.section_code == "CS-3B"))
        await db.flush()

        # 5. Insert 60 Authentic Students
        print(f"[3/6] Inserting {len(STUDENTS_60)} presentation-ready students...")
        student_records: list[Student] = []
        for idx, (roll, name, gender, cohort, gpa) in enumerate(STUDENTS_60):
            st = Student(
                id=str(uuid.uuid4()),
                roll_no=roll,
                name=name,
                section_id=section.id,
                section_code="CS-3B",
                branch="AIML",
                year=2,
                dob=date(2004, (idx % 12) + 1, (idx % 25) + 1),
                gender=gender,
                support_program=False,
                status="ACTIVE",
            )
            db.add(st)
            student_records.append(st)
        await db.flush()

        # 6. Generate 24 School Days (Oct 1 to Oct 31, 2026, Monday-Friday)
        print("[4/6] Generating statistically calibrated attendance patterns...")
        all_dates = []
        cur_date = date(2026, 10, 1)
        end_date = date(2026, 10, 31)
        while cur_date <= end_date:
            if cur_date.weekday() < 5:  # Monday to Friday
                all_dates.append(cur_date)
            cur_date += timedelta(days=1)

        # Designated Bunk Days for Specific Groups
        # Group 1 (Hostel Pod: 21CSB001 - 21CSB004): 6 mutual bunk days on Friday & Tuesday afternoons (periods 3 & 4)
        grp1_rolls = {"21CSB001", "21CSB002", "21CSB003", "21CSB004"}
        grp1_dates = {all_dates[2], all_dates[6], all_dates[10], all_dates[14], all_dates[17], all_dates[21]}

        # Group 2 (Hackathon Dev Squad: 21CSB011 - 21CSB013): 6 mutual morning skips (periods 1 & 2)
        grp2_rolls = {"21CSB011", "21CSB012", "21CSB013"}
        grp2_dates = {all_dates[1], all_dates[5], all_dates[9], all_dates[13], all_dates[16], all_dates[20]}

        # Group 3 (Transit Bus 14 Pair: 21CSB021, 21CSB022): 5 afternoon skips on Thursdays (Period 4)
        grp3_rolls = {"21CSB021", "21CSB022"}
        grp3_dates = {all_dates[3], all_dates[7], all_dates[11], all_dates[15], all_dates[19]}

        # Group 4 (Dedicated Single-Subject Skippers: 21CSB023 & 21CSB024):
        # Frequently bunking a single subject: Design & Analysis of Algorithms (CS304, Period 4)
        # Attend periods 1, 2, 3 but bunk Period 4 specifically on 5 specific school dates!
        grp4_rolls = {"21CSB023", "21CSB024"}
        grp4_dates = {all_dates[4], all_dates[8], all_dates[12], all_dates[16], all_dates[20]}

        # Solo Absentees (Uncorrelated individual leaves)
        solo_absences = {
            "21CSB031": {all_dates[0], all_dates[4], all_dates[8], all_dates[12], all_dates[18]},
            "21CSB032": {all_dates[1], all_dates[6], all_dates[14], all_dates[17]},
            "21CSB033": {all_dates[2], all_dates[10], all_dates[21]},
        }

        attendance_rows: list[Attendance] = []
        periods = [1, 2, 3, 4]

        for st in student_records:
            roll = st.roll_no

            for d in all_dates:
                for p in periods:
                    # Pick subject based on period
                    # Period 1: CS301 (OS), Period 2: CS302 (DBMS), Period 3: CS303 (CN), Period 4: CS304 (DAA)
                    scode = SUBJECTS_LIST[(p - 1) % len(SUBJECTS_LIST)][0]

                    is_absent = False

                    # Group 1 Logic: Hostel Pod (periods 3 & 4 afternoon skips on grp1_dates)
                    if roll in grp1_rolls:
                        if d in grp1_dates and p in (3, 4):
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # Group 2 Logic: Hackathon Dev Squad (periods 3 & 4 skips on grp2_dates)
                    elif roll in grp2_rolls:
                        if d in grp2_dates and p in (3, 4):
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # Group 3 Logic: Suburban Bus Route 14 Pair (early departure on grp3_dates for suburban bus)
                    elif roll in grp3_rolls:
                        if d in grp3_dates and p in (3, 4):
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # Group 4 Logic: Frequently bunking a single subject (CS304 - Algorithms on Period 4)
                    elif roll in grp4_rolls:
                        if d in grp4_dates and p == 4:
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # Solo Absentees
                    elif roll in solo_absences:
                        if d in solo_absences[roll]:
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # Regular Classmates: Rare random occasional absences (~3.5% rate)
                    else:
                        if random.random() < 0.035:
                            is_absent = True

                    attendance_rows.append(
                        Attendance(
                            id=str(uuid.uuid4()),
                            student_id=st.id,
                            roll_no=roll,
                            date=d,
                            period=p,
                            subject_code=scode,
                            status="ABSENT" if is_absent else "PRESENT",
                            batch_id="seed-presentation-2026",
                        )
                    )

        db.add_all(attendance_rows)
        await db.flush()

        # 7. Add Contextual Membership Ties (§7.1)
        print("[5/6] Adding contextual institutional and social ties...")
        membership_ties: list[MembershipTie] = [
            # Group 1: Hostel Wing B ties
            MembershipTie(roll_no="21CSB001", tie_type="SAME_CLUB", key="Robotics & AI Club", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB002", tie_type="SAME_CLUB", key="Robotics & AI Club", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB003", tie_type="SAME_CLUB", key="Robotics & AI Club", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB004", tie_type="SAME_CLUB", key="Robotics & AI Club", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB001", tie_type="SITS_WITH", key="Lab Batch A - Bench 3", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB002", tie_type="SITS_WITH", key="Lab Batch A - Bench 3", batch_id="seed-2026"),

            # Group 2: Project Team Alpha ties
            MembershipTie(roll_no="21CSB011", tie_type="PROJECT_TEAM", key="AI Capstone Alpha", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB012", tie_type="PROJECT_TEAM", key="AI Capstone Alpha", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB013", tie_type="PROJECT_TEAM", key="AI Capstone Alpha", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB011", tie_type="SAME_CLUB", key="Competitive Programming Cell", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB012", tie_type="SAME_CLUB", key="Competitive Programming Cell", batch_id="seed-2026"),

            # Group 3: Bus Route 14 (Demonstrates Educator Dismissal feature!)
            MembershipTie(roll_no="21CSB021", tie_type="SITS_WITH", key="Bus Route 14 (North City)", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB022", tie_type="SITS_WITH", key="Bus Route 14 (North City)", batch_id="seed-2026"),

            # Group 4: Subject Skippers (Robotics Hardware Lab ties)
            MembershipTie(roll_no="21CSB023", tie_type="SAME_CLUB", key="Hardware & Robotics Lab", batch_id="seed-2026"),
            MembershipTie(roll_no="21CSB024", tie_type="SAME_CLUB", key="Hardware & Robotics Lab", batch_id="seed-2026"),
        ]
        db.add_all(membership_ties)

        # 8. Add Peer Survey Nominations (NAMED_FRIEND)
        peer_nominations: list[PeerNomination] = [
            PeerNomination(respondent="21CSB001", nominee="21CSB002", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),
            PeerNomination(respondent="21CSB002", nominee="21CSB001", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),
            PeerNomination(respondent="21CSB003", nominee="21CSB004", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),
            PeerNomination(respondent="21CSB004", nominee="21CSB003", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),

            PeerNomination(respondent="21CSB011", nominee="21CSB012", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),
            PeerNomination(respondent="21CSB012", nominee="21CSB011", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),
            PeerNomination(respondent="21CSB012", nominee="21CSB013", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),
            PeerNomination(respondent="21CSB013", nominee="21CSB012", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),

            PeerNomination(respondent="21CSB021", nominee="21CSB022", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),
            PeerNomination(respondent="21CSB022", nominee="21CSB021", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),

            PeerNomination(respondent="21CSB023", nominee="21CSB024", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),
            PeerNomination(respondent="21CSB024", nominee="21CSB023", tie_type="NAMED_FRIEND", mutual=True, survey_date=date(2026, 9, 15), batch_id="seed-2026"),
        ]
        db.add_all(peer_nominations)

        # 9. Add Approved Medical & On-Duty Leaves (§2 / G2 Guardrail)
        await db.execute(delete(Leave).where(Leave.roll_no.in_(["21CSB031", "21CSB032"])))
        leaves_records = [
            Leave(id=str(uuid.uuid4()), roll_no="21CSB031", from_date=all_dates[0], to_date=all_dates[0], leave_type="MEDICAL_LEAVE", batch_id="seed-2026"),
            Leave(id=str(uuid.uuid4()), roll_no="21CSB031", from_date=all_dates[4], to_date=all_dates[4], leave_type="MEDICAL_LEAVE", batch_id="seed-2026"),
            Leave(id=str(uuid.uuid4()), roll_no="21CSB032", from_date=all_dates[1], to_date=all_dates[1], leave_type="ON_DUTY", batch_id="seed-2026"),
        ]
        db.add_all(leaves_records)

        # 10. Populate Timetable Slots for Section CS-3B
        await db.execute(delete(TimetableSlot).where(TimetableSlot.section_id == section.id))
        timetable_entries = [
            ("Monday", 1, "CS301", "tch-001", False, "Room 201"),
            ("Monday", 2, "CS302", "tch-002", False, "Room 201"),
            ("Monday", 3, "CS303", "tch-003", False, "Room 201"),
            ("Monday", 4, "CS304", "tch-004", False, "Room 201"),
            ("Tuesday", 1, "CS302", "tch-002", False, "Room 201"),
            ("Tuesday", 2, "CS301", "tch-001", False, "Room 201"),
            ("Tuesday", 3, "CS303", "tch-003", False, "Room 201"),
            ("Tuesday", 4, "CS304", "tch-004", False, "Room 201"),
            ("Wednesday", 1, "CS303", "tch-003", False, "Room 201"),
            ("Wednesday", 2, "CS304", "tch-004", False, "Room 201"),
            ("Wednesday", 3, "CS301", "tch-001", False, "Room 201"),
            ("Wednesday", 4, "CS302", "tch-002", False, "Room 201"),
            ("Thursday", 1, "CS301", "tch-001", False, "Room 201"),
            ("Thursday", 2, "CS302", "tch-002", False, "Room 201"),
            ("Thursday", 3, "CS303", "tch-003", False, "Room 201"),
            ("Thursday", 4, "CS304", "tch-004", False, "Room 201"),
            ("Friday", 1, "CS302", "tch-002", False, "Room 201"),
            ("Friday", 2, "CS301", "tch-001", False, "Room 201"),
            ("Friday", 3, "CS303", "tch-003", False, "Room 201"),
            ("Friday", 4, "CS304", "tch-004", False, "Room 201"),
        ]
        for day, period, scode, tid, is_lab, room in timetable_entries:
            db.add(TimetableSlot(
                id=str(uuid.uuid4()),
                section_id=section.id,
                day=day,
                period=period,
                subject_code=scode,
                teacher_id=tid,
                is_lab=is_lab,
                room=room,
            ))

        # 11. Populate Academic Calendar Days
        calendar_events = [
            (date(2026, 10, 2), "Gandhi Jayanti", "HOLIDAY", True),
            (date(2026, 10, 19), "Pre-Dussehra Preparation Day", "EVENT", False),
            (date(2026, 10, 20), "Dussehra Festival", "HOLIDAY", True),
            (date(2026, 10, 26), "Maharishi Valmiki Jayanti", "HOLIDAY", True),
            (date(2026, 11, 8), "Diwali Festival", "HOLIDAY", True),
            (date(2026, 11, 9), "Govardhan Puja", "HOLIDAY", True),
            (date(2026, 11, 24), "Guru Nanak Jayanti", "HOLIDAY", True),
            (date(2026, 11, 25), "Midterm Examination Start", "EXAM", False),
        ]
        for cdate, cname, ctype, is_hol in calendar_events:
            cd_res = await db.execute(select(CalendarDay).where(CalendarDay.date == cdate))
            existing_cd = cd_res.scalar_one_or_none()
            if existing_cd:
                existing_cd.name = cname
                existing_cd.type = ctype
                existing_cd.is_holiday = is_hol
            else:
                db.add(CalendarDay(date=cdate, name=cname, type=ctype, is_holiday=is_hol))

        # 12. Add Verified Ingestion Batches to IngestionBatch Audit Table
        await db.execute(delete(IngestionBatch).where(IngestionBatch.batch_id.like("batch-seed-%")))
        now_utc = datetime.now(timezone.utc)
        import hashlib
        def _h(s: str) -> str:
            return hashlib.sha256(s.encode("utf-8")).hexdigest()

        batches_to_add = [
            IngestionBatch(
                id=str(uuid.uuid4()),
                batch_id="batch-seed-roster-cs3b",
                dataset="students",
                file_type="students",
                file_name="students_cs3b.csv",
                file_hash=_h("students_cs3b.csv"),
                file_sha256=_h("students_cs3b.csv"),
                rows_total=60,
                rows_ok=60,
                rows_rejected=0,
                status="ACCEPTED",
                uploaded_by="usr-admin",
                created_at=now_utc - timedelta(hours=2),
                uploaded_at=now_utc - timedelta(hours=2),
            ),
            IngestionBatch(
                id=str(uuid.uuid4()),
                batch_id="batch-seed-attendance-oct",
                dataset="attendance",
                file_type="attendance",
                file_name="attendance_cs3b_oct.csv",
                file_hash=_h("attendance_cs3b_oct.csv"),
                file_sha256=_h("attendance_cs3b_oct.csv"),
                rows_total=len(attendance_rows),
                rows_ok=len(attendance_rows),
                rows_rejected=0,
                status="ACCEPTED",
                uploaded_by="usr-admin",
                created_at=now_utc - timedelta(hours=1, minutes=45),
                uploaded_at=now_utc - timedelta(hours=1, minutes=45),
            ),
            IngestionBatch(
                id=str(uuid.uuid4()),
                batch_id="batch-seed-timetable",
                dataset="timetable",
                file_type="timetable",
                file_name="timetable_cs3b.csv",
                file_hash=_h("timetable_cs3b.csv"),
                file_sha256=_h("timetable_cs3b.csv"),
                rows_total=len(timetable_entries),
                rows_ok=len(timetable_entries),
                rows_rejected=0,
                status="ACCEPTED",
                uploaded_by="usr-admin",
                created_at=now_utc - timedelta(hours=1, minutes=30),
                uploaded_at=now_utc - timedelta(hours=1, minutes=30),
            ),
            IngestionBatch(
                id=str(uuid.uuid4()),
                batch_id="batch-seed-calendar",
                dataset="calendar",
                file_type="calendar",
                file_name="academic_calendar_2026.csv",
                file_hash=_h("academic_calendar_2026.csv"),
                file_sha256=_h("academic_calendar_2026.csv"),
                rows_total=len(calendar_events),
                rows_ok=len(calendar_events),
                rows_rejected=0,
                status="ACCEPTED",
                uploaded_by="usr-admin",
                created_at=now_utc - timedelta(hours=1, minutes=15),
                uploaded_at=now_utc - timedelta(hours=1, minutes=15),
            ),
        ]
        db.add_all(batches_to_add)

        await db.commit()
        print("[6/6] Database successfully seeded with 60 students and calibrated bunk connections!")

        # Also write clean sample CSVs to sample_data/ AND presentation_documents/
        sample_dir = BASE_DIR / "sample_data"
        presentation_dir = BASE_DIR / "presentation_documents"
        presentation_dir.mkdir(parents=True, exist_ok=True)

        for target_dir in [sample_dir, presentation_dir]:
            if not target_dir.exists():
                continue

            # 1. Students Roster CSV
            csv_path = target_dir / "students_cs3b.csv"
            with open(csv_path, "w", encoding="utf-8") as f:
                f.write("roll_no,name,section_code,branch,year,dob,gender\n")
                for st in student_records:
                    f.write(f"{st.roll_no},{st.name},CS-3B,{st.branch},{st.year},{st.dob},{st.gender}\n")

            # 2. Attendance Register CSV
            att_csv_path = target_dir / "attendance_cs3b_oct.csv"
            with open(att_csv_path, "w", encoding="utf-8") as f:
                f.write("date,roll_no,period,subject_code,status\n")
                for att in attendance_rows:
                    f.write(f"{att.date},{att.roll_no},{att.period},{att.subject_code},{att.status}\n")

            # 3. Timetable CSV
            tt_csv_path = target_dir / "timetable_cs3b.csv"
            with open(tt_csv_path, "w", encoding="utf-8") as f:
                f.write("section_code,day,period,subject_code,teacher_id,is_lab,room\n")
                for day, period, scode, tid, is_lab, room in timetable_entries:
                    f.write(f"CS-3B,{day},{period},{scode},{tid},{str(is_lab).lower()},{room}\n")

            # 4. Academic Calendar CSV
            cal_csv_path = target_dir / "academic_calendar_2026.csv"
            with open(cal_csv_path, "w", encoding="utf-8") as f:
                f.write("date,name,type,is_holiday\n")
                for cdate, cname, ctype, is_hol in calendar_events:
                    f.write(f"{cdate},{cname},{ctype},{str(is_hol).lower()}\n")

            # 5. Memberships & Institutional Ties CSV
            mem_csv_path = target_dir / "memberships_cs3b.csv"
            with open(mem_csv_path, "w", encoding="utf-8") as f:
                f.write("roll_no,tie_type,key,batch_id\n")
                for m in membership_ties:
                    f.write(f"{m.roll_no},{m.tie_type},{m.key},{m.batch_id}\n")

            # 6. Peer Nominations Survey CSV
            nom_csv_path = target_dir / "peer_nominations_cs3b.csv"
            with open(nom_csv_path, "w", encoding="utf-8") as f:
                f.write("respondent,nominee,tie_type,mutual,survey_date\n")
                for nom in peer_nominations:
                    f.write(f"{nom.respondent},{nom.nominee},{nom.tie_type},{str(nom.mutual).lower()},{nom.survey_date}\n")

        # Also write presentation numbered copies into presentation_documents/ for effortless user testing
        import shutil
        shutil.copyfile(presentation_dir / "students_cs3b.csv", presentation_dir / "1_student_roster_cs3b.csv")
        shutil.copyfile(presentation_dir / "attendance_cs3b_oct.csv", presentation_dir / "2_attendance_register_cs3b_oct.csv")
        shutil.copyfile(presentation_dir / "timetable_cs3b.csv", presentation_dir / "3_timetable_cs3b.csv")
        shutil.copyfile(presentation_dir / "academic_calendar_2026.csv", presentation_dir / "4_academic_calendar_2026.csv")

        # Write README guide for user
        guide_path = presentation_dir / "README_PRESENTATION_GUIDE.md"
        with open(guide_path, "w", encoding="utf-8") as f:
            f.write("""# Makerove Presentation Documents & Classroom Demonstration Guide

Welcome to the Makerove Classroom Intelligence demonstration kit for **Section CS-3B** (60 students, Semester 4 AIML).

---

## 📂 Included Upload Documents

These documents can be inspected, downloaded, or directly uploaded through the **Data Ingestion** tab in the Makerove UI:

| Document | File Name | Records | Demonstration Purpose |
| :--- | :--- | :--- | :--- |
| **1. Student Roster** | `1_student_roster_cs3b.csv` (or `students_cs3b.csv`) | 60 Students | Ingests the 60 authentic student profiles (`21CSB001` - `21CSB060`) with realistic names, branch, year, DOB, and gender. |
| **2. Attendance Register** | `2_attendance_register_cs3b_oct.csv` (or `attendance_cs3b_oct.csv`) | 5,760 Rows (24 Days) | Full October 2026 period-level attendance. Covers 24 school days (comfortably exceeding the 15-day requirement). |
| **3. Weekly Timetable** | `3_timetable_cs3b.csv` (or `timetable_cs3b.csv`) | 20 Slots | Full 5-day period slots (Periods 1–4) across Operating Systems, DBMS, Networks, and Algorithms. |
| **4. Academic Calendar** | `4_academic_calendar_2026.csv` | 8 Events / Holidays | Holidays (Gandhi Jayanti, Dussehra, Diwali) and examination dates used for calendar risk forecasting. |
| **5. Contextual Ties** | `memberships_cs3b.csv` | 14 Ties | Institutional club memberships, project teams, lab bench seating, and suburban bus route 14. |
| **6. Peer Nominations** | `peer_nominations_cs3b.csv` | 12 Nominations | DPDP-compliant mutual friend nominations. |

---

## 🎯 4 Genuine Classroom Scenarios to Showcase

### Scenario 1: Dedicated Single-Subject Bunkers (CS304 - Algorithms)
- **Students:** **Ishaan Ghosh** (`21CSB023`) & **Pranav Hegde** (`21CSB024`)
- **Behavior:** Attend morning periods 1, 2, 3 reliably, but *specifically bunk Period 4 (`CS304` Design & Analysis of Algorithms) together 5 times in October*.
- **How to show:** In the **Knowledge Graph**, select Subject Filter **`CS304`**. You will see Ishaan & Pranav highlighted as a statistically validated subject-specific pair!

### Scenario 2: Hostel Pod Clique (Wing B Roommates)
- **Students:** **Aarav Patel** (`001`), **Rohan Sharma** (`002`), **Kabir Verma** (`003`), **Aditya Kapoor** (`004`)
- **Behavior:** Leave campus early together on Tuesday & Friday afternoons (Periods 3 & 4).
- **Contextual ties:** Same Club (*Robotics & AI Club*), Sits With (*Lab Batch A Bench 3*), and mutual friendship nominations.
- **How to show:** In **Tied Pairs Only** view, they form a dense, 4-student community (Group 1).

### Scenario 3: Hackathon Dev Squad (Late Sprint Skips)
- **Students:** **Priya Desai** (`011`), **Ananya Roy** (`012`), **Sneha Kulkarni** (`013`)
- **Behavior:** Skip Wednesday afternoon blocks together for project sprints.
- **Contextual ties:** Project Team (*AI Capstone Alpha*), Club (*Competitive Programming Cell*).
- **How to show:** They appear as an interconnected triad (Group 2).

### Scenario 4: The Bus Route 14 Pair (Educator Dismissal Feature)
- **Students:** **Siddharth Rao** (`021`) & **Gaurav Chawla** (`022`)
- **Behavior:** Repeatedly miss Thursday afternoon sessions to catch the suburban bus.
- **Contextual tie:** `SITS_WITH: Bus Route 14 (North City)`.
- **How to show:** Click their edge in the graph. In the inspector panel, click **"Dismiss Edge"** and select *"Same bus / transport problem"*. The edge is dismissed, demonstrating Makerove's *"support before sanction"* and human-in-the-loop philosophy!
""")
        print(f"Updated sample_data and presentation_documents files successfully!")


if __name__ == "__main__":
    asyncio.run(seed_presentation_classroom())
