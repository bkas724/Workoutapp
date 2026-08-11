const fs = require('fs');
let code = fs.readFileSync('public/js/workout-logging.js', 'utf8');

const targetStr = `            }).then(() => {
                console.log("Quick completed workout:", activityId);
                fetchActivePhaseWorkouts(userId).then(workouts => {
                    activePhaseWorkouts = workouts;
                    renderNextActivityCard();
                    renderPhaseRoadmap(workouts);
                });
            }).catch(err => {`;

const replacementStr = `            }).then(() => {
                console.log("Quick completed workout:", activityId);
            }).catch(err => {`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('public/js/workout-logging.js', code);
    console.log('Fixed quickCompleteWorkout');
} else {
    console.log('Target string not found!');
}
