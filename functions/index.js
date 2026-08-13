const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

// Access the API key securely. We define the secret in Firebase configuration.
const { defineSecret } = require("firebase-functions/params");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

let GoogleGenerativeAI;
function getGenAI(apiKey) {
    if (!GoogleGenerativeAI) {
        GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
    }
    return new GoogleGenerativeAI(apiKey);
}

exports.proposeGoalPaces = onCall({
    secrets: [geminiApiKey],
    cors: true,
}, async (request) => {
    const { age, weight, sex, fitnessLevel, targetDistance, targetDate, currentPace, daysAvailable, notes, why } = request.data;
    
    const ai = getGenAI(geminiApiKey.value());
    const prompt = `You are an elite running coach AI. 
The user provides their details:
- Age: ${age}
- Weight: ${weight} lbs
- Sex: ${sex}
- Fitness Level: ${fitnessLevel}
- Target Race/Goal Distance: ${targetDistance}
- Target Date: ${targetDate}
- Current Pace: ${currentPace} min/mi
- Days Available to Train: ${daysAvailable} days/week
- Personal Constraints/Notes: ${notes || 'None'}
- Deep Motivation (Why?): ${why || 'None'}

Based on the time remaining until the target date, calculate 4 distinct proposed Goal Paces (in MM:SS format).
Return ONLY a valid JSON object matching exactly this structure without any markdown wrappers or text:
{
  "paces": {
    "Elite": "MM:SS",
    "Aggressive": "MM:SS",
    "Progressive": "MM:SS",
    "Consistent": "MM:SS"
  }
}`;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let pacesData;
        try {
            pacesData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                pacesData = JSON.parse(match[0]);
            } else {
                throw new Error("Could not parse JSON from response: " + responseText);
            }
        }
        
        return pacesData;
    } catch (error) {
        console.error("Error writing message:", error);
        throw new HttpsError("internal", "Error saving message.", error.message);
    }
});

exports.backfillAIInsights = onCall({
    secrets: [geminiApiKey],
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    const { profile, activeWorkouts } = request.data;
    const ai = getGenAI(geminiApiKey.value());

    const prescriptiveMealsEnabled = Boolean(profile?.prescriptiveMeals);
    const dietaryNotes = profile?.dietaryPreferences || "None specified";

    const nutInstruction = prescriptiveMealsEnabled
        ? `1. 'healthInsights' object with 'movementTip', 'hydrationRecovery', and 'nutritionHeuristics'. Because the user enabled Prescriptive Meals (Allergies/Preferences: "${dietaryNotes}"), for each tier ('restDay', 'lightActivity', 'hardActivity'), return a structured object with 'calorieTarget' (e.g. "1,800 kcal"), concise 'description', and 'meals' object with 'breakfast', 'lunch', 'dinner', 'snack' recommendations strictly respecting their dietary preferences.`
        : `1. 'healthInsights' object with 'movementTip', 'hydrationRecovery', and 'nutritionHeuristics' (restDay, lightActivity, hardActivity meals and calories as plain descriptive strings).`;

    const nutSchema = prescriptiveMealsEnabled
        ? `"nutritionHeuristics": {
      "restDay": { "calorieTarget": "String", "description": "String", "meals": { "breakfast": "String", "lunch": "String", "dinner": "String", "snack": "String" } },
      "lightActivity": { "calorieTarget": "String", "description": "String", "meals": { "breakfast": "String", "lunch": "String", "dinner": "String", "snack": "String" } },
      "hardActivity": { "calorieTarget": "String", "description": "String", "meals": { "breakfast": "String", "lunch": "String", "dinner": "String", "snack": "String" } }
    }`
        : `"nutritionHeuristics": {
      "restDay": "String",
      "lightActivity": "String",
      "hardActivity": "String"
    }`;

    const prompt = `You are an elite running coach and nutritionist.
The user is currently in a training block but their block was generated before we introduced AI health insights and JIT fueling tips.
We need to backfill this missing data.

User Profile:
- Age: ${profile?.age || 'Unknown'}, Weight: ${profile?.weight || 'Unknown'} lbs, Height: ${profile?.heightInches || 'Unknown'} inches
- Fitness Level: ${profile?.fitnessLevel || 'Unknown'}
- Prescriptive Meals Enabled: ${prescriptiveMealsEnabled ? 'Yes' : 'No'}
${prescriptiveMealsEnabled ? `- Dietary Preferences/Allergies: ${dietaryNotes}` : ''}

Here are the user's active workouts for this phase:
${activeWorkouts.map(w => `- ID: ${w.id} | Title: ${w.workoutTitle} | Type: ${w.type} | Duration: ${w.distanceDuration} | Instructions: ${w.targetInstructions}`).join('\n')}

Existing Macrocycle Plan:
${JSON.stringify(profile?.macrocyclePlan || [], null, 2)}

Generate the following:
${nutInstruction}
2. 'jitPreparationTip' for EACH workout ID listed above.
3. 'macrocyclePlan': An array updating their Existing Macrocycle Plan. Preserve the original 'phase' and 'theme' verbatim. Provide a 'simpleDescription' (1-2 sentences, laymens terms) and a 'detailedDescription' (rich paragraph detailing the physiological intent). Append an 'expectedDurationWeeks' to each phase. If the user's tier is 'recreational' (Consistent/Get Healthy), the ENTIRE journey across all phases MUST NOT exceed 12 weeks total.
4. 'overarchingTheme': A string representing the user's primary focus for the entire journey.

Return ONLY a valid JSON object matching exactly this structure without any markdown wrappers or text:
{
  "healthInsights": {
    "movementTip": "String",
    "hydrationRecovery": "String",
    ${nutSchema}
  },
  "workoutTips": [
    {
      "id": "String (must match the ID from the list above)",
      "jitPreparationTip": "String (Actionable prep/fueling tip for THIS workout)"
    }
  ],
  "macrocyclePlan": [
    {
      "phase": Number,
      "theme": "String",
      "simpleDescription": "String (1-2 sentences max about that stage, just the basics, in laymens terms)",
      "detailedDescription": "String (Full details, can be about a paragraph in length, detailing the physiological intent of the phase)",
      "expectedDurationWeeks": Number
    }
  ],
  "overarchingTheme": "String"
}`;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                parsedData = JSON.parse(match[0]);
            } else {
                throw new Error("Could not parse JSON from response: " + responseText);
            }
        }
        
        return parsedData;
    } catch (error) {
        console.error("Error calling Gemini API for backfill:", error);
        throw new HttpsError("internal", "Failed to backfill AI insights.", error.message);
    }
});

