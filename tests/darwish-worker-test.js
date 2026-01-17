/**
 * darwish-worker-test.js
 * 
 * Test harness for DarwishWorker biophysical model
 * Validates math before Matter.js integration
 */

const DarwishWorker = require('./DarwishWorker.js');

// ========================================================================
// TEST CONFIGURATION
// ========================================================================

const TEST_CONFIG = {
  // Gemini's specified parameters
  fatigueRate: 0.0097,
  recoveryRate: 0.0009,
  minCapacity: 0.10,
  criticalThreshold: 0.70,
  initialCapacity: 1.0
};

// ========================================================================
// TEST 1: 8-Hour Traditional Shift
// ========================================================================

function test8HourShift() {
  console.log('='.repeat(60));
  console.log('TEST 1: Traditional 8-Hour Shift');
  console.log('='.repeat(60));
  
  const worker = new DarwishWorker({
    id: 'worker-8hr',
    ...TEST_CONFIG
  });
  
  // Schedule: 4 hours work, 30 min break, 4 hours work
  const schedule = [
    { type: 'work', duration: 240 },   // 4 hours (240 min)
    { type: 'rest', duration: 30 },    // 30 min break
    { type: 'work', duration: 240 }    // 4 hours
  ];
  
  let tick = 0;
  const samplePoints = [];
  
  schedule.forEach(session => {
    const isWorking = session.type === 'work';
    
    for (let i = 0; i < session.duration; i++) {
      const state = worker.tick(isWorking, 1); // 1 minute per tick
      tick++;
      
      // Sample every 30 minutes
      if (tick % 30 === 0) {
        samplePoints.push({
          time: tick,
          capacity: state.capacity,
          performance: state.performanceMultiplier,
          state: state.state
        });
      }
    }
  });
  
  // Print results
  console.log('\nTime-series samples (every 30 min):');
  console.log('Time (min) | Capacity | Performance | State');
  console.log('-'.repeat(55));
  
  samplePoints.forEach(point => {
    console.log(
      `${point.time.toString().padStart(10)} | ` +
      `${point.capacity.toFixed(3).padStart(8)} | ` +
      `${point.performance.toFixed(3).padStart(11)} | ` +
      `${point.state}`
    );
  });
  
  // Summary
  const summary = worker.getSummary();
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log(`Average Capacity: ${summary.avgCapacity.toFixed(3)}`);
  console.log(`Minimum Capacity: ${summary.minCapacity.toFixed(3)}`);
  console.log(`Maximum Fatigue: ${summary.maxFatigue.toFixed(3)}`);
  console.log(`Time in Critical Zone: ${summary.timeInCriticalZone} minutes`);
  console.log(`Emergency Shutdowns: ${summary.emergencyShutdowns}`);
  console.log(`Safety Violation: ${summary.violatedMinCapacity ? 'YES' : 'NO'}`);
  console.log('='.repeat(60) + '\n');
  
  return summary;
}

// ========================================================================
// TEST 2: 6-Hour Darwish Optimal Shift
// ========================================================================

function test6HourOptimalShift() {
  console.log('='.repeat(60));
  console.log('TEST 2: Darwish Optimal 6-Hour Shift');
  console.log('='.repeat(60));
  
  const worker = new DarwishWorker({
    id: 'worker-6hr',
    ...TEST_CONFIG
  });
  
  // Schedule: 3 hours work, 30 min break, 3 hours work
  const schedule = [
    { type: 'work', duration: 180 },   // 3 hours
    { type: 'rest', duration: 30 },    // 30 min break
    { type: 'work', duration: 180 }    // 3 hours
  ];
  
  let tick = 0;
  const samplePoints = [];
  
  schedule.forEach(session => {
    const isWorking = session.type === 'work';
    
    for (let i = 0; i < session.duration; i++) {
      const state = worker.tick(isWorking, 1);
      tick++;
      
      if (tick % 30 === 0) {
        samplePoints.push({
          time: tick,
          capacity: state.capacity,
          performance: state.performanceMultiplier,
          state: state.state
        });
      }
    }
  });
  
  // Print results
  console.log('\nTime-series samples (every 30 min):');
  console.log('Time (min) | Capacity | Performance | State');
  console.log('-'.repeat(55));
  
  samplePoints.forEach(point => {
    console.log(
      `${point.time.toString().padStart(10)} | ` +
      `${point.capacity.toFixed(3).padStart(8)} | ` +
      `${point.performance.toFixed(3).padStart(11)} | ` +
      `${point.state}`
    );
  });
  
  // Summary
  const summary = worker.getSummary();
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log(`Average Capacity: ${summary.avgCapacity.toFixed(3)}`);
  console.log(`Minimum Capacity: ${summary.minCapacity.toFixed(3)}`);
  console.log(`Maximum Fatigue: ${summary.maxFatigue.toFixed(3)}`);
  console.log(`Time in Critical Zone: ${summary.timeInCriticalZone} minutes`);
  console.log(`Emergency Shutdowns: ${summary.emergencyShutdowns}`);
  console.log(`Safety Violation: ${summary.violatedMinCapacity ? 'YES' : 'NO'}`);
  console.log('='.repeat(60) + '\n');
  
  return summary;
}

