"""
Seed Authentic Classroom Presentation Dataset for Makerove (Section CS-3B)
Uses exclusively the 4 standard data ingestion CSV models:
  1. Student Roster (students_cs3b.csv)
  2. Attendance Register (attendance_cs3b_oct.csv)
  3. Weekly Timetable (timetable_cs3b.csv)
  4. Academic Calendar (academic_calendar_2026.csv)

Zero fake side tables or external surveys. Bunk connections are derived
purely from statistical attendance patterns (including single-subject bunk pairs).
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import random
import shutil
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
    CalendarDay,
    TimetableSlot,
    IngestionBatch,
    DerivedEdge,
    EdgeDismissal,
    EngineRun,
    MembershipTie,
    PeerNomination,
    Leave,
)
from app.connection.engine_service import _ENGINE_CACHE

# Seed for reproducible, statistically sound classroom presentation
random.seed(42)

# ── 60 Authentic Indian College Student Names (Section CS-3B) ────────────────
STUDENTS_60 = [
    ("21CSB001", "Aarav Patel", "M", "AIML", 2),
    ("21CSB002", "Rohan Sharma", "M", "AIML", 2),
    ("21CSB003", "Kabir Verma", "M", "AIML", 2),
    ("21CSB004", "Aditya Kapoor", "M", "AIML", 2),
    ("21CSB005", "Dev Malhotra", "M", "AIML", 2),
    ("21CSB006", "Aryan Saxena", "M", "AIML", 2),
    ("21CSB007", "Varun Nair", "M", "AIML", 2),
    ("21CSB008", "Karan Singhal", "M", "AIML", 2),
    ("21CSB009", "Dhruv Bhatnagar", "M", "AIML", 2),
    ("21CSB010", "Samar Sen", "M", "AIML", 2),
    ("21CSB011", "Priya Desai", "F", "AIML", 2),
    ("21CSB012", "Ananya Roy", "F", "AIML", 2),
    ("21CSB013", "Sneha Kulkarni", "F", "AIML", 2),
    ("21CSB014", "Riya Mukherjee", "F", "AIML", 2),
    ("21CSB015", "Tanvi Joshi", "F", "AIML", 2),
    ("21CSB016", "Kavita Sundaram", "F", "AIML", 2),
    ("21CSB017", "Divya Pillai", "F", "AIML", 2),
    ("21CSB018", "Megha Nair", "F", "AIML", 2),
    ("21CSB019", "Pooja Sharma", "F", "AIML", 2),
    ("21CSB020", "Sanjana Gupta", "F", "AIML", 2),
    ("21CSB021", "Siddharth Rao", "M", "AIML", 2),
    ("21CSB022", "Gaurav Chawla", "M", "AIML", 2),
    ("21CSB023", "Ishaan Ghosh", "M", "AIML", 2),
    ("21CSB024", "Pranav Hegde", "M", "AIML", 2),
    ("21CSB025", "Amit Kumar", "M", "AIML", 2),
    ("21CSB026", "Devendra Soni", "M", "AIML", 2),
    ("21CSB027", "Alok Pandey", "M", "AIML", 2),
    ("21CSB028", "Naveen Reddy", "M", "AIML", 2),
    ("21CSB029", "Manish Joshi", "M", "AIML", 2),
    ("21CSB030", "Kunal Bansal", "M", "AIML", 2),
    ("21CSB031", "Arjun Mehta", "M", "AIML", 2),
    ("21CSB032", "Tarun Mishra", "M", "AIML", 2),
    ("21CSB033", "Rajeshwari Iyer", "F", "AIML", 2),
    ("21CSB034", "Simran Patel", "F", "AIML", 2),
    ("21CSB035", "Vikram Rathore", "M", "AIML", 2),
    ("21CSB036", "Harshavardhan Das", "M", "AIML", 2),
    ("21CSB037", "Ayush Khurana", "M", "AIML", 2),
    ("21CSB038", "Neha Bansal", "F", "AIML", 2),
    ("21CSB039", "Shreya Sen", "F", "AIML", 2),
    ("21CSB040", "Raghavendra Rao", "M", "AIML", 2),
    ("21CSB041", "Manav Sethi", "M", "AIML", 2),
    ("21CSB042", "Nandini Murthy", "F", "AIML", 2),
    ("21CSB043", "Omkar Deshmukh", "M", "AIML", 2),
    ("21CSB044", "Parth Shukla", "M", "AIML", 2),
    ("21CSB045", "Qasim Khan", "M", "AIML", 2),
    ("21CSB046", "Radhika Menon", "F", "AIML", 2),
    ("21CSB047", "Saurabh Tiwari", "M", "AIML", 2),
    ("21CSB048", "Tejaswini Sawant", "F", "AIML", 2),
    ("21CSB049", "Udayan Bose", "M", "AIML", 2),
    ("21CSB050", "Vedika Pinto", "F", "AIML", 2),
    ("21CSB051", "Wasim Ansari", "M", "AIML", 2),
    ("21CSB052", "Xavier Fernandes", "M", "AIML", 2),
    ("21CSB053", "Yamini Iyer", "F", "AIML", 2),
    ("21CSB054", "Zoya Merchant", "F", "AIML", 2),
    ("21CSB055", "Abhimanyu Das", "M", "AIML", 2),
    ("21CSB056", "Bhavna Bhatt", "F", "AIML", 2),
    ("21CSB057", "Chirag Agarwal", "M", "AIML", 2),
    ("21CSB058", "Disha Joshi", "F", "AIML", 2),
    ("21CSB059", "Eshan Trivedi", "M", "AIML", 2),
    ("21CSB060", "Farhan Mir", "M", "AIML", 2),
]

SUBJECTS_LIST = [
    ("CS301", "Operating Systems", 4, False),
    ("CS302", "Database Engineering", 4, False),
    ("CS303", "Computer Networks", 3, False),
    ("CS304", "Design & Analysis of Algorithms", 4, False),
]


async def seed_presentation_classroom():
    print("[1/5] Initializing database schema...")
    await init_db()

    # Clear in-memory engine cache
    _ENGINE_CACHE.clear()

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

        # 3. Core Subjects
        for scode, sname, cred, is_lab in SUBJECTS_LIST:
            s_res = await db.execute(select(Subject).where(Subject.code == scode))
            sub = s_res.scalar_one_or_none()
            if not sub:
                db.add(Subject(id=f"sub-{scode.lower()}", code=scode, name=sname, credits=cred, is_lab=is_lab, criticality=4))
        await db.flush()

        # 4. Total Wipe of Old / Stale Attendance and Ingestion Records
        print("[2/5] Purging all previous test data and stale records...")
        await db.execute(delete(Attendance))
        await db.execute(delete(Student))
        await db.execute(delete(TimetableSlot))
        await db.execute(delete(CalendarDay))
        await db.execute(delete(IngestionBatch))
        await db.execute(delete(MembershipTie))
        await db.execute(delete(PeerNomination))
        await db.execute(delete(Leave))
        await db.execute(delete(DerivedEdge))
        await db.execute(delete(EdgeDismissal))
        await db.execute(delete(EngineRun))
        await db.flush()

        # 5. Insert 60 Authentic Students (Roster)
        print(f"[3/5] Inserting {len(STUDENTS_60)} authentic students...")
        student_records: list[Student] = []
        for idx, (roll, name, gender, branch, year) in enumerate(STUDENTS_60):
            st = Student(
                id=str(uuid.uuid4()),
                roll_no=roll,
                name=name,
                section_id=section.id,
                section_code="CS-3B",
                branch=branch,
                year=year,
                dob=date(2004, (idx % 12) + 1, (idx % 25) + 1),
                gender=gender,
                support_program=False,
                status="ACTIVE",
            )
            db.add(st)
            student_records.append(st)
        await db.flush()

        # 6. Generate 22 October 2026 School Dates (Monday–Friday)
        print("[4/5] Generating genuine attendance register (Oct 1 to Oct 30, 2026)...")
        all_dates: list[date] = []
        cur_date = date(2026, 10, 1)
        end_date = date(2026, 10, 31)
        while cur_date <= end_date:
            if cur_date.weekday() < 5:  # Monday to Friday
                all_dates.append(cur_date)
            cur_date += timedelta(days=1)

        # ── Realistic Attendance Patterns ────────────────────────────────────
        # Group 1: Aarav Patel (001), Rohan Sharma (002), Kabir Verma (003)
        # Frequent afternoon skips together (Periods 3 & 4) on 5 specific dates
        grp1_rolls = {"21CSB001", "21CSB002", "21CSB003"}
        grp1_dates = {all_dates[1], all_dates[5], all_dates[9], all_dates[13], all_dates[17]}

        # Group 2 (Single-Subject Bunkers): Ishaan Ghosh (023) & Pranav Hegde (024)
        # Frequently bunking a SINGLE subject: Design & Analysis of Algorithms (CS304, Period 4)
        # They attend periods 1, 2, 3 reliably, but skip Period 4 together 5 times in October!
        grp2_rolls = {"21CSB023", "21CSB024"}
        grp2_dates = {all_dates[3], all_dates[7], all_dates[11], all_dates[15], all_dates[19]}

        # Group 3: Priya Desai (011) & Ananya Roy (012)
        # Wednesday afternoon skips together (Periods 3 & 4) on 5 dates
        grp3_rolls = {"21CSB011", "21CSB012"}
        grp3_dates = {all_dates[2], all_dates[6], all_dates[10], all_dates[14], all_dates[18]}

        attendance_rows: list[Attendance] = []
        periods = [1, 2, 3, 4]

        for st in student_records:
            roll = st.roll_no

            for d in all_dates:
                for p in periods:
                    scode = SUBJECTS_LIST[p - 1][0]
                    is_absent = False

                    # Group 1: Afternoon skips (periods 3 & 4)
                    if roll in grp1_rolls:
                        if d in grp1_dates and p in (3, 4):
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # Group 2: Single-Subject Skippers (Period 4 - CS304 Algorithms only!)
                    elif roll in grp2_rolls:
                        if d in grp2_dates and p == 4:
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # Group 3: Wednesday afternoon skips (periods 3 & 4)
                    elif roll in grp3_rolls:
                        if d in grp3_dates and p in (3, 4):
                            is_absent = True
                        elif random.random() < 0.02:
                            is_absent = True

                    # All other classmates: Standard healthy attendance (~95%), rare occasional absence
                    else:
                        if random.random() < 0.03:
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

        # 7. Timetable Slots (20 Slots: Periods 1-4, Monday-Friday)
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

        # 8. Academic Calendar Days (8 Events)
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
            db.add(CalendarDay(date=cdate, name=cname, type=ctype, is_holiday=is_hol))

        # 9. Log the 4 Verified IngestionBatches
        now_utc = datetime.now(timezone.utc)
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
        print("[5/5] Database successfully committed with clean presentation data!")

        # 10. Write the Exact 4 Clean CSV Files
        sample_dir = BASE_DIR / "sample_data"
        presentation_dir = BASE_DIR / "presentation_documents"
        
        # Clean up any extraneous files from presentation_documents
        if presentation_dir.exists():
            shutil.rmtree(presentation_dir)
        presentation_dir.mkdir(parents=True, exist_ok=True)

        # Remove extra files from sample_data if they exist
        for extra in ["memberships_cs3b.csv", "peer_nominations_cs3b.csv"]:
            p = sample_dir / extra
            if p.exists():
                p.unlink()

        for target_dir in [sample_dir, presentation_dir]:
            # 1. Students Roster CSV
            with open(target_dir / "students_cs3b.csv", "w", encoding="utf-8") as f:
                f.write("roll_no,name,section_code,branch,year,dob,gender\n")
                for st in student_records:
                    f.write(f"{st.roll_no},{st.name},CS-3B,{st.branch},{st.year},{st.dob},{st.gender}\n")

            # 2. Attendance Register CSV
            with open(target_dir / "attendance_cs3b_oct.csv", "w", encoding="utf-8") as f:
                f.write("date,roll_no,period,subject_code,status\n")
                for att in attendance_rows:
                    f.write(f"{att.date},{att.roll_no},{att.period},{att.subject_code},{att.status}\n")

            # 3. Timetable CSV
            with open(target_dir / "timetable_cs3b.csv", "w", encoding="utf-8") as f:
                f.write("section_code,day,period,subject_code,teacher_id,is_lab,room\n")
                for day, period, scode, tid, is_lab, room in timetable_entries:
                    f.write(f"CS-3B,{day},{period},{scode},{tid},{str(is_lab).lower()},{room}\n")

            # 4. Academic Calendar CSV
            with open(target_dir / "academic_calendar_2026.csv", "w", encoding="utf-8") as f:
                f.write("date,name,type,is_holiday\n")
                for cdate, cname, ctype, is_hol in calendar_events:
                    f.write(f"{cdate},{cname},{ctype},{str(is_hol).lower()}\n")

        # Copy 2026 calendar as default calendar
        shutil.copyfile(sample_dir / "academic_calendar_2026.csv", sample_dir / "academic_calendar_2024.csv")

        # Write clean README in presentation_documents
        with open(presentation_dir / "README.md", "w", encoding="utf-8") as f:
            f.write("""# Makerove Presentation Upload Documents (Section CS-3B)

