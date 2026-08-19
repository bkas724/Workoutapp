# YourFlow: Remaining Updates & Items to Revisit

> **Living Backlog & Maintenance Protocol**:
> This document tracks active backlog items, pending enhancements, and areas to revisit across the YourFlow application.
> **Rule**: As items are implemented, refined, or resolved, **remove them** from this file (or move them to the *Recently Completed Archive*) to ensure this document always reflects current pending work.

---

## 📋 Active Backlog & Feature Enhancements

### 1. Dashboard & Daily Flow (`tab-home`)
- [ ] **"5-Minute Launchpad" (Micro-Start Mode)**: Add a 1-tap "Just Give Me 5 Minutes" prompt on the Up-Next Card that starts a 5-minute countdown to overcome task initiation paralysis.
- [ ] **Quick Rest Day / Active Recovery Action**: Add a 1-tap "Convert Today to Rest / Stretch Day" shortcut directly on the Up-Next Card for high-fatigue days without opening submenus.
- [ ] **"Total Friction Time" Header Box**: Display a clear breakdown (`[4m Prep]` ➔ `[30m Run]` ➔ `[4m Cool]`) to eliminate time perception anxiety.
- [ ] **Workout Completion Feedback Animation**: Add a subtle, satisfying micro-animation / haptic pulse when checking off the Big Checkmark box.
- [ ] **Offline Workout Queuing**: Ensure workouts checked off while temporarily offline queue cleanly in IndexedDB/localStorage and auto-sync immediately upon reconnection.

---

### 2. Pacing, Analytics & Biometrics (`tab-analytics`)
- [ ] **Multi-Distance Race Time Projections**: Expand the Dynamic Race Pace Projections card to show equivalent estimated times for 10K, Half Marathon, and Marathon alongside the primary 5K target.
- [ ] **GPX Cadence & Elevation Gain Analysis**: Extract elevation gain and cadence streams from uploaded `.gpx` files and surface them in the Workout Detail view.
- [ ] **Automated Weight Check-In Prompts**: Hook the weight notification toggle in Settings to local browser notifications / PWA push triggers.

---

### 3. Training Journey & Macrocycle Engine (`tab-journey`)
- [ ] **Phase History Archive & Review**: Enable clicking past completed phase pills in the proportional track (`✓ 1`, `✓ 2`) to view a read-only historical summary of executed workouts, average paces, and coach feedback from that phase.
- [ ] **Target Horizon Recalculation on Goal Date Change**: If the user edits their target race date in Profile Settings, offer an option to proportionally extend or compress remaining macrocycle phases.

---

### 4. AI Coach & Cloud Functions (`functions/index.js`)
- [ ] **AI Latency Masking & Retry Fallbacks**: Enhance frontend UI loading states with contextual coaching tips during 10–15s Cloud Function generations (`generateWorkoutBlock`, `generateMacrocyclePlan`) to eliminate perceived wait time.
- [ ] **Dietary Allergy Strictness Validator**: Add a server-side JSON schema guard to guarantee Gemini meal suggestions never include user-specified allergens/dislikes.

---

### 5. Strength & Equipment Matrix (`tab-strength`)
- [ ] **Exercise Video / Form GIF Demonstrations**: Add lightweight visual movement cues or animated diagrams for core strength exercises in the Strength Guide cards.
- [ ] **Custom Exercise Swap**: Allow athletes to swap an individual strength exercise with an alternative matched to their available equipment.

---

### 6. Challenge Hub & Fog of War (`tab-turkey-trot`)
- [ ] **Shareable Spectator Invite Link**: Generate a lightweight URL query parameter (e.g. `?spectate=Bkas724`) allowing friends/coaches to directly view the live VIP Spectator mode without creating an account.
- [ ] **Head-to-Head Milestone Push Alerts**: Notify competitors when an opponent completes a milestone or benchmark run.

---

### 7. Settings, Data Management & PWA Infrastructure
- [ ] **Profile Data Backup / Export (JSON)**: Add a 1-click "Export My Data" button in Settings to download the complete profile, macrocycle history, weight logs, and workout records as a JSON file.
- [ ] **Profile Data Import / Restore**: Allow restoring or migrating a profile from a previously exported JSON backup file.
- [ ] **Service Worker Update Prompt**: Show a non-intrusive toast notification when a new PWA service worker version is deployed, offering a 1-click refresh.

---

## 🔍 Items to Revisit & Technical Sense Checks

1. **Heart Rate Zone & VDOT Accuracy on Custom GPX Uploads**:
   - *Context*: Check outlier detection when GPX files contain GPS drift or noisy optical heart rate spikes at the beginning of runs.
   - *Action*: Periodically review sample GPX logs with extreme pace spikes to ensure outlier trimming preserves valid tempo intervals.

2. **Exponential Moving Average (70/30 EMA) Sensitivity**:
   - *Context*: When a runner logs an exceptionally fast or slow benchmark due to environmental conditions (e.g. severe heat or extreme tailwind), evaluate if a single benchmark swings baseline VDOT too drastically.
   - *Action*: Consider testing a 5% cap on maximum single-session VDOT shifts.

3. **Mobile Screen Real Estate on Small Viewports (≤ 375px)**:
   - *Context*: Ensure timeline phase progression pills, Up-Next card action buttons, and modal charts scale gracefully without horizontal scrollbars or cramped labels on smaller iPhone/Android devices.

4. **Firestore Read/Write Cost Optimization**:
   - *Context*: Confirm real-time snapshot listeners properly detach on profile switches and window unloads to keep Firestore reads efficient.

---

## 🔄 Maintenance Protocol for AI Assistants & Developers

When working on this repository:
1. **Check this file** before starting a task to review relevant backlog context.
2. **When an item is completed**: Remove the item from the list above.
3. **When a new improvement or revisit item is identified**: Append it to the appropriate category.
4. **Keep documentation aligned**: Always ensure updates reflected here are matched with [USER_GUIDE.md](file:///c:/Users/IsItI/Documents/GitHub/Workoutapp/USER_GUIDE.md) and [BACKEND_METHODOLOGY.md](file:///c:/Users/IsItI/Documents/GitHub/Workoutapp/BACKEND_METHODOLOGY.md) as applicable.
