# Core Backend Methodology & Architecture

This document tracks the core backend calculations, data flows, and AI integration strategies for the WorkoutApp. It acts as the single source of truth for **why** our backend is structured the way it is, especially concerning complex math, AI prompt logic, and user exertion modeling.

**Maintainer Note for AI Agents:**
Whenever you modify backend calculations, mathematical models (e.g. Heart Rate, Pace, Volume), or alter the data payloads sent to the AI Coach in Cloud Functions, you **MUST update this document** to reflect those changes. This ensures the reasoning behind the architecture is never lost.

---

## 1. AI Coach Exertion & Heart Rate Methodology

### The 1–5 Zone Abstraction
Our application operates on a 5-Zone Effort (RPE) scale:
*   **Zone 1:** Recovery / Very Light
*   **Zone 2:** Easy / Conversational
*   **Zone 3:** Moderate / Steady
*   **Zone 4:** Hard / Threshold
*   **Zone 5:** Max Effort / Failure

**Core Principle: The AI Coach is mathematically isolated from exact Heart Rate (BPM) values.**

*   **What the AI Coach sees and outputs:** The AI Coach (`functions/index.js`) operates strictly using integers 1 through 5 (e.g., `targetRPE = 2`, `rpeScore = 4`). It does not receive the user's specific heart rate zones (e.g., 130 BPM), nor does it calculate them.
*   **Why this abstraction exists:** Large Language Models (LLMs) are exceptionally powerful at strategic reasoning (e.g., knowing a user needs a Zone 1 recovery day after a Zone 4 hard effort). However, LLMs are historically prone to hallucinating or miscalculating mathematical equations (e.g., `(220 - Age) * 0.65`).
*   **Frontend Translation:** By abstracting the AI to strictly output a `Zone Integer`, we let the frontend application code (`public/js/pace-math.js`) deterministically translate that integer into personalized Heart Rate targets based on the user's saved Profile (`Age`, `Max HR`). This ensures 100% mathematical accuracy on the user's screen while leveraging the AI for what it does best: strategic planning.

## 2. Pacing Logic (Beginner vs Advanced)

### The "Beginner & Recovery Pacing" Rule
In the AI Coach prompt (`functions/index.js`), there is an explicit directive to prevent the AI from assigning rigid MM:SS numerical paces to users whose primary goal is 'health' or 'recovery', or who are classified as 'beginners'.
*   **Why:** Rigid pacing targets for beginners cause anxiety and friction. We combat this by forcing the AI to output qualitative descriptions like `"Easy Walk"`, `"Conversational Jog"`, or `"Active Flush"`.
*   **Implementation:** The prompt instructs the AI to utilize the `targetPaceZone` JSON property for these qualitative strings rather than explicit times.

## 3. Just-In-Time (JIT) Workout Progression

### The `currentPhaseIndex`
Unlike calendar-based grid apps, our database tracks a user's progress through a linear sequence using `currentPhaseIndex` (tracked in the user's root document or phase document).
*   **Why:** To enforce the core pillar of "Guilt-Free Habit Building." If a user misses 3 days of workouts, they do not fail the plan. When they open the app on day 4, the application simply loads the next workout in their sequential phase.
*   **Data Structure:** The AI Coach generates an array of upcoming workouts. The UI only surfaces the *next uncompleted workout* based on the index, ensuring zero friction or decision fatigue when initiating a session.

## 4. Analytical Math Models (Frontend)

### Dynamic Race Pace Projection (The "Turkey Trot" Formula)
We calculate a projected race pace for the user off of *any* logged running activity by mathematically extrapolating their recorded average Heart Rate against their theoretical maximums.
*   **The Formula:** `projected_Pace_Sec = logged_Sec * ((logged_HR - 60) / (race_HR - 60))`
*   **Assumptions:** Base resting HR is assumed to be `60` BPM. `Max HR` is calculated as `220 - Age`. 
*   **Dynamic Race HR Thresholds:** The `race_HR` in the formula scales dynamically based on the user's `targetDistance` in their profile, because longer races require a lower sustainable HR:
    *   **5K**: 92% of Max HR
    *   **10K**: 90% of Max HR
    *   **Half Marathon**: 85% of Max HR
    *   **Marathon**: 80% of Max HR
    *   **Ultra**: 75% of Max HR