exports.generateWorkoutBlock = onCall({
    secrets: [geminiApiKey],
    cors: true,
    timeoutSeconds: 90
}, async (request) => {
    const { profile, phaseIndex, history, simpleMode } = request.data;
    
    const ai = getGenAI(geminiApiKey.value());
    
    let historyContext = "No recent workout history logged yet.";
    if (history && Array.isArray(history) && history.length > 0) {
        historyContext = history.map(h => 
            `- ${h.workoutTitle} (${h.distanceDuration}): target=${h.targetPaceZone || 'N/A'}, actual=${h.actualLoggedPace || 'N/A'}, RPE=${h.rpeScore || 'N/A'}${h.userWorkoutNotes ? `, Notes: "${h.userWorkoutNotes}"` : ''}`
        ).join("\n");
    }

    const equipmentString = simpleMode ? "None / Bodyweight (User requested Simple Mode)" : (profile?.equipmentList && profile.equipmentList.length > 0 ? profile.equipmentList.join(', ') : 'None / Bodyweight');
    const prescriptiveMealsEnabled = Boolean(profile?.prescriptiveMeals);
    const dietaryNotes = profile?.dietaryPreferences || "None specified";

    const nutInstructionBlock = prescriptiveMealsEnabled
        ? `3. Internally calculate their BMR using the Mifflin-St Jeor formula and formulate a daily calorie goal that supports steady progress. IMPORTANT: Stick to these maximum weight loss guardrails: If weight >= 250 lbs, max loss is 1.0%-1.5% (2.5-3.5 lbs/week). If weight 180-240 lbs, max loss is 0.5%-1.0% (1.0-2.0 lbs/week). If weight < 180 lbs, max loss is 0.25%-0.5% (0.5-1.0 lbs/week). Do not exceed these rates when formulating the daily calorie goal. Because the user enabled Prescriptive Meals (Allergies/Preferences: "${dietaryNotes}"), for each activity tier ('restDay', 'lightActivity', 'hardActivity') in 'nutritionHeuristics', return a structured object containing: 'calorieTarget' (formatted string like "1,800 kcal"), a general simple 'description' (concise, stripping out all unnecessary wordy language), and a 'meals' object with simple, actionable recommendations for 'breakfast', 'lunch', 'dinner', and 'snack' that meet that calorie target while strictly adhering to their dietary preferences. If the user provided custom notes ('gatewayOverrideNotes'), heavily adapt the upcoming workouts.`
        : `3. Internally calculate their BMR using the Mifflin-St Jeor formula and formulate a daily calorie goal that supports steady progress. IMPORTANT: Stick to these maximum weight loss guardrails: If weight >= 250 lbs, max loss is 1.0%-1.5% (2.5-3.5 lbs/week). If weight 180-240 lbs, max loss is 0.5%-1.0% (1.0-2.0 lbs/week). If weight < 180 lbs, max loss is 0.25%-0.5% (0.5-1.0 lbs/week). Do not exceed these rates when formulating the daily calorie goal. Generate simple meal examples categorized into 'restDay', 'lightActivity', and 'hardActivity' as basic summary strings. If the user provided custom notes ('gatewayOverrideNotes'), heavily adapt the upcoming workouts.`;

    const nutSchemaBlock = prescriptiveMealsEnabled
        ? `"nutritionHeuristics": {
      "restDay": { "calorieTarget": "String", "description": "String", "meals": { "breakfast": "String", "lunch": "String", "dinner": "String", "snack": "String" } },
      "lightActivity": { "calorieTarget": "String", "description": "String", "meals": { "breakfast": "String", "lunch": "String", "dinner": "String", "snack": "String" } },
      "hardActivity": { "calorieTarget": "String", "description": "String", "meals": { "breakfast": "String", "lunch": "String", "dinner": "String", "snack": "String" } }
    }`
        : `"nutritionHeuristics": {
      "restDay": "String",
      "lightActivity": "String",
      "hardActivity": "String"
    }`;

    const prompt = `You are a professional elite running coach AI and health nutritionist.
User Profile:
- Age: ${profile?.age || 'Unknown'}, Weight: ${profile?.weight || 'Unknown'} lbs, Height: ${profile?.heightInches || 'Unknown'} inches, Sex: ${profile?.sex || 'Unknown'}
- Fitness Level: ${profile?.fitnessLevel || 'Unknown'}
- Primary Goal: ${profile?.primaryGoal || 'Unknown'}
- Days Available to Train: ${profile?.daysAvailable || 4}
- Minutes Available per Day: ${profile?.desiredWorkoutLength || 'Unlimited'}
- Include Strength Training: ${profile?.includeStrength ? 'Yes' : 'No'}
- Training Focus (Strength vs Cardio): ${profile?.trainingFocusRatio === 'auto' ? 'Determine optimal ratio based on BMI, weight, and fitness level. (e.g., heavier beginners should focus on walking before loading joints with strength).' : profile?.trainingFocusRatio + '/100 (0=Heavy Strength, 100=Heavy Cardio)'}
- Available Equipment: ${equipmentString}
- Deep Motivation (Why?): ${profile?.why || 'N/A'}
- Personal Notes (Constraints/Lifestyle): ${profile?.userBaselineNotes || 'None'}
- Chronic Limitations (Long-term): ${profile?.chronicLimitations || 'None'}
- Acute Injuries (Short-term): ${profile?.acuteInjuries || 'None'}
- Emergency Overrides: ${profile?.emergencyOverrideNotes || 'None'}
- Prescriptive Meals Enabled: ${prescriptiveMealsEnabled ? 'Yes' : 'No'}
${prescriptiveMealsEnabled ? `- Dietary Preferences/Allergies: ${dietaryNotes}` : ''}
${profile?.primaryGoal === 'race' ? `- Goal Pace: ${profile?.activeAdjustedGoal || 'N/A'} min/mi` : ''}

Recent Workout History:
${historyContext}

${profile?.macrocyclePlan ? `\nOverarching Macrocycle Plan:\n${JSON.stringify(profile.macrocyclePlan, null, 2)}\n(Use this to maintain narrative context for the current phase)` : ''}

The user is entering Macrocycle Phase ${phaseIndex || 1}.

1. Generate a 7-day workout block that precisely fits their Days Available to Train (use "rest" type for the remaining days).
If strength training is Yes, include at least 1-2 "strength" workouts.
For main strength workouts, ALWAYS link them to a Strength Guide by generating 1 to 3 specific Strength Guides for the week (assigned unique IDs like "A", "B", "C"), setting 'strengthGuideReference' to that exact ID, and setting 'activities' to a single placeholder item (e.g. [{ "name": "Strength Circuit A", "type": "work" }]). Do NOT list custom strength exercises inline inside 'activities' for main strength workouts. Inline activities in 'activities' should only be used for warmups ("prep") or cooldowns ("cool").
SEQUENCE ORDER RULES: For days 1 through 7, every day must have at least one activity (which could be cardio, strength, or rest). You may assign a maximum of TWO activities per day on non-rest days if it fits the user's goals. If you assign two activities on the same day, they MUST NOT be of the same type (e.g., one cardio and one strength is allowed. Two cardio or two strength is forbidden). If a day is a 'rest' day, there must be NO other activities scheduled on that day. IMPORTANT: When stacking, you MUST create two completely separate workout objects in the JSON array (one for the cardio, one for the strength) with the same sequenceOrder. DO NOT combine them into a single workout object.

2. Attach a 'jitPreparationTip' to EVERY workout object (including rest days). This tip should instruct the user on what to do *the day before* or *the hours leading up to* this specific workout to prepare/fuel/recover.

${nutInstructionBlock}
4. Evaluate their recent history and determine if they missed days/took extra rest. Use this context to scale intensity or volume for the new block.
5. CRITICAL: For any "work" activities (especially Strength Circuits or Intervals), ensure the "sets" property is explicitly defined as a Number. Determine the optimal number of sets (whether 1 set for active recovery/beginners, or 3-5 sets for advanced/hypertrophy) based carefully on the user's fitness level, goals, and history. Be intentional and consistent with this prescription.
6. If a work activity is a circuit (e.g. Strength Circuit A), explicitly set "isCircuit" to true and specify the number of rounds in "circuitRounds". For non-circuit activities, set them to false and 0.
7. Time Constraints: The user has a daily time limit of ${profile?.desiredWorkoutLength || 'Unlimited'} minutes. A workout can be significantly shorter if it needs to be, but it should not be excessively longer (keep within ~10% of their limit max). If a single workout (like a long run) significantly exceeds this limit, attempt to break the volume up across multiple days (e.g., breaking a 6-mile run into a 2-mile and 4-mile split on consecutive days) to keep the daily time within ~10% of their available time. However, if you believe a single long continuous session is absolutely necessary to reach the optimal performance for their goal, you may keep the longer workout but explicitly mention this in the 'jitPreparationTip' or 'targetInstructions'.
8. CRITICAL 'type' Validation: The 'type' field of a workout MUST be exactly one of these strings: "run", "walk", "bike", "swim", "easy", "fast", "long", "tempo", "interval", "recovery", "base", "aerobic", "strength", "rest". Do not invent new types.
9. CRITICAL STRIDES & INTERVAL REPS RULE: For any secondary running activity such as Strides, Sprints, Intervals, Hill Repeats, or Short Reps (e.g. 'Strides', 'Hill Sprints'), you MUST explicitly state the REP COUNT at the start of 'repsDistanceTime' (e.g. '4 x 100m at ~80% effort', '6 x 200m'). NEVER return a single distance string without the rep count (e.g. NEVER output '100m at ~80% effort' alone).
10. BEGINNER & RECOVERY PACING RULE: If the user's primary goal is 'health' or 'recovery', or fitness level is beginner, DO NOT enforce rigid numerical MM:SS paces in targetPaceZone. Always prescribe clear, comfortable targetDistance (in miles) or targetDuration (in minutes), but use qualitative targetPaceZone descriptions such as "Easy Walk", "Brisk Walk", "Conversational Jog", or "Active Flush" (light recovery movement to increase blood flow). Do not require a baseline run test for these profiles.

Return ONLY a valid JSON object exactly in this format without any markdown wrappers or additional text:
{
  "workouts": [
    {
      "id": "act-X",
      "phaseNumber": ${phaseIndex || 1},
      "sequenceOrder": 1,
      "workoutTitle": "String",
      "type": "String (MUST be exactly one of the validated types above)",
      "workoutCategory": "String (MUST be exactly one of: 'continuous_run', 'intervals', 'strength', 'rest', 'cross_training'. NOTE: If a run is mostly a continuous distance run but ends with short strides, categorize it as 'continuous_run')",
      "isSpeedWorkout": Boolean,
      "isBenchmark": Boolean,
      "targetDistance": "Number (Target distance in miles, if applicable, e.g., 3.0 or 4.5)",
      "targetDuration": "Number (Target duration in minutes, if applicable, e.g., 45 or 60)",
      "targetInstructions": "String (Keep under 100 characters)",
      "targetPaceZone": "String (For walking: use Easy Walk, Brisk Walk, Power Walk. For running: easy, goal, tempo, long, or null)",
      "jitPreparationTip": "String (Actionable prep/fueling tip for THIS workout)",
      "strengthGuideReference": "String (The exact 'id' of the strength guide e.g. 'A' ONLY IF exercises are in strengthGuides. If exercises are listed inline in activities, set strengthGuideReference to null)",
      "activities": [
        {
          "name": "String (e.g., Warmup, Interval, Squats)",
          "type": "String (prep, work, cool)",
          "sets": Number,
          "repsDistanceTime": "String (e.g., '4 x 100m at ~80% effort', '6 x 200m', '10 reps', '5 mins') - MUST include rep count at start for strides/intervals!",
          "isCircuit": Boolean,
          "circuitRounds": Number
        }
      ]
    }
  ],
  "strengthGuides": [
    {
      "id": "String (e.g., 'A', 'B', 'C')",
      "title": "String (e.g. Hip Stability)",
      "exercises": [
        {
          "name": "String",
          "setsReps": "String",
          "description": "String"
        }
      ]
    }
  ],
  "healthInsights": {
    "movementTip": "String",
    "hydrationRecovery": "String",
    ${nutSchemaBlock}
  }
}`;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                parsedData = JSON.parse(match[0]);
            } else {
                throw new Error("Could not parse JSON from response: " + responseText);
            }
        }
        
        let workouts = parsedData.workouts || parsedData;
        if (!Array.isArray(workouts)) workouts = [];
        
        // Programmatic Deduplication Check
        const seenActivities = {};
        const deduplicatedWorkouts = [];
        workouts.forEach((w) => {
            const day = w.sequenceOrder;
            if (!seenActivities[day]) {
                seenActivities[day] = new Set();
            }
            
            const broadType = w.type === 'rest' ? 'rest' : (w.type === 'strength' ? 'strength' : 'cardio');
            
            if (broadType === 'rest' && seenActivities[day].size > 0) {
                return; // Can't have rest if already scheduled something else
            }
            if (seenActivities[day].has('rest') && broadType !== 'rest') {
                return; // Can't schedule anything else if rest is already scheduled
            }
            if (seenActivities[day].has(broadType)) {
                return; // Duplicate type (e.g., double cardio or double strength), drop it
            }
            if (seenActivities[day].size >= 2) {
                return; // Max 2 activities per day, drop it
            }
            
            seenActivities[day].add(broadType);
            deduplicatedWorkouts.push(w);
        });
        
        workouts = deduplicatedWorkouts.map((w, index) => ({
            ...w,
            id: "ai-act-" + Date.now() + "-" + index,
            completed: false,
            dateExecuted: null,
            actualLoggedPace: null,
            rpeScore: null
        }));
        
        return { 
            workouts, 
            strengthGuides: parsedData.strengthGuides || [],
            healthInsights: parsedData.healthInsights || null
        };
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new HttpsError("internal", "Failed to generate AI workouts.", error.message);
    }
});