// ========================================================================
// TEST 3: 4-Hour HIGH-OCTANE Sprint
// ========================================================================

function test4HourSprint() {
  console.log('='.repeat(60));
  console.log('TEST 3: HIGH-OCTANE 4-Hour Sprint');
  console.log('='.repeat(60));
  
  const worker = new DarwishWorker({
    id: 'worker-4hr',
    ...TEST_CONFIG
  });
  
  // Schedule: 2 hours work, 30 min break, 2 hours work
  const schedule = [
    { type: 'work', duration: 120 },   // 2 hours
    { type: 'rest', duration: 30 },    // 30 min break
    { type: 'work', duration: 120 }    // 2 hours
  ];
  
  let tick = 0;
  const samplePoints = [];
  
  schedule.forEach(session => {
    const isWorking = session.type === 'work';
    
    for (let i = 0; i < session.duration; i++) {
      const state = worker.tick(isWorking, 1);
      tick++;
      
      if (tick % 30 === 0) {
        samplePoints.push({
          time: tick,
          capacity: state.capacity,
          performance: state.performanceMultiplier,
          state: state.state
        });
      }
    }
  });
  
  // Print results
  console.log('\nTime-series samples (every 30 min):');
  console.log('Time (min) | Capacity | Performance | State');
  console.log('-'.repeat(55));
  
  samplePoints.forEach(point => {
    console.log(
      `${point.time.toString().padStart(10)} | ` +
      `${point.capacity.toFixed(3).padStart(8)} | ` +
      `${point.performance.toFixed(3).padStart(11)} | ` +
      `${point.state}`
    );
  });
  
  // Summary
  const summary = worker.getSummary();
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log(`Average Capacity: ${summary.avgCapacity.toFixed(3)}`);
  console.log(`Minimum Capacity: ${summary.minCapacity.toFixed(3)}`);
  console.log(`Maximum Fatigue: ${summary.maxFatigue.toFixed(3)}`);
  console.log(`Time in Critical Zone: ${summary.timeInCriticalZone} minutes`);
  console.log(`Emergency Shutdowns: ${summary.emergencyShutdowns}`);
  console.log(`Safety Violation: ${summary.violatedMinCapacity ? 'YES' : 'NO'}`);
  console.log('='.repeat(60) + '\n');
  
  return summary;
}

// ========================================================================
// TEST 4: Comparison Summary
// ========================================================================

function runAllTests() {
  const results = {
    test8Hour: test8HourShift(),
    test6Hour: test6HourOptimalShift(),
    test4Hour: test4HourSprint()
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('COMPARATIVE ANALYSIS');
  console.log('='.repeat(60));
  
  console.log('\nSchedule Comparison:');
  console.log('Metric              | 8-Hour   | 6-Hour   | 4-Hour');
  console.log('-'.repeat(60));
  
  console.log(
    `Avg Capacity        | ${results.test8Hour.avgCapacity.toFixed(3).padStart(8)} | ` +
    `${results.test6Hour.avgCapacity.toFixed(3).padStart(8)} | ` +
    `${results.test4Hour.avgCapacity.toFixed(3)}`
  );
  
  console.log(
    `Min Capacity        | ${results.test8Hour.minCapacity.toFixed(3).padStart(8)} | ` +
    `${results.test6Hour.minCapacity.toFixed(3).padStart(8)} | ` +
    `${results.test4Hour.minCapacity.toFixed(3)}`
  );
  
  console.log(
    `Critical Zone (min) | ${results.test8Hour.timeInCriticalZone.toString().padStart(8)} | ` +
    `${results.test6Hour.timeInCriticalZone.toString().padStart(8)} | ` +
    `${results.test4Hour.timeInCriticalZone.toString()}`
  );
  
  console.log(
    `Safety Violations   | ${(results.test8Hour.violatedMinCapacity ? 'YES' : 'NO').padStart(8)} | ` +
    `${(results.test6Hour.violatedMinCapacity ? 'YES' : 'NO').padStart(8)} | ` +
    `${results.test4Hour.violatedMinCapacity ? 'YES' : 'NO'}`
  );
  
  console.log('='.repeat(60));
  
  console.log('\n✅ VALIDATION COMPLETE\n');
  console.log('KEY FINDINGS:');
  console.log(`  • 8-hour shifts spend ${results.test8Hour.timeInCriticalZone} min in CRITICAL zone`);
  console.log(`  • 6-hour shifts spend ${results.test6Hour.timeInCriticalZone} min in CRITICAL zone`);
  console.log(`  • 4-hour sprints spend ${results.test4Hour.timeInCriticalZone} min in CRITICAL zone`);
  console.log(`  • Capacity degradation: 8hr (${(1-results.test8Hour.minCapacity).toFixed(1)}%) vs 4hr (${(1-results.test4Hour.minCapacity).toFixed(1)}%)`);
}

// ========================================================================
// RUN ALL TESTS
// ========================================================================

runAllTests();