*   **Dynamic RPE Scaling (Dual-Track):** If the user does not log a smartwatch Heart Rate, the system creates a mathematical HR equivalent using a percentage of their specific Max HR. The database maintains two distinct tracks to preserve historical integrity:
    *   **New System (`effortZone`):** Uses a 1-5 scale (Zone 1 = 60%, Zone 2 = 70%, Zone 3 = 80%, Zone 4 = 88%, Zone 5 = 95%).
    *   **Legacy System (`rpeScore`):** Preserves historical runs logged on a 1-10 scale by mapping them to the same HR percentages (e.g. 1-2 = 60%, 3-4 = 70%, 9-10 = 95%). This prevents older "Easy" runs (e.g. a 4/10) from being misread as a new "Zone 4 (Threshold)" run.
*   **Ratio Clamping:** To prevent extreme mathematical anomalies (e.g. an absurdly low logged HR generating a world-record 5K pace), the `((logged_HR - 60) / (race_HR - 60))` multiplier is safely clamped between `0.65` and `1.15`.
*   **Pace Offsets:** If a user does not have HR data or an RPE score, we mathematically adjust the logged pace based on the activity type before extrapolating: `Easy` runs receive a `-80s` offset (making the projected pace 80s faster). `Long` runs receive a `-90s` offset. `Tempo` runs receive a `-25s` offset.
*   **Activity Filtering & Smoothing:** To eliminate anomalies like hikes or bike rides, only running-based activities (`run`, `interval`, `tempo`, `easy`, `benchmark`, etc.) are processed for pace conversions. The system gathers the last **5 valid runs**, discards the absolute slowest outlier (to account for a random trail run or injury), and averages the remaining 4 to generate the top-level **Pace Est.** metric.
*   **Dual-View Time Horizon (5-Week Focus vs. Full Journey):**
    *   **5-Week Performance Window (Dashboard Default):** Slices the macrocycle timeline to the 5 most recent/active weeks. This prevents bar/point congestion on mobile screens and focuses cognitive bandwidth on immediate performance.
    *   **Full Journey Modal (`full-pace-journey-chart`):** Renders the entire macrocycle (12–16 weeks) from journey start to target race date, illustrating long-term linear pace targets and volume progression.
    *   **Chart Aggregation Logic:** Weekly volume bars aggregate total miles across all logged workouts. Weekly pace trend points only aggregate valid running workouts converted via the dynamic Turkey Trot formula, ensuring non-running cross-training sessions do not distort weekly running pace trends.

### JIT Consistency Score Calculation
To quantify "Guilt-Free Consistency", the app calculates a rolling metric (10 to 100 score) based on the *velocity* of completing workout blocks, not specific calendar dates.
*   **The Math:** For every block of 7 workouts, we calculate `Score = (7 / Actual_Days_Taken) * 100`.
*   **Example:** If 7 workouts are finished in 7 days, the score is `100`. If it takes 14 days, the score is `50`. 
*   **Smoothing:** We average this score across the user's 5 most recent blocks to create the `JIT Consistency Badge` displayed on the dashboard.

## 5. Security & Social Logic

### "Fog of War" (Competitor Masking)
To prevent sandbagging and gamification between rival competitors, the app implements a "Fog of War" mask on competitor views.
*   **Competitor View:** Active competitors cannot see each other's live, actual scores, heart rates, or uploaded GPX screenshots. Instead, they see an **Estimated Trajectory** (calculated as a flat `+2.0%` score improvement per week from a baseline seed).
*   **Spectator View (V.I.P.):** Unauthenticated users, visitors, or non-competitors bypass the Fog of War entirely and can view all raw, unfiltered scores and proof screenshots for both athletes.

---
*Last Updated: August 2026*