exports.generateMacrocyclePlan = onCall({
    secrets: [geminiApiKey],
    cors: true,
}, async (request) => {
    const { profile } = request.data;
    
    let timelineInstruction = "timeline";
    if (profile?.primaryGoal === 'race' && profile?.dynamicGoalData?.targetDate) {
        const targetDate = new Date(profile.dynamicGoalData.targetDate);
        const now = new Date();
        const diffTime = targetDate - now;
        if (diffTime > 0) {
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const diffWeeks = Math.round(diffDays / 7);
            const diffMonths = Math.round(diffDays / 30.44);
            timelineInstruction = `a STRICT ${diffWeeks}-week (${diffMonths}-month) timeline until their race`;
        }
    } else if (profile?.primaryGoal === 'health') {
        timelineInstruction = "a STRICT 12-week foundational timeline consisting of exactly three 4-week macrocycles";
    }

    const ai = getGenAI(geminiApiKey.value());
    const prompt = `You are an elite training coach AI.
The user provides their details:
- Age: ${profile?.age || 'Unknown'}, Weight: ${profile?.weight || 'Unknown'} lbs, Sex: ${profile?.sex || 'Unknown'}
- Fitness Level: ${profile?.fitnessLevel || 'Unknown'}
- Primary Goal: ${profile?.primaryGoal || 'Unknown'}
- Days Available to Train: ${profile?.daysAvailable || 4} days/week
- Personal Constraints/Notes: ${profile?.userBaselineNotes || 'None'}
- Deep Motivation (Why?): ${profile?.whyMotivation || 'None'}
${profile?.primaryGoal === 'race' ? `- Target Distance: ${profile?.dynamicGoalData?.targetDistance || 'N/A'}\n- Target Date: ${profile?.dynamicGoalData?.targetDate || 'N/A'}` : ''}
${profile?.primaryGoal === 'recovery' ? `- Nature of Break: ${profile?.dynamicGoalData?.natureOfBreak || 'N/A'}\n- Current Phase: ${profile?.dynamicGoalData?.currentPhase || 'N/A'}` : ''}

Based on their goal, fitness level, and ${timelineInstruction}, design a high-level Macrocycle training plan.
CRITICAL MULTI-PHASE REQUIREMENT: You MUST divide the athlete's ${timelineInstruction} into 3 to 4 logical, sequential training phases (e.g. Phase 1: Base Building, Phase 2: Speed Endurance & Threshold, Phase 3: Peak Capacity, Phase 4: Race Taper). DO NOT return only 1 single phase for a multi-week/month goal. The sum of 'expectedDurationWeeks' across all generated phases MUST equal the total timeline weeks.

Additionally, generate two arrays for the user to guide their mindset and behavior:
1. "processGoals": Array of 2-3 behavioral, process-oriented daily/weekly targets tailored to their weight, available days, and equipment. For beginners getting healthy, this is their north star. (e.g. "Complete 3 intentional movement sessions every week", "Hit 7000 steps on off days", "Keep calories under 2400 to support safe weight loss").
2. "letsBeReal": Array of up to 5 blunt, no-nonsense rules for success. CRITICAL INSTRUCTION: You MUST align these with the Just-In-Time (JIT) mentality and the core philosophy: "You can suck, but you can't skip." Meaning, encourage them to modify or shorten a workout if they are busy/tired, but doing zero is unacceptable. The language should be encouraging but firm and real.

Return ONLY a valid JSON object exactly matching this structure without any markdown wrappers or text:
{
  "overarchingTheme": "String (e.g. 'From Couch to 5K - A Journey of Consistency')",
  "macrocyclePlan": [
    {
      "phase": 1,
      "theme": "String (e.g. 'Base & Aerobic Foundation')",
      "simpleDescription": "String (1-2 sentences max about that stage, just the basics, in laymens terms)",
      "detailedDescription": "String (Full details, can be about a paragraph in length, detailing the physiological intent of the phase)",
      "expectedDurationWeeks": 4
    },
    {
      "phase": 2,
      "theme": "String (e.g. 'Speed Endurance & Threshold')",
      "simpleDescription": "String",
      "detailedDescription": "String",
      "expectedDurationWeeks": 4
    },
    {
      "phase": 3,
      "theme": "String (e.g. 'Peak Capacity & Race Taper')",
      "simpleDescription": "String",
      "detailedDescription": "String",
      "expectedDurationWeeks": 4
    }
  ],
  "processGoals": ["String"],
  "letsBeReal": ["String"]
}`;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let planData;
        try {
            planData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                planData = JSON.parse(match[0]);
            } else {
                throw new Error("Could not parse JSON from response: " + responseText);
            }
        }
        
        return planData;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new HttpsError("internal", "Failed to generate macrocycle plan.", error.message);
    }
});

