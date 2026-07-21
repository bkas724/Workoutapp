const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

// Access the API key securely. We define the secret in Firebase configuration.
const { defineSecret } = require("firebase-functions/params");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

exports.proposeGoalPaces = onCall({
    secrets: [geminiApiKey],
    cors: true,
}, async (request) => {
    const { age, weight, sex, fitnessLevel, targetDistance, targetDate, currentPace, daysAvailable, notes, why } = request.data;
    
    const ai = new GoogleGenerativeAI(geminiApiKey.value());
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
            const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            pacesData = JSON.parse(cleaned);
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
    const ai = new GoogleGenerativeAI(geminiApiKey.value());

    const prompt = `You are an elite running coach and nutritionist.
The user is currently in a training block but their block was generated before we introduced AI health insights and JIT fueling tips.
We need to backfill this missing data.

User Profile:
- Age: ${profile?.age || 'Unknown'}, Weight: ${profile?.weight || 'Unknown'} lbs, Height: ${profile?.heightInches || 'Unknown'} inches
- Fitness Level: ${profile?.fitnessLevel || 'Unknown'}

Here are the user's active workouts for this phase:
${activeWorkouts.map(w => `- ID: ${w.id} | Title: ${w.workoutTitle} | Type: ${w.type} | Duration: ${w.distanceDuration} | Instructions: ${w.targetInstructions}`).join('\n')}

Existing Macrocycle Plan:
${JSON.stringify(profile?.macrocyclePlan || [], null, 2)}

Generate the following:
1. 'healthInsights' object with 'movementTip', 'hydrationRecovery', and 'nutritionHeuristics' (restDay, lightActivity, hardActivity meals and calories).
2. 'jitPreparationTip' for EACH workout ID listed above.
3. 'macrocyclePlan': An array updating their Existing Macrocycle Plan. Preserve the original 'phase' and 'theme' verbatim. Provide a 'simpleDescription' (1-2 sentences, laymens terms) and a 'detailedDescription' (rich paragraph detailing the physiological intent). Append an 'expectedDurationWeeks' to each phase. If the user's tier is 'recreational' (Consistent/Get Healthy), the ENTIRE journey across all phases MUST NOT exceed 12 weeks total.
4. 'overarchingTheme': A string representing the user's primary focus for the entire journey.

Return ONLY a valid JSON object matching exactly this structure without any markdown wrappers or text:
{
  "healthInsights": {
    "movementTip": "String",
    "hydrationRecovery": "String",
    "nutritionHeuristics": {
      "restDay": "String",
      "lightActivity": "String",
      "hardActivity": "String"
    }
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
            const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            parsedData = JSON.parse(cleaned);
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
    timeoutSeconds: 60
}, async (request) => {
    const { phaseIndex, profile, history, simpleMode } = request.data;
    
    const ai = new GoogleGenerativeAI(geminiApiKey.value());
    
    // Construct the context prompt with the rich profile and historical data
    let historyContext = "No recent history available.";
    if (history && history.length > 0) {
        historyContext = history.map(h => 
            `- ${h.workoutTitle} (${h.distanceDuration}): target=${h.targetPaceZone || 'N/A'}, actual=${h.actualLoggedPace || 'N/A'}, RPE=${h.rpeScore || 'N/A'}${h.userWorkoutNotes ? `, Notes: "${h.userWorkoutNotes}"` : ''}`
        ).join("\n");
    }

    const equipmentString = simpleMode ? "None / Bodyweight (User requested Simple Mode)" : (profile?.equipmentList && profile.equipmentList.length > 0 ? profile.equipmentList.join(', ') : 'None / Bodyweight');

    const prompt = `You are a professional elite running coach AI and health nutritionist.
User Profile:
- Age: ${profile?.age || 'Unknown'}, Weight: ${profile?.weight || 'Unknown'} lbs, Height: ${profile?.heightInches || 'Unknown'} inches, Sex: ${profile?.sex || 'Unknown'}
- Fitness Level: ${profile?.fitnessLevel || 'Unknown'}
- Primary Goal: ${profile?.primaryGoal || 'Unknown'}
- Days Available to Train: ${profile?.daysAvailable || 4}
- Include Strength Training: ${profile?.includeStrength ? 'Yes' : 'No'}
- Training Focus (Strength vs Cardio): ${profile?.trainingFocusRatio === 'auto' ? 'Determine optimal ratio based on BMI, weight, and fitness level. (e.g., heavier beginners should focus on walking before loading joints with strength).' : profile?.trainingFocusRatio + '/100 (0=Heavy Strength, 100=Heavy Cardio)'}
- Available Equipment: ${equipmentString}
- Deep Motivation (Why?): ${profile?.why || 'N/A'}
- Additional Notes: ${profile?.notes || 'None'}
${profile?.primaryGoal === 'race' ? `- Goal Pace: ${profile?.activeAdjustedGoal || 'N/A'} min/mi` : ''}

Recent Workout History:
${historyContext}

${profile?.macrocyclePlan ? `\nOverarching Macrocycle Plan:\n${JSON.stringify(profile.macrocyclePlan, null, 2)}\n(Use this to maintain narrative context for the current phase)` : ''}

The user is entering Macrocycle Phase ${phaseIndex || 1}.

1. Generate a 7-day workout block that precisely fits their Days Available to Train (use "rest" type for the remaining days).
If strength training is Yes, include at least 1-2 "strength" workouts.
You may utilize "Same-Day Stacking" (e.g., one run and one strength) to the same 'sequenceOrder' (1 through 7) so that their rest days are truly restorative. IMPORTANT: When stacking, you MUST create two completely separate workout objects in the JSON array (one for the run, one for the strength) with the same sequenceOrder. DO NOT combine a run and a strength routine into a single workout title or object.
For strength workouts, also generate 1 to 3 specific Strength Guides for the week.
Assign a unique 'id' to each generated strength guide (e.g., "A", "B", "C").
Set the 'strengthGuideReference' of the strength workout to match the EXACT 'id' of the guide you generated.

2. Attach a 'jitPreparationTip' to EVERY workout object (including rest days). This tip should instruct the user on what to do *the day before* or *the hours leading up to* this specific workout to prepare/fuel/recover.

3. Internally calculate their BMR using the Mifflin-St Jeor formula and formulate a daily calorie goal that supports steady progress. IMPORTANT: Stick to these maximum weight loss guardrails: If weight >= 250 lbs, max loss is 1.0%-1.5% (2.5-3.5 lbs/week). If weight 180-240 lbs, max loss is 0.5%-1.0% (1.0-2.0 lbs/week). If weight < 180 lbs, max loss is 0.25%-0.5% (0.5-1.0 lbs/week). Do not exceed these rates when formulating the daily calorie goal. Generate simple meal examples categorized into 'restDay', 'lightActivity', and 'hardActivity'. If the user provided custom notes ('gatewayOverrideNotes'), heavily adapt the upcoming workouts.
4. Evaluate their recent history and determine if they missed days/took extra rest. Use this context to scale intensity or volume for the new block.
5. CRITICAL: For any "work" activities (especially Strength Circuits or Intervals), ensure the "sets" property is explicitly defined as a Number. Determine the optimal number of sets (whether 1 set for active recovery/beginners, or 3-5 sets for advanced/hypertrophy) based carefully on the user's fitness level, goals, and history. Be intentional and consistent with this prescription.
6. If a work activity is a circuit (e.g. Strength Circuit A), explicitly set "isCircuit" to true and specify the number of rounds in "circuitRounds". For non-circuit activities, set them to false and 0.

Return ONLY a valid JSON object exactly in this format without any markdown wrappers or additional text:
{
  "workouts": [
    {
      "id": "act-X",
      "phaseNumber": ${phaseIndex || 1},
      "sequenceOrder": 1,
      "workoutTitle": "String",
      "type": "String (walk, easy, strength, rest, fast)",
      "isSpeedWorkout": Boolean,
      "isBenchmark": Boolean,
      "targetDistance": "Number (Target distance in miles, if applicable, e.g., 3.0 or 4.5)",
      "targetDuration": "Number (Target duration in minutes, if applicable, e.g., 45 or 60)",
      "targetInstructions": "String (Keep under 100 characters)",
      "targetPaceZone": "String (For walking: use Easy Walk, Brisk Walk, Power Walk. For running: easy, goal, tempo, long, or null)",
      "jitPreparationTip": "String (Actionable prep/fueling tip for THIS workout)",
      "strengthGuideReference": "String (The exact 'id' of the strength guide, e.g., 'A', else null)",
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
    "nutritionHeuristics": {
      "restDay": "String",
      "lightActivity": "String",
      "hardActivity": "String"
    }
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
            const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            parsedData = JSON.parse(cleaned);
        }
        
        let workouts = parsedData.workouts || parsedData;
        if (!Array.isArray(workouts)) workouts = [];
        
        workouts = workouts.map((w, index) => ({
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

    const ai = new GoogleGenerativeAI(geminiApiKey.value());
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
CRITICAL: The overarching theme and all descriptions MUST explicitly reflect the exact ${timelineInstruction} span. DO NOT generate a plan that spans longer or shorter than this explicit timeline.
Generate an overarching theme for the entire training block, and an array of training phases.

Additionally, generate two arrays for the user to guide their mindset and behavior:
1. "processGoals": Array of 2-3 behavioral, process-oriented daily/weekly targets tailored to their weight, available days, and equipment. For beginners getting healthy, this is their north star. (e.g. "Complete 3 intentional movement sessions every week", "Hit 7000 steps on off days", "Keep calories under 2400 to support safe weight loss").
2. "letsBeReal": Array of up to 5 blunt, no-nonsense rules for success. CRITICAL INSTRUCTION: You MUST align these with the Just-In-Time (JIT) mentality and the core philosophy: "You can suck, but you can't skip." Meaning, encourage them to modify or shorten a workout if they are busy/tired, but doing zero is unacceptable. The language should be encouraging but firm and real.

Return ONLY a valid JSON object exactly matching this structure without any markdown wrappers or text:
{
  "overarchingTheme": "String (e.g. 'From Couch to 5K - A Journey of Consistency')",
  "macrocyclePlan": [
    {
      "phase": 1,
      "theme": "String (e.g. 'Baseline Establishment')",
      "simpleDescription": "String (1-2 sentences max about that stage, just the basics, in laymens terms)",
      "detailedDescription": "String (Full details, can be about a paragraph in length, detailing the physiological intent of the phase)",
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
            const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            planData = JSON.parse(cleaned);
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
    
    const ai = new GoogleGenerativeAI(geminiApiKey.value());
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
            const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            parsedData = JSON.parse(cleaned);
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

    const ai = new GoogleGenerativeAI(geminiApiKey.value());
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
            const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            planData = JSON.parse(cleaned);
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
    
    const ai = new GoogleGenerativeAI(geminiApiKey.value());
    
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
            const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            workoutData = JSON.parse(cleaned);
        }
        
        return workoutData;
    } catch (error) {
        console.error("Error generating secondary workout:", error);
        throw new HttpsError("internal", "Failed to generate secondary workout.", error.message);
    }
});
