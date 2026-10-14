# Makarov — Presentation Cheatsheet for Tomorrow

> **Presenter Notice:** [VERIFIED: scripts/seed_presentation_classroom.py:1-49] The data currently shown in the application is synthetic, seeded demonstration data for Section `CS-3B` (60 students, 22 school dates in October 2026). Never claim it is live data from your college campus.

---

## 1. 60-Second Pitch: How Bunk Groups Are Found

> *"Makarov does not guess who is friends with whom. It examines official classroom attendance registers and asks one strict statistical question:*
>
> *'If each student skipped classes independently according to their own personal schedule and weekday habits, how often would two students miss the same morning or afternoon block purely by chance?'*
>
> *First, we filter out full-day sick absences, morning late arrivals, approved medical leaves, and college-wide mass strikes. Then, for every active pair, we test their shared skip count against an exact stratified hypergeometric distribution that controls for day of the week. An edge is drawn only if the overlap is at least double chance expectation (Lift $\ge 2.0$), occurred across at least 3 distinct calendar dates, and remains statistically significant after Benjamini-Hochberg False Discovery Rate correction ($q \le 0.05$). Finally, we apply Louvain community detection to group interconnected students into supportive outreach cohorts."*

---

## 2. 60-Second Pitch: How the Calendar Percentage Is Produced

> *"The percentage displayed on the calendar is an Academic Calendar Risk Score derived from vacation-gain incentives and institutional schedule rules.*
>
> *College closed days and weekends are automatically set to 0%. For working days, our engine scans university gazetted holidays and your timetable to calculate how many consecutive vacation days a student gains by skipping that single date.*
>
> *A 'sandwich day' trapped between the weekend and a festival holiday—like Monday, October 19 before Dussehra—yields an extended 4-day contiguous break and receives our highest base score of 74%. Regular Fridays before a weekend receive 58%, while standard mid-week days receive a baseline of 12%. If the day includes a practical lab session, 14 points are added. The system gives academic coordinators advance visibility into dates when travel incentives naturally pull students away from campus."*

---

## 3. 5-Minute Live Demo Script

| Time | Screen / Action | What to Say (Verbatim Guide) | Real Data Reference |
|---|---|---|---|
| **0:00 – 1:00** | **Knowledge Graph View**<br/>Select Section `CS-3B`<br/>Sensitivity: `Strict` | *"Here is Section CS-3B's co-absence network. Only students with validated ties appear. Node size shows individual bunk rate; node color indicates community clusters."* | Nodes: 18 students<br/>Edges: 16 total (5 derived, 11 teacher notes) |
| **1:00 – 2:00** | **Click Edge between Aarav & Kabir**<br/>Open Evidence Drawer | *"Clicking the edge between Aarav Patel (21CSB001) and Kabir Verma (21CSB003) opens our evidence drawer. They missed 5 shared blocks together on CS303/CS304. Expected overlap by chance was only 1.15 days. Their Lift is 4.35x chance, with a p-value of 0.0006."* | `21CSB001` & `21CSB003`<br/>Jaccard: `1.0`<br/>Lift: `4.35`<br/>Dates: Oct 2, 8, 14, 20, 26 |
| **2:00 – 2:45** | **Contrast with Teacher Tie**<br/>Click edge to `21CSB012` | *"Notice this edge between Aarav and Ananya (21CSB012). It has a badge showing it is a teacher-recorded study partnership ('STUDIES_WITH'), not an attendance bunk tie. Makarov separates verified attendance facts from human observations."* | `21CSB001` -- `21CSB012`<br/>Type: `STUDIES_WITH`<br/>Source: `TEACHER_MANUAL` |
| **2:45 – 4:00** | **Switch to Calendar Risk View**<br/>Navigate to October 2026 | *"Now let's switch to the Academic Calendar. Notice Monday, October 19 is highlighted in red with a 74% hazard score. October 20 is Dussehra, and October 17–18 was the weekend. Skipping Monday turns one absence into a 4-day vacation. In contrast, Wednesday, October 14 is a standard mid-week class day at 12%."* | Oct 19: `74%` (HIGH, Bridge Day)<br/>Oct 9: `58%` (MEDIUM, Friday)<br/>Oct 14: `12%` (LOW, Mid-Week) |
| **4:00 – 5:00** | **Open Prediction Calculator**<br/>Adjust parameters | *"For custom scenarios, teachers can open the Prediction Calculator. Setting a Friday afternoon slot before a holiday computes an exact feature attribution breakdown (+18.5% for Friday, +12.4% for afternoon, +24.5% for 4-day bridge)."* | Calibrated Prediction Modal<br/>Baseline: `14.2%` |

