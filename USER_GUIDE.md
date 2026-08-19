# YourFlow: Dynamic & Adaptive Training Engine
## User Guide & Core Feature Reference

Welcome to **YourFlow** (v3.3), an elite, cloud-synchronized, autonomous coaching application built specifically for athletes and busy individuals who want to build sustainable, healthy habits and achieve ambitious fitness targets—without the friction, overanalysis, or calendar guilt of traditional training apps.

---

## 1. Core Philosophy & Product Pillars

YourFlow is built around four human-centered product pillars designed to support executive function, reduce cognitive load, and make physical consistency natural and rewarding:

### 🎯 Pillar 1: Action Over Overanalysis (Cognitive Relief)
* **The Challenge**: Decision fatigue and information overload often cause people to overanalyze, freeze, or get stuck before even starting.
* **The Solution**: YourFlow eliminates choice paralysis. The **Up-Next Action Card** presents a single, distilled daily cockpit with exactly what you need to act right now—session focus, exact duration, movement preparation, hydration guidance, and an effort-matched meal suggestion. No scrolling through menus or questioning what to do today.

### ⚡ Pillar 2: Frictionless Initiation (ADHD-Friendly Design)
* **The Challenge**: Individuals with ADHD or busy, fragmented schedules frequently experience task initiation paralysis, struggle with time perception ("How long will this actually take?"), or feel overwhelmed by complex setups.
* **The Solution**: Time expectations and required equipment are stated explicitly upfront. Initiation barriers are reduced to zero-friction entry points—including a **Big Checkmark Box** for single-click session logging—providing absolute clarity so you can jump in without hesitation or dread.

### 🛡️ Pillar 3: Guilt-Free Habit Continuity (JIT Sequential Progression)
* **The Challenge**: Traditional calendar-grid apps penalize missed days with red marks, broken streaks, and schedule guilt, triggering all-or-nothing thinking where a missed session leads to quitting altogether.
* **The Solution**: The **Just-in-Time (JIT) Sequential Engine** treats your progress as a continuous line, not a rigid calendar. If life, work, or fatigue forces a pause, your training picks up cleanly at your next active step—with zero penalties, zero guilt, and zero broken streak shaming.

### 🌿 Pillar 4: Holistic & Empathetic Daily Support
* **The Challenge**: Standard training plans treat workout execution in isolation, ignoring an athlete's daily recovery state, fueling needs, or physical fatigue signals.
* **The Solution**: YourFlow supports the whole human. Every session is paired with real-time Rate of Perceived Exertion (RPE) empathy feedback, pre-workout readiness checks, movement mobility tips, and daily nutrition strategies (Rest, Light, or Hard day fueling) tailored specifically to the effort level of your active session.

---

