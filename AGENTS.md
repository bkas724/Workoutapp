# AI Development Guidelines & Core Product Pillars

Whenever modifying code, adding features, or maintaining this repository, all AI coding assistants MUST adhere to the following rules:

1. **Enforce Core Product Pillars**:
   - 🎯 **Action Over Overanalysis**: Keep UI decisions simple. Deliver immediate clarity (e.g. Up-Next Card: workout, duration, movement prep, hydration, meal suggestions) vs. decision overload.
   - ⚡ **Frictionless Initiation (ADHD-Friendly)**: Explicitly state time expectations upfront to defeat task paralysis and time-perception anxiety. Keep entry friction minimal.
   - 🛡️ **Guilt-Free Habit Building**: Preserve JIT sequential progression (`currentPhaseIndex`). NEVER penalize missed workouts or use rigid calendar grids that induce guilt or shame cycles.
   - 🌿 **Holistic Daily Support**: Integrate workout execution with RPE empathy feedback, pre-run readiness, movement tips, and effort-matched nutrition strategies.

2. **Read & Maintain Documentation**:
   - Refer to [Context/Spec.txt](file:///c:/Users/IsItI/Documents/GitHub/Workoutapp/Context/Spec.txt) and [USER_GUIDE.md](file:///c:/Users/IsItI/Documents/GitHub/Workoutapp/USER_GUIDE.md) before making architectural changes.
   - Update [USER_GUIDE.md](file:///c:/Users/IsItI/Documents/GitHub/Workoutapp/USER_GUIDE.md) whenever user-facing features, tabs, or workflows are added or modified.

3. **Conflict Resolution**:
   - If a requested feature conflicts with these principles, notify the user and offer an adaptive, habit-building alternative.
