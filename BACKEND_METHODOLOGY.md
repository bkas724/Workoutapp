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

### Dynamic 5K Projection (The "Turkey Trot" Formula)
We calculate a projected 5K race pace for the user off of *any* logged run (even a Zone 1 easy run) by mathematically extrapolating their recorded average Heart Rate against their theoretical maximums.
*   **The Formula:** `projected_Pace_Sec = logged_Sec * ((logged_HR - 60) / (race_HR - 60))`
*   **Assumptions:** Base resting HR is assumed to be `60` BPM. The `race_HR` (a 5K race effort) is calculated as `92%` of the user's `Max HR` (which is `220 - Age`).
*   **Pace Offsets:** If a user logs an `Easy` run, we mathematically adjust the logged pace by `-80` seconds per mile before extrapolating, to account for the intentional biomechanical slowdown. Long runs receive a `-55` second offset. Tempo runs receive a `+25` second offset.

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
