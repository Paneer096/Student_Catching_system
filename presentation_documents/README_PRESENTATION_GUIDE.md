# Makerove Presentation Documents & Classroom Demonstration Guide

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