exports.generateStrengthGuidesOnly = onCall({
    secrets: [geminiApiKey],
    cors: true,
}, async (request) => {
    const { phaseIndex, profile, simpleMode } = request.data;
    
    const ai = getGenAI(geminiApiKey.value());
    const equipmentString = simpleMode ? "None / Bodyweight (User requested Simple Mode)" : (profile?.equipmentList && profile.equipmentList.length > 0 ? profile.equipmentList.join(', ') : 'None / Bodyweight');

    const prompt = `You are a professional elite running coach AI.
User Profile:
- Age: ${profile?.age || 'Unknown'}, Weight: ${profile?.weight || 'Unknown'} lbs, Sex: ${profile?.sex || 'Unknown'}
- Fitness Level: ${profile?.fitnessLevel || 'Unknown'}
- Available Equipment: ${equipmentString}
- Deep Motivation (Why?): ${profile?.why || 'N/A'}

The user is in Macrocycle Phase ${phaseIndex || 1}.

Generate 1 to 3 specific Strength Guides for the week (depending on how many you prescribe) that strictly utilize ONLY the available equipment listed above.

Return ONLY a valid JSON object exactly in this format without any markdown wrappers or additional text:
{
  "strengthGuides": [
    {
      "title": "String (e.g. Hip Stability & Single-Leg)",
      "exercises": [
        {
          "name": "String (e.g. DB Reverse Lunges)",
          "setsReps": "String (e.g. 3 Sets x 10/leg)",
          "description": "String (e.g. Load front heel dynamically. Builds specific push power.)"
        }
      ]
    }
  ]
}`;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                parsedData = JSON.parse(match[0]);
            } else {
                throw new Error("Could not parse JSON from response: " + responseText);
            }
        }
        
        return parsedData;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new HttpsError("internal", "Failed to generate strength guides.", error.message);
    }
});

