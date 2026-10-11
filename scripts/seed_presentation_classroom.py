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

        # Group 3 (Transit Bus 14 Pair: 21CSB021, 21CSB022): 5 rainy / traffic morning skips (periods 1 & 2)
        grp3_rolls = {"21CSB021", "21CSB022"}
        grp3_dates = {all_dates[3], all_dates[7], all_dates[11], all_dates[15], all_dates[19]}

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
                    scode = SUBJECTS_LIST[(p - 1) % len(SUBJECTS_LIST)][0]

                    is_absent = False

                    # Group 1 Logic: High joint probability on grp1_dates during periods 3 & 4
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

                    # Group 3 Logic: Suburban Bus Route 14 Pair (periods 3 & 4 early departure on grp3_dates)
                    elif roll in grp3_rolls:
                        if d in grp3_dates and p in (3, 4):
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # Solo Absentees
                    elif roll in solo_absences:
                        if d in solo_absences[roll]:
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # Regular Classmates: Rare random occasional absences (~4% rate)
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
        ]
        db.add_all(peer_nominations)

        await db.commit()
        print("[6/6] Database successfully seeded with 60 students and calibrated bunk connections!")

        # Also write clean sample CSVs to sample_data/ for reference and documentation
        sample_dir = BASE_DIR / "sample_data"
        if sample_dir.exists():
            csv_path = sample_dir / "students_cs3b.csv"
            with open(csv_path, "w", encoding="utf-8") as f:
                f.write("roll_no,name,section_code,branch,year,dob,gender\n")
                for st in student_records:
                    f.write(f"{st.roll_no},{st.name},CS-3B,{st.branch},{st.year},{st.dob},{st.gender}\n")
            print(f"Updated sample_data CSV: {csv_path}")

            att_csv_path = sample_dir / "attendance_cs3b_oct.csv"
            with open(att_csv_path, "w", encoding="utf-8") as f:
                f.write("date,roll_no,period,subject_code,status\n")
                for att in attendance_rows:
                    f.write(f"{att.date},{att.roll_no},{att.period},{att.subject_code},{att.status}\n")
            print(f"Updated sample_data CSV: {att_csv_path}")


if __name__ == "__main__":
    asyncio.run(seed_presentation_classroom())