## Table of Contents
1. [Core Philosophy & Product Pillars](#1-core-philosophy--product-pillars)
2. [Onboarding & Medical Shield](#2-onboarding--medical-shield)
3. [App Views & Page Breakdown](#3-app-views--page-breakdown)
   - [Dashboard View (`tab-home`)](#31-dashboard-view-tab-home)
   - [Training Journey & Timeline (`tab-journey`)](#32-training-journey--timeline-tab-journey)
   - [Analytics & Dynamic Pace Blueprint (`tab-analytics`)](#33-analytics--dynamic-pace-blueprint-tab-analytics)
   - [Strength & Equipment Matrix (`tab-strength`)](#34-strength--equipment-matrix-tab-strength)
   - [Readiness Checklist (`tab-checklist`)](#35-readiness-checklist-tab-checklist)
   - [Challenge Hub & Fog of War (`tab-turkey-trot`)](#36-challenge-hub--fog-of-war-tab-turkey-trot)
4. [Core Workflows & Operating Instructions](#4-core-workflows--operating-instructions)
   - [Logging a Workout (Quick Checkmark vs. Gatekeeper Modal)](#logging-a-workout-quick-checkmark-vs-gatekeeper-modal)
   - [Active Workout Timer Modal](#active-workout-timer-modal)
   - [Recording Advanced Rep Splits](#recording-advanced-rep-splits)
   - [Benchmark Runs & 70/30 EMA Pace Recalibration](#benchmark-runs--7030-ema-pace-recalibration)
   - [Importing GPX Activity Files](#importing-gpx-activity-files)
   - [Swapping, Reordering, and Rest Days](#swapping-reordering-and-rest-days)
   - [Weight Tracking & Trend Analysis](#weight-tracking--trend-analysis)
5. [Glossary & Technical Definitions](#5-glossary--technical-definitions)

---

## 2. Onboarding & Medical Shield

When launching YourFlow for the first time (or initializing a new profile), you pass through a multi-step intake pipeline:

### 2.1 Medical Disclaimer Enforcement
Because cardiovascular and run training involve significant physical impact and exertion, the application strictly requires explicit acknowledgment of the **Medical Shield Notice**:
> *You are strictly, personally responsible for your own training decisions and physical exertion limits. YourFlow is an automated reference tool, not a medical professional. Consult your physician before beginning any athletic program.*

### 2.2 Multi-Step Intake Parameters
The intake collects quantitative metrics to calibrate your training baseline:
* **Profile ID**: Unique handle (e.g., `Bkas724`) used for multi-device Firestore sync.
* **Journey Title & Description**: Emotional hook (e.g., "Thanksgiving 5K Quest") and personal motivation.
* **Baseline Run Pace & Distance**: Recent reference effort (e.g., 3.1 miles at 7:30 min/mile) used to calculate your initial VDOT score.
* **Target Horizon Date**: Goal date for race or milestone completion.
* **Desired Workout Duration**: Preferred duration per session (e.g., 30–45 minutes).
* **Hardware & Equipment Inventory**: Available cross-training tools (Treadmill, Dumbbells, Pull-up Bar, Bicycle).
* **Challenge Intensity Tier**: Training aggressiveness selection (Conservative, Moderate, Aggressive, Elite).

### 2.3 Macrocycle AI Generation & Review
Upon submitting intake parameters, the AI Engine generates a customized multi-phase macrocycle roadmap (e.g., *Phase 1: Base Foundation*, *Phase 2: Aerobic Expansion*, *Phase 3: Threshold Sharpening*). Users review and accept the roadmap before entering the main dashboard.

---

## 3. App Views & Page Breakdown

The application navigation is organized into clean visual views (tabs):

### 3.1 Dashboard View (`tab-home`)
**Goal**: Serve as your primary daily cockpit—giving you immediate clarity on today's single focus without overanalysis.

* **Mindset Kick (Motivational Popup)**: A floating mindset banner delivering punchy, funny, anti-excuse sayings (e.g., *"You can suck, but you can't skip."*, *"I wonder what would happen if you worked out today."*). Automatically surfaces once per week using a non-repeating shuffle rotation, equipped with a 🎲 roll button to cycle sayings on demand and a 1-tap dismiss.
* **Up-Next Action Card**: Displays the immediate workout queued by the JIT engine, highlighting target pace, exact duration, workout type, movement prep tips, and pre-run notes.
* **Big Checkmark Box (Quick Complete)**: A single-click completion button located right on the action card. If you followed the coach's recommendation pretty closely, click this box to log the workout using the coach's target default metrics instantly—requiring zero typing and zero entry friction.
* **Daily Fuel & Nutrition Strategy Card**: Provides recommended nutrition guidelines (Rest, Light, or Hard day strategy) tuned to your daily workout volume.
* **Gatekeeper Form Modal**: An interactive logging option for entering precise custom paces, split times, RPE scores, or conversational notes.
* **Sync Badge**: Real-time indicator displaying live connection state with the Firestore database (`Syncing`, `Synced`, `Offline`).

### 3.2 Training Journey & Timeline (`tab-journey`)
**Goal**: Provide clear, distraction-free visibility into your overall macrocycle progress and active stage focus without cognitive overload.

* **Header Controls**: Quick controls including an inline **Simple View Toggle Pill** (`[☐ Simple]`) to instantly switch between concise simple stage overviews and detailed strategic descriptions without opening a modal, plus remaining horizon countdown.
* **Proportional Phase Progression Pills Track**: Full-width visual track across the top with pill widths scaled proportionally to each phase's duration in weeks, optimized for mobile screens using phase numbers:
  * **Completed Stages**: Solid green pills with a leading checkmark (`✓ 1`).
  * **Active Stage**: Indigo-outlined pill with an internal green progress fill measuring active phase workouts completed out of total expected phase JITs ($W \times 7$), labeled with the active stage number (`2`).
  * **Upcoming Stages**: Clean slate outline pills labeled with stage numbers (`3`).
  * **Checkered Race Flag (🏁)**: Target flag icon at the end of the track representing race goal completion.
* **Stage Spotlight Card**: Cleanly displays the name of the active/selected stage (e.g., *Speed Endurance & Threshold Expansion*) and its strategic focus description.

### 3.3 Analytics & Dynamic Pace Blueprint (`tab-analytics`)
**Goal**: Track physiological adaptation, baseline pacing zones, and body metrics.

* **Pace & Volume Performance Card**:
  * **5-Week Focus Window**: Main dashboard chart defaults to a clean 5-week view of weekly mileage bars and estimated race pace trend lines.
  * **Full Journey Modal**: Click the `<i class="fa-solid fa-expand"></i> Full Journey` button to expand a full-screen macrocycle view spanning Week 1 to Race Day.
  * **Interactive Pace Attribution**: Tap the **Pace Est.** pill to open the *Pace Calculation Breakdown* modal, displaying the exact HR/RPE inputs and outlier-dropped math behind your current estimated race pace.
  * **Key Shorthand Metrics**: Displays *Starting Baseline*, *Target Pace*, *Total Miles*, and *Pace Est.*
* **Dynamic Pace Blueprint Card**: Displays your active VDOT score and calculated target training zones:
  * **Easy / Recovery Pace** (e.g., 9:15 - 9:45 min/mi)
  * **Threshold / Tempo Pace** (e.g., 7:40 min/mi)
  * **Interval Pace** (e.g., 6:50 min/mi)
  * **Repetition Pace** (e.g., 6:15 min/mi)
* **Weight & Biometrics Dashboard**: Interactive logger and 7-day moving average chart tracking weight trends over time. The main chart isolates data to the **active phase** with phase-specific targets and entry baselines, with an expandable **Full Journey** modal to visualize the complete multi-phase trajectory.

### 3.4 Strength & Equipment Matrix (`tab-strength`)
**Goal**: Supplement running with targeted, equipment-aware strength and durability routines.

* **Hardware Filter Toggles**: Quickly toggle your active equipment availability (Dumbbells, Pull-up Bar, Treadmill, Bike).
* **Dynamic Strength Guides**: Exercise cards filtered to display only routines executable with your available gear.

### 3.5 Readiness Checklist (`tab-checklist`)
**Goal**: Pre-run gear, hydration, and safety verification.

* **Pre-Run Checklist**: Interactive checklist items (Hydration status, shoe wear check, reflective gear, warm-up mobility routine) to ensure safety and preparation before key sessions.

### 3.6 Challenge Hub & Fog of War (`tab-turkey-trot`)
**Goal**: Engage in head-to-head milestone quests and friendly athletic rivalries.

* **Quest Objectives**: Milestone targets such as the *Sub-20 5K Challenge* or *Turkey Trot Quest*.
* **Fog of War Competitor Mode**:
  * **Competitor View**: Active rivals cannot see each other's live exact times or screenshots, preventing sandbagging or pacing off opponents. Competitors view estimated progress trajectories (+2.0%/week).
  * **VIP Spectator View**: Non-competing family, friends, or coaches enjoy an unfiltered view of both athletes' live scores, projected race paces, and logged proofs.

---

## 4. Core Workflows & Operating Instructions

### Logging a Workout (Quick Checkmark vs. Gatekeeper Modal)

You can log your active workout on the **Dashboard View (`tab-home`)** using one of two convenient methods:

#### Method A: Big Checkmark Box (Quick Complete — Recommended)
If you followed the coach's recommendation pretty closely:
1. Locate the **Up-Next Action Card**.
2. Click the **Big Checkmark Box (`✓`)** directly on the card.
3. The session is logged instantly using the coach's target default distance and duration with **zero typing** required, advancing your JIT training sequence smoothly.

#### Method B: Detailed Gatekeeper Modal
If you ran a custom pace, want to record precise interval split times, adjust RPE, or add notes:
1. Click **Log Workout** to open the Gatekeeper modal.
2. Enter your metrics:
   * ⚡ **Speed / Benchmark Workouts**: Pacing fields are required to keep baseline VDOT formulas accurate.
   * 🪶 / 🐢 **Easy / Recovery Workouts**: Pacing input fields are automatically simplified to encourage stress-free recovery.
3. Select your **Rate of Perceived Exertion (RPE)** (e.g., *Smooth*, *Moderate*, *Hard*, *Exhausting*).
4. (Optional) Add conversational notes (e.g., *"Felt strong on the final hill"*).
5. Click **Complete Session** to save your log and advance the sequential queue.


### Workout List & 50/50 Workout Modal
When tapping the Up-Next Card for any scheduled session containing movements or strength circuits, the app opens a streamlined, two-phase training environment:

1. **Phase 1: Workout List (Briefing Mode)**:
   - A clean, passive reference sheet displaying all planned exercises, sets/reps, equipment, and coaching cues without interactive clutter.
   - Includes a permanently sticky top header with **`[ ▶ Start Workout ]`** and the ability to tap *any* exercise in the list to begin the interactive runner starting directly at that movement.
   - Includes a secondary **`[ Log Session Directly ]`** action at the bottom for autonomous athletes who prefer to check off the routine without timers.

2. **Phase 2: Workout Modal (50/50 Execution Cockpit)**:
   - **Top 50% (Fixed Hero Stage)**: Viewport-anchored stage displaying the active exercise, large interactive set bubbles (`[ 1 ] [ 2 ] [ 3 ]`), 56px countdown timer ring, collapsible form tip pills, and ghost controls (`[ +15s ]`, `[ ↺ Reset ]`, `[ ✓ Done ]`).
   - **Rest Runway Preview**: Automatically triggers a 30s rest countdown between sets, displaying the upcoming set and equipment directly beneath the timer ring (`Next: Set 2 of 3 • Dumbbells`).
   - **Patient Transitions**: When an exercise finishes, the app smoothly advances to the next movement and waits in a "Ready" state without auto-starting holds or rushing the athlete.
   - **Bottom 50% (Scrollable Gym Playlist)**: Displays the full session list, auto-scrolling to keep your active movement in view, and allowing 1-tap jumping to any machine if equipment is occupied.
   - **Zero-Drift Background Timing & WakeLock**: Timers persist accurately across tab switches via epoch timestamps (`Date.now()`), synthesize 3-2-1 audio beeps and completion chimes, and maintain screen wake-lock throughout execution.

### Recording Advanced Rep Splits
For workouts designated with interval repetitions (e.g., *6x400m*):
1. In the Gatekeeper modal, click **Advanced Rep Splits**.
2. Input target or actual times for individual reps.
3. The system computes average rep duration and pace consistency metrics automatically.

### Benchmark Runs & 70/30 EMA Pace Recalibration
1. Workouts marked with `isBenchmark: true` act as physiological test events.
2. Log your actual time/pace upon completion.
3. The system executes the **70/30 Exponential Moving Average** formula:
   $$\text{New Baseline Pace} = (0.70 \times \text{Previous Baseline}) + (0.30 \times \text{Logged Benchmark Pace})$$
4. The **Dynamic Pace Blueprint** immediately updates all calculated training zones (Easy, Tempo, Interval) across the application.

### Importing GPX Activity Files
1. Open the workout logging modal.
2. Drag and drop your `.gpx` activity file (from Garmin, Strava, Apple Watch, or Samsung Health) into the GPX Upload Dropzone.
3. The GPX parser automatically extracts total distance, total elapsed time, average pace, and elevation gain, populating the input fields.

### Swapping, Reordering, and Rest Days
1. Navigate to **Training Journey (`tab-journey`)**.
2. Click **Swap / Reorder** on an upcoming workout block.
3. Choose to:
   * **Swap Positions**: Exchange order between two upcoming sessions in the active phase.
   * **Insert Rest Day**: Shift the sequence forward by inserting an adaptive recovery day.
   * **AI Restructure**: Request an AI Autopilot recalculation if schedule or fatigue dictates a phase adjustment.

### Weight Tracking & Trend Analysis
1. Navigate to **Analytics (`tab-analytics`)**.
2. Under **Biometrics & Weight Tracking**, enter your current weight and click **Log Weight**.
3. View the **Phase Weight Progression** chart: strictly isolated to your active training block with entry baseline, 7-day moving average, and phase-specific target weight.
4. Click **Full Journey** to open the trajectory expansion modal and inspect your multi-phase progress from Day 1 to your ultimate target.

---

## 5. Glossary & Technical Definitions

* **JIT (Just-in-Time) Phase Engine**: Architecture that serves workouts sequentially as you complete them, eliminating rigid calendar dates and scheduling guilt.
* **Big Checkmark Box (Quick Complete)**: Zero-friction single-click button on the Up-Next Card that auto-fills target defaults when you follow the coach's recommendation pretty closely.
* **Up-Next Cockpit**: Distilled daily dashboard giving athletes immediate clarity on workout focus, duration, prep tips, hydration, and meal suggestions without choice overload.
* **Gatekeeper Mechanics**: Interactive form validation enforcing complete pace data entry on speed sessions while keeping recovery runs simple.
* **EMA (Exponential Moving Average)**: A 70/30 weighted statistical formula updating baseline paces post-benchmark runs.
* **VDOT**: A single-number measure of running capability derived from performance times, used to establish precise training intensity zones.
* **RPE (Rate of Perceived Exertion)**: Subjective effort scale (1–10) recorded per session to feed empathy adjustments into future AI workout generation.
* **Fog of War**: Privacy and competitive balancing mode that obfuscates live rival scores while displaying estimated trajectories until final race day.