exports.upgradeMacrocycleDescriptions = onCall({
    secrets: [geminiApiKey],
    cors: true,
}, async (request) => {
    const { macrocyclePlan } = request.data;
    
    if (!macrocyclePlan || !Array.isArray(macrocyclePlan)) {
        throw new HttpsError("invalid-argument", "Invalid macrocyclePlan provided.");
    }

    const ai = getGenAI(geminiApiKey.value());
    const prompt = `You are an elite running coach AI.
The user has an existing Macrocycle Plan where each phase only has a single 'description'.
We need to upgrade this plan by splitting that description into two distinct fields for the UI:
1. 'simpleDescription': 1-2 sentences max about that stage, just the basics, in laymens terms.
2. 'detailedDescription': Full details, can be about a paragraph in length, detailing the physiological intent of the phase (you can expand on the original description).

Existing Plan:
${JSON.stringify(macrocyclePlan, null, 2)}

Return ONLY a valid JSON object matching exactly this structure without any markdown wrappers or text:
{
  "macrocyclePlan": [
    {
      "phase": 1,
      "theme": "String (Keep original theme verbatim)",
      "simpleDescription": "String",
      "detailedDescription": "String",
      "expectedDurationWeeks": 4 // Keep original duration verbatim
    }
  ]
}`;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let planData;
        try {
            planData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                planData = JSON.parse(match[0]);
            } else {
                throw new Error("Could not parse JSON from response: " + responseText);
            }
        }
        
        return planData;
    } catch (error) {
        console.error("Error calling Gemini API for upgrade:", error);
        throw new HttpsError("internal", "Failed to upgrade macrocycle descriptions.", error.message);
    }
});