---

## 4. Top 12 Faculty Questions & Honest Answers

| # | Faculty Question | Honest Answer for Presenter |
|---|---|---|
| **1** | **Does an edge prove two students are friends?** | *"No. It proves statistical co-absence beyond chance. Two students might skip together because they commute on the same train route or attend the same coaching class, not because of personal friendship."* |
| **2** | **Can it identify the leader of a bunk group?** | *"No. Attendance registers record absence, not conversation or peer pressure. Edges are completely undirected. Makarov identifies clusters, never individual 'ringleaders'."* |
| **3** | **How accurate is the percentage? Is it a real probability?** | *"It is an empirical risk index (0–100) scoring vacation incentives, not a calibrated Bayesian probability. It highlights when scheduling structure incentivizes absence, allowing proactive notice."* |
| **4** | **What happens with sick leave, cancelled classes, or strikes?** | *"All are filtered out. Approved medical leaves are excused, cancelled lectures are dropped, and if $\ge 40\%$ of the class skips on a single day, the engine treats it as a collective event and ignores it for pairwise ties."* |
| **5** | **How many days of data does it need?** | *"A minimum of 15 distinct school dates and at least 50% multi-period attendance days. Below 15 days, the engine refuses to draw edges and reports 'Insufficient Data'."* |
| **6** | **Is the data real or simulated in this demo?** | *"It is synthetic demonstration data generated from realistic student rosters and October 2026 timetables with fixed random seeds, ensuring privacy compliance during institutional testing."* |
| **7** | **What are the privacy and misuse risks?** | *"Risk of punitive labeling. We prevent this via DPDP 2023 compliance: rolling 30-day windows, privacy-by-default masking of names, teacher-in-the-loop audit logs, and student rights to inspect their own data."* |
| **8** | **What would you improve next?** | *"Training an empirical machine learning model (e.g. LightGBM) calibrated on multi-semester historical attendance, and integrating transit/weather APIs."* |
| **9** | **Why do you group periods into blocks?** | *"Because missing an entire 4-period afternoon reflects a single decision to leave campus. Counting 4 periods independently would inflate a single shared absence into 4 artificial coincidences."* |
| **10** | **Why use Benjamini-Hochberg FDR instead of Bonferroni?** | *"In a class of 60 students, there are 1,770 possible pairs. Bonferroni is far too conservative and destroys statistical power. Benjamini-Hochberg controls the false discovery rate at 5% while preserving sensitivity."* |
| **11** | **What if two students just both happen to be chronically absent?** | *"The stratified null test conditions on each student's personal skip rate and weekday habits. If student A skips 40% of classes and student B skips 40%, they need a much higher overlap count to reach significance than two students who skip 10%."* |
| **12** | **Why are some students in the graph who have 0 bunks?** | *"Those students are connected by teacher observations or study partnership entries from the `teacher_connections` table, which are overlaid with distinct badges."* |

---

## 5. "Do Not Claim" List

Do **NOT** say any of the following to faculty tomorrow:

1. **DO NOT CLAIM:** *"We use an advanced AI / Deep Learning / Neural Network model to predict attendance."*
   - *Truth:* The calendar runs on a deterministic rule engine with fixed heuristic weights.
2. **DO NOT CLAIM:** *"The calendar shows the exact percentage of students who will bunk tomorrow."*
   - *Truth:* It is a structural hazard score (0–100), not a head-count prediction.
3. **DO NOT CLAIM:** *"The graph finds the ringleader or influencer of the group."*
   - *Truth:* The graph is undirected; it has no concept of hierarchy or leadership.
4. **DO NOT CLAIM:** *"This data is pulled live from our college ERP today."*
   - *Truth:* The current database is seeded synthetic test data.
5. **DO NOT CLAIM:** *"The calendar prediction has a 95% accuracy rate."*
   - *Truth:* On current data, the correlation between calendar scores and actual absence is not calibrated.
6. **DO NOT CLAIM:** *"We have trained machine learning models in our Model Registry."*
   - *Truth:* The `model_registry` table in the database currently contains 0 rows.

---

## 6. How I Verified This

1. Verified all graph algorithms and formulas directly against source code in `backend/makarov_engine/` (`cells.py`, `pairtest.py`, `engine.py`, `config.py`).
2. Verified all calendar rules, weights, and endpoints directly against `backend/app/calendar_risk/engine.py` and `frontend/src/views/CalendarRiskView.tsx`.
3. Validated real entity numbers and worked examples against `backend/makerove.db` using Python inspection scripts `inspect_graph.py`, `test_pairs_detail.py`, and `backtest_calendar.py`.
