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

### Dynamic Race Pace Projection (The 4-Tier Physiological Model)
We calculate a projected race pace for the user off of logged running activities by evaluating volume, interval work-to-rest density, %HRmax aerobic velocity scaling, and non-linear distance fatigue models (Daniels VDOT / Peter Riegel's Power Law).

#### 1. Tier 1: Minimum Viable Volume & Duration Guardrail
To prevent ultra-short anaerobic bursts (e.g. a single 400m repeat) from distorting multi-mile race projections:
*   Workouts with total active running distance `< 0.75 miles` and total duration `< 6 mins` are capped to a maximum of 10K extrapolation and cannot skew Half Marathon / Marathon projections.

#### 2. Tier 2: Interval Work-to-Rest Ratio Density ($D_{\text{density}}$)
When interval details are present ($N$ repetitions with inter-rep recovery):
*   **$(N - 1)$ Rest Modeling:** For $N$ reps, recovery only occurs between reps ($N - 1$ rest intervals). Total rest $T_{\text{rest}} = (N - 1) \times \text{restSeconds}$.
*   **Work-to-Rest Ratio ($R = T_{\text{work}} / T_{\text{rest}}$):**
    *   **High Density ($R \ge 2.5$) — Cruise / Threshold Intervals:** (e.g., $3 \times 5\text{ mins}$ with $60-90\text{s}$ rest). Incomplete recovery keeps blood lactate and cardiovascular strain elevated throughout the session. $D_{\text{density}} = 0.97 - 0.99$ (closely mirrors continuous threshold running).
    *   **Moderate Density ($1.5 \le R < 2.5$) — VO2max Intervals:** $D_{\text{density}} = 0.93 - 0.96$.
    *   **Low Density ($R < 1.5$) — Speed Repeats with Full Rest:** $D_{\text{density}} = 0.86 - 0.92$ (applies a recovery-assisted discount before continuous race extrapolation).
*   **Continuous / Unstructured Tempo Runs:** If a tempo workout is logged continuously or without interval splits, $D_{\text{density}} = 1.0$ and Tier 3 handles the physiological effort seamlessly.

#### 3. Tier 3: %HRmax Aerobic Velocity Scaling ($f_v$)
Running velocity ($v = 1/\text{Pace}$) scales non-linearly with $\% \text{HR}_{\max}$ (where $\text{Max HR} = 220 - \text{Age}$):
*   **Zone 5+ ($>96\% \text{Max HR}$):** $f_v = 1.02 - 1.04$
*   **Zone 5 ($90 - 96\% \text{Max HR}$):** $f_v = 0.98 - 1.02$ (5K Race Effort / Hard Intervals)
*   **Zone 4 ($84 - 90\% \text{Max HR}$):** $f_v = 0.94 - 0.98$ (Threshold / Tempo effort is $\sim 5\%$ slower than 5K pace, eliminating artificial 13% pace drops)
*   **Zone 3 ($76 - 84\% \text{Max HR}$):** $f_v = 0.89 - 0.94$ (Steady Aerobic)
*   **Zone 2 ($65 - 76\% \text{Max HR}$):** $f_v = 0.84 - 0.89$ (Easy Aerobic)
*   **Zone 1 ($<65\% \text{Max HR}$):** $f_v = 0.78 - 0.84$ (Recovery / Flush)
*   **Dual-Track RPE & Fallback Offsets:** When HR is not logged, `effortZone` (1-5), legacy `rpeScore` (1-10), or workout types (`tempo` $\rightarrow 0.95$, `easy` $\rightarrow 0.85$, `long` $\rightarrow 0.88$, `fast` $\rightarrow 1.00$) supply the calibrated velocity fraction.

*   **Interval vs Continuous Integration:**
    *   *Interval Sessions with Rest:* Rest intervals assist rep velocity. For Tempo intervals ($3 \times 5\text{m}$ @ $7:23$ with rest), continuous 5K race pace is anchored right around rep pace ($\sim 7:18 - 7:23\text{ /mi}$). For short VO2max track repeats ($8 \times 400\text{m}$ @ $6:15$ with rest), continuous 5K pace accounts for the rest assistance ($\sim 6:26 - 6:35\text{ /mi}$).
    *   *Continuous Runs (No Rest):* Scales directly via the continuous $\% \text{HR}_{\max}$ aerobic velocity curve.

#### 4. Tier 4: Non-Linear Distance Scaling (Peter Riegel's Power Law)
To scale projected pace accurately between 5K and the runner's specific profile `targetDistance`:
$$\text{Pace}_{\text{target}} = \text{Pace}_{\text{5K}} \times \left(\frac{D_{\text{target}}}{3.1068}\right)^{b - 1}$$
*   **Fatigue Exponents ($b$):** $b = 1.06$ for 5K–10K, $b = 1.07$ for Half Marathon, $b = 1.08$ for Marathon, $b = 1.09$ for Ultra.
*   **Outlier Filtering & Smoothing:** The system takes the last **5 valid runs**, discards the slowest outlier, and averages the remaining 4 to display the top-level **Pace Est.** metric.
*   **Dual-View Time Horizon (5-Week Focus vs. Full Journey):**
    *   **5-Week Performance Window (Dashboard Default):** Slices the macrocycle timeline to the 5 most recent/active weeks.
    *   **Full Journey Modal (`full-pace-journey-chart`):** Renders the entire macrocycle (12–16 weeks) from journey start to target race date.
    *   **Chart Aggregation Logic:** Weekly volume bars aggregate total miles across all logged workouts. Weekly pace trend points only aggregate valid running workouts converted via the 4-tier formula.

### Weight Trend Engine & Biometrics Trajectory Model
To support safe weight progression and defeat cognitive overload, weight tracking is decoupled into an active phase window and a full journey exponential decay model.
*   **Master Exponential Decay Curve:** Rather than a linear drop, human weight trajectory follows an exponential decay model:
    `W_target(t) = TargetWeight + (StartWeight - TargetWeight) * e^(-k * t)`
    where `t` is elapsed weeks from `journeyStartDate`, and `k = 2.9957 / TotalJourneyWeeks` (calibrating 95% target achievement by the final target date).
*   **Dual-View Time Horizon:**
    *   **Phase Isolation (Dashboard Default):** Anchors strictly to `currentPhaseIndex` (`phaseStart` to `phaseEnd`). Sets `x = 0` to the last known weight recorded before entering the active phase (`phaseStartWeight`), and plots only logs recorded within the phase. Slices the master exponential decay curve to display the **active phase target** and computes phase delta (`latestWeight - phaseStartWeight`).
    *   **Full Journey Modal (`full-journey-chart`):** Expands the entire timeline across all macrocycle phases (12–26 weeks), plotting the full historical dataset, total journey delta, and the ultimate target weight bullseye.
*   **7-Day Moving Average & Smoothing:** Filters daily fluid and glycogen shifts by computing a rolling average across nearby weight logs (`|dx| <= 0.5` weeks).

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


## 5. Strength Rest Period Modeling vs. Running Interval Recovery

Rest periods serve fundamentally different physiological purposes across Strength Circuits versus Speed/Running Intervals:

### A. Strength & Circuit Sessions (Adaptive 5-Second Increments)
For strength and neuromuscular stability routines, short rest preserves workout density and prevents the "phone distraction trap":
*   **Discrete 5-Second Increments:** All strength rest periods (`restSeconds` and `circuitRestSeconds`) are strictly modeled in 5-second integer increments (10s, 15s, 20s, 25s, 30s, 35s, 40s, 45s, 60s).
*   **Adaptive Inter-Exercise Transition (`restSeconds`):**
    *   *Advanced / High Fitness:* 10s – 15s (elevated heart rate & density).
    *   *Intermediate / Moderate Fitness:* 15s – 25s (balanced recovery and tempo).
    *   *Beginner / Deconditioned:* 25s – 35s (generous setup runway).
*   **Adaptive Inter-Round Recovery Break (`circuitRestSeconds`):**
    *   *Advanced:* 25s – 30s.
    *   *Intermediate:* 35s – 45s.
    *   *Beginner:* 45s – 60s.
*   **Straight-Set Linear Strength (`isCircuit: false`):** 30s, 45s, or 60s.

### B. Speed, Track & Running Interval Sessions (Cardiovascular & Lactate Recovery)
Running interval rest periods are **NEVER clamped** to short circuit numbers. High-velocity running intervals (VO2max track repeats, 400m/800m repeats, tempo intervals, hill sprints) require full physiological recovery to clear blood lactate and drop heart rate into sustainable zones:
*   **Track Repeats & Speed Intervals (e.g. 400m, 800m, Hill Sprints):** 60s to 180s (1:00 to 3:00 minutes) standing or walking/jogging rest.
*   **Cruise / Tempo Intervals:** 60s to 120s (1:00 to 2:00 minutes) active flush.
*   **Cockpit Rendering:** The timer engine formats rest periods >60s dynamically into clean MM:SS clock counters (e.g. `2:00`, `1:30`, `1:00`).

## 6. Structured Interval Logging & Automated Mileage Engine

### A. Discrete Schema (Elimination of Fuzzy Text Parsing)
To eliminate regex parsing fragility, workouts and intervals generated by the AI Coach (`generateWorkoutBlock`, `generateSecondaryWorkout`, `modifySingleWorkout`) output strongly-typed schema properties:
*   `intervalRepCount`: Integer number of work intervals (e.g., 3, 5, 8).
*   `intervalType`: `'time'` or `'distance'`.
*   `intervalWorkValue`: Numeric quantity (e.g., 5 for 5 mins, 400 for 400m, 1.5 for 1.5 miles).
*   `intervalWorkUnit`: `'mins'`, `'seconds'`, `'m'`, `'km'`, `'mi'`.
*   `intervalRestSeconds`: Recovery duration in seconds between repetitions (e.g., 120, 90, 60).
*   `intervalTargetPace`: Single discrete target pace string in `MM:SS` format (e.g., `"7:08"`).

### B. Single Discrete Midpoint Target Pace (Defeating Decision Fatigue)
*   **Core Pillar (Action Over Overanalysis):** Pacing ranges (e.g., `7:00-7:15 /mi`) induce decision anxiety during high-intensity training. The AI Coach calculates and outputs a single target pace integer representing the exact midpoint ($427.5\text{s} \rightarrow 7:08\text{ /mi}$).
*   **Visual Guidance:** The UI surfaces this single target with a `~` prefix and an informational tooltip indicating the standard allowable training window ($\pm 15\text{s}$).

### C. Automated Interval Mileage & Work Volume Calculations
When a user logs a workout or interval session without GPX hardware data, the application calculates total work volume and writes `actualLoggedDistance` directly to Firestore:
*  - **Time-Based Intervals ($N \times T\text{ mins} @ \text{Pace}$)**:
  $$\text{Miles Per Rep} = \frac{\text{Interval Duration (mins)}}{\text{Logged Pace Decimal (mins/mile)}}$$
  $$\text{Total Work Distance} = N \times \text{Miles Per Rep}$$
  *Example*: For $3 \times 5\text{ mins}$ at $7:15\text{ /mi}$ ($7.25\text{ mins/mile}$), total distance is $3 \times \frac{5.0}{7.25} = 2.07\text{ miles}$. The input fields directly capture the runner's pace ($7:15\text{ /mi}$) while preserving the fixed interval duration.
- **Distance-Based Intervals ($N \times D\text{ meters}$)**:
  $$\text{Total Distance} = N \times (D \times 0.000621371)$$
  $$\text{Calculated Pace} = \frac{\text{Average Rep Time (seconds)}}{\text{Rep Distance (miles)}}$$
  *Example*: For $8 \times 400\text{m}$, total distance is $8 \times 0.24855 = 1.99\text{ miles}$. At $1:30$ per $400\text{m}$, the calculated pace is $6:02\text{ /mi}$. By persisting `actualLoggedDistance`, weekly volume bar charts and macrocycle mileage summaries accurately account for all interval and tempo sessions without manual distance conversions.

### D. Elite AI Coach Context Serialization & 2-Week Data Contract
When the AI Coach evaluates previous workout history, the payload is restricted to **the most recent ~14 completed workouts (~2 weeks)** and serialized using pure **ground-truth execution outputs** (eliminating prescribed target pace redundancy):
- **Interval Session Log Format:**
  `- [2026-08-22 | RUN / INTERVALS] "Tempo Repeats" (5 x 1000m): Actual Pace=7:10/mi | Splits=[4:25, 4:28, 4:30, 4:32, 4:35] | Total Dist=4.2 mi | Avg HR=168 BPM (Zone 4) | Effort=RPE 4/5 | Notes: "Strong pacing"`
- **Aerobic / Continuous Run Format:**
  `- [2026-08-20 | RUN / EASY] "Aerobic Base Run" (3.1 mi, 27 mins): Actual Pace=8:42/mi | Avg HR=142 BPM (Zone 2) | Effort=RPE 2/5 | Notes: "Smooth"`
- **Strength / Rest Formats:**
  `- [2026-08-21 | STRENGTH / CIRCUIT] "Core & Lower Body" (3 Rounds, 30 mins): Effort=RPE 3/5 | Notes: "Controlled"`
  `- [2026-08-23 | REST] "Recovery Day": Effort=RPE 1/5`

### E. Aggregate Macro Training Signals (Last 2 Weeks)
Alongside the micro workout log, the client passes lightweight aggregate signals (`trainingMetrics`) to give the coach high-level sports science context without bloating prompt tokens:
1. **Weekly Volume & Time on Feet**: e.g., `Block 1: 14.2 mi (125 mins, 4 runs, 2 strength) | Block 2: 15.8 mi (140 mins, 4 runs, 2 strength) | Progression Rate: +11.2%`.
2. **JIT Consistency & Cadence**: e.g., `100% consistency (High on-schedule) | Completed previous 7 workouts across 8 calendar days`.
3. **Biometric Weight Trend**: e.g., `Weight = 180.0 lbs (Change: -1.2 lbs over 14 days)`.
4. **Stripped Bloat**: Lifetime `bmiHistory`, `paceHistory`, GPS trackpoint coordinate arrays, and UI DOM states are excluded from callable payloads.

## 7. Strength Workout Schemas, Anatomical Naming & Guide Lifecycle Contract

### A. Anatomical Naming Directive (Zero Boilerplate)
To prevent visual clutter and redundant text on workout cards:
*   **Anatomical Focus Titles:** Strength workouts generated by the AI Coach (`generateWorkoutBlock`) set `workoutTitle` strictly to the anatomical target or physiological focus (e.g., `"Full Body"`, `"Core & Lower Body"`, `"Posterior Chain & Glutes"`, `"Upper Body Push/Pull"`, `"Hips & Ankle Stability"`).
*   **Elimination of Filler Words:** The words `"Strength"`, `"Workout"`, `"Circuit"`, `"Routine"`, and isolated letter identifiers (e.g., `"Guide A"`) are forbidden in `workoutTitle`.
*   **Backend Sanitization:** If Gemini outputs a title containing legacy filler words, the backend normalizer `sanitizeStrengthWorkoutTitle` strips them automatically before writing to Firestore.

### B. Rigid Schema-Driven Linking & Sanitizer Contract
Strength workouts are linked to strength guides strictly via structured properties, eliminating fuzzy regex parsing:
*   `strengthGuideReference`: Matches the exact `id` of a guide in `users/{userId}.currentStrengthGuides` (`"A"`, `"B"`, or `"C"`).
*   `isCircuit`: Boolean property (`true` for circuit routines, `false` for linear sets/reps).
*   `circuitRounds`: Integer count of rounds (e.g., `3`) for circuit workouts.
*   **Sanitization Scope Contract:** `sanitizeStrengthGuides(guides, profile)` receives the user profile to calculate deterministic recovery periods (`restSeconds`, `circuitRestSeconds`) based on the runner's fitness level (Beginner: 25s/45s, Intermediate: 15s/30s, Advanced: 10s/25s), preventing runtime reference errors.
*   **Frontend Presentation:**
    *   **Circuit Workouts:** The card title displays the clean anatomical focus (`Full Body`), and the subtitle renders `• Circuit • 3 Rounds`.
    *   **Linear Workouts:** The card title displays the focus (`Posterior Chain`), and the subtitle renders `• Strength Guide A`.

### C. Strength Guide Storage & Replacement Lifecycle
*   **Generation & Storage:** Tailored strength guides are generated alongside workouts during onboarding, phase advancement, or plan modifications and persisted to `users/{userId}.currentStrengthGuides` in Firestore.
*   **Weekly / Phase Adaptation:** When advancing to a new training block, fresh strength guides overwrite the old routines on the user profile, ensuring exercises evolve with phase demands.
*   **Client Synchronization:** The client loads `currentStrengthGuides` into memory upon authentication, powering the Strength Tab (`tab-strength`), Up-Next card subtitle rendering, and the interactive workout logging checklist.