exports.generateSecondaryWorkout = onCall({
    secrets: [geminiApiKey],
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    const { targetType, sequenceOrder, currentPhaseIndex, profileContext } = request.data;
    
    const ai = getGenAI(geminiApiKey.value());
    
    const prompt = `You are a professional elite running coach AI and health nutritionist.
The user wants to add a secondary workout to their day today. The requested activity type is: "${targetType}".
Their current active goal is: ${profileContext?.goal || "general fitness"}.
Their current block includes the following primary activities:
${profileContext?.currentBlock ? JSON.stringify(profileContext.currentBlock) : "N/A"}

Please generate a short, complimentary session tailored to this week's active block.
For example, if the type is "yoga" or "stretching", provide a recovery/mobility flow. If the type is "core", provide a quick core circuit. If the type is "run", provide a very easy recovery or short interval run depending on what they are lacking this week.

Return ONLY a valid JSON object exactly in this format without any markdown wrappers or additional text:
{
  "workout": {
    "workoutTitle": "String (e.g. 15-Min Core Blast)",
    "type": "${targetType}",
    "workoutCategory": "String (MUST be exactly one of: 'continuous_run', 'intervals', 'strength', 'rest', 'cross_training'. NOTE: If a run is mostly a continuous distance run but ends with short strides, categorize it as 'continuous_run')",
    "isSpeedWorkout": false,
    "isBenchmark": false,
    "distanceDuration": "String (e.g., 15 mins, or 2.0 mi in 20 mins)",
    "targetDistance": "Number (Optional)",
    "targetDuration": "Number (Optional)",
    "targetInstructions": "String (Keep under 100 characters)",
    "targetPaceZone": "String (Optional, for running: easy, goal, tempo, long, or null)",
    "jitPreparationTip": "String (Actionable prep/fueling tip for THIS workout)",
    "activities": [
      {
        "name": "String (e.g., Warmup, Interval, Squats)",
        "type": "String (prep, work, cool)",
        "sets": Number,
        "repsDistanceTime": "String (e.g., 10 reps, 400m, 5 mins)",
        "isCircuit": Boolean,
        "circuitRounds": Number
      }
    ]
  }
}
CRITICAL: Do not include any text outside of the JSON object. Do not wrap in markdown code blocks.`;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let workoutData;
        try {
            workoutData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                workoutData = JSON.parse(match[0]);
            } else {
                throw new Error("Could not parse JSON from response: " + responseText);
            }
        }
        
        return workoutData;
    } catch (error) {
        console.error("Error generating secondary workout:", error);
        throw new HttpsError("internal", "Failed to generate secondary workout.", error.message);
    }
});