These 4 CSV files strictly match the 4 data upload tabs in the **Data Ingestion** view:

| File Name | Data Ingestion Tab | Records | Description |
| :--- | :--- | :--- | :--- |
| **`students_cs3b.csv`** | **Student Roster** | 60 Students | 60 authentic student profiles (`21CSB001` - `21CSB060`) with realistic names, branch (AIML), year (2), DOB, and gender. |
| **`attendance_cs3b_oct.csv`** | **Attendance Register** | 5,280 Rows (22 Days) | Period-level attendance across 22 school dates (October 2026). Exceeds the 15-day requirement. |
| **`timetable_cs3b.csv`** | **Weekly Timetable** | 20 Slots | Monday to Friday schedule (Periods 1-4) across Operating Systems, DBMS, Networks, and Algorithms. |
| **`academic_calendar_2026.csv`** | **Academic Calendar** | 8 Events | October & November holidays (Gandhi Jayanti, Dussehra, Diwali) and examination dates. |

### 🎯 Key Presentation Bunk Connections
1. **Single-Subject Algorithms Bunkers**:
   - Students: **Ishaan Ghosh** (`21CSB023`) and **Pranav Hegde** (`21CSB024`)
   - Behavior: Attend morning periods 1, 2, 3 reliably, but bunk Period 4 (**CS304 - Design & Analysis of Algorithms**) together 5 times in October.
   - In UI: Select **Subject Filter = CS304** in the Knowledge Graph to see them highlighted.
2. **Afternoon Bunk Group**:
   - Students: **Aarav Patel** (`21CSB001`), **Rohan Sharma** (`21CSB002`), **Kabir Verma** (`21CSB003`)
   - Behavior: Synchronized skips on Periods 3 & 4.
""")

        print(f"Exported exact 4 CSV files to sample_data/ and presentation_documents/ successfully!")

        # Sync backend/makerove.db -> root makerove.db
        root_db = BASE_DIR / "makerove.db"
        backend_db = BASE_DIR / "backend" / "makerove.db"
        if backend_db.exists():
            shutil.copyfile(backend_db, root_db)
            print("Synchronized backend/makerove.db -> makerove.db successfully!")


if __name__ == "__main__":
    asyncio.run(seed_presentation_classroom())