exports.refreshNutritionOnly = onCall({
    secrets: [geminiApiKey],
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    const { profile } = request.data;
    const ai = getGenAI(geminiApiKey.value());

    const prescriptiveMealsEnabled = Boolean(profile?.prescriptiveMeals);
    const dietaryNotes = profile?.dietaryPreferences || "None specified";

    const nutInstruction = prescriptiveMealsEnabled
        ? `Because the user enabled Prescriptive Meals (Allergies/Preferences: "${dietaryNotes}"), for each activity tier ('restDay', 'lightActivity', 'hardActivity'), return a structured object with 'calorieTarget' (e.g. "1,800 kcal"), concise 'description', and 'meals' object with 'breakfast', 'lunch', 'dinner', 'snack' recommendations strictly respecting their dietary preferences.`
        : `Return basic meal recommendations for 'restDay', 'lightActivity', and 'hardActivity' as plain descriptive strings (basic recommendations).`;

    const nutSchema = prescriptiveMealsEnabled
        ? `"nutritionHeuristics": {
      "restDay": { "calorieTarget": "String", "description": "String", "meals": { "breakfast": "String", "lunch": "String", "dinner": "String", "snack": "String" } },
      "lightActivity": { "calorieTarget": "String", "description": "String", "meals": { "breakfast": "String", "lunch": "String", "dinner": "String", "snack": "String" } },
      "hardActivity": { "calorieTarget": "String", "description": "String", "meals": { "breakfast": "String", "lunch": "String", "dinner": "String", "snack": "String" } }
    }`
        : `"nutritionHeuristics": {
      "restDay": "String",
      "lightActivity": "String",
      "hardActivity": "String"
    }`;

    const prompt = `You are an elite nutritionist.
User Profile:
- Age: ${profile?.age || 'Unknown'}, Weight: ${profile?.weight || 'Unknown'} lbs, Height: ${profile?.heightInches || 'Unknown'} inches, Sex: ${profile?.sex || 'Unknown'}
- Fitness Level: ${profile?.fitnessLevel || 'Unknown'}
- Primary Goal: ${profile?.primaryGoal || 'Unknown'}
- Prescriptive Meals Enabled: ${prescriptiveMealsEnabled ? 'Yes' : 'No'}
${prescriptiveMealsEnabled ? `- Dietary Preferences/Allergies: ${dietaryNotes}` : ''}

Generate updated nutrition heuristics for this user:
${nutInstruction}

Return ONLY a valid JSON object matching exactly this structure without any markdown wrappers or text:
{
  ${nutSchema}
}`;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                parsedData = JSON.parse(match[0]);
            } else {
                throw new Error("Could not parse JSON from response: " + responseText);
            }
        }

        return parsedData;
    } catch (error) {
        console.error("Error calling Gemini API for nutrition refresh:", error);
        throw new HttpsError("internal", "Failed to refresh nutrition recommendations.", error.message);
    }
});

exports.modifySingleWorkout = onCall({
    secrets: [geminiApiKey],
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    const { profile, currentWorkout, userNotes } = request.data;
    if (!currentWorkout || !userNotes) {
        throw new HttpsError("invalid-argument", "Missing currentWorkout or userNotes.");
    }

    const ai = getGenAI(geminiApiKey.value());
    const prompt = `You are an elite endurance training coach AI.
The user wants to replace/modify a single workout in their current training block due to schedule changes, fatigue, or preferences.

User Profile:
- Goal: ${profile?.primaryGoal || 'general fitness'}
- Fitness Level: ${profile?.fitnessLevel || 'intermediate'}
- Minutes Available per Day: ${profile?.desiredWorkoutLength || 'Unlimited'}
- Personal Notes: ${profile?.userBaselineNotes || 'None'}

Current Workout Being Replaced:
- Title: ${currentWorkout.workoutTitle}
- Type: ${currentWorkout.type}
- Target Instructions: ${currentWorkout.targetInstructions || 'N/A'}
- Sequence Order: ${currentWorkout.sequenceOrder}

Athlete's Adjustment Request / Context:
"${userNotes}"

Generate a single replacement workout object that directly fulfills their request (e.g., if they asked for non-impact cardio, shorter duration, or specific leg soreness adaptation). Keep targetInstructions under 100 characters.

Return ONLY a valid JSON object matching exactly this structure without any markdown wrappers or text:
{
  "workout": {
    "id": "${currentWorkout.id}",
    "phaseNumber": ${currentWorkout.phaseNumber || 1},
    "sequenceOrder": ${currentWorkout.sequenceOrder || 1},
    "workoutTitle": "String",
    "type": "String (MUST be exactly one of: run, walk, bike, swim, easy, fast, long, tempo, interval, recovery, base, aerobic, strength, rest)",
    "workoutCategory": "String (MUST be exactly one of: continuous_run, intervals, strength, rest, cross_training)",
    "isSpeedWorkout": Boolean,
    "isBenchmark": Boolean,
    "targetDistance": "Number (or null)",
    "targetDuration": "Number (or null)",
    "targetInstructions": "String (under 100 chars)",
    "targetPaceZone": "String (or null)",
    "jitPreparationTip": "String",
    "strengthGuideReference": null,
    "activities": [
      {
        "name": "String",
        "type": "work",
        "sets": 1,
        "repsDistanceTime": "String"
      }
    ]
  }
}`;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                parsedData = JSON.parse(match[0]);
            } else {
                throw new Error("Could not parse JSON from response: " + responseText);
            }
        }

        const replacement = parsedData.workout || parsedData;
        return {
            workout: {
                ...replacement,
                id: currentWorkout.id,
                phaseNumber: currentWorkout.phaseNumber || 1,
                sequenceOrder: currentWorkout.sequenceOrder || 1,
                completed: false,
                dateExecuted: null,
                actualLoggedPace: null,
                rpeScore: null
            }
        };
    } catch (error) {
        console.error("Error modifying single workout:", error);
        throw new HttpsError("internal", "Failed to generate replacement workout.", error.message);
    }
});
