/**
 * validator.js
 * 
 * High-fidelity benchmarking script for DarwishWorker
 * Validates implementation against pure Darwish (2023) mathematics
 * 
 * GOAL: Mean Absolute Error (MAE) < 0.001
 * 
 * This proves the code is a faithful implementation of peer-reviewed research
 */

const DarwishWorker = require('./DarwishWorker.js');

// ========================================================================
// CONFIGURATION
// ========================================================================

const VALIDATION_CONFIG = {
  // Test parameters
  timeSteps: 1000,              // Number of simulation ticks
  deltaTime: 1,                 // Time per tick (1 minute)
  maeThreshold: 0.001,          // Maximum acceptable error
  
  // Biophysical parameters (matching DarwishWorker defaults)
  fatigueRate: 0.0097,          // λ: fatigue growth rate
  recoveryRate: 0.0009,         // μ: recovery decay rate
  minCapacity: 0.10,            // γ_min: biological floor
  criticalThreshold: 0.70,      // Critical zone threshold
  initialCapacity: 1.0,         // Starting capacity (unfatigued)
  
  // Test schedule: 4hr work, 30min break, 4hr work, rest
  schedule: [
    { type: 'work', duration: 240 },   // Session 1: 240 minutes
    { type: 'rest', duration: 30 },    // Break 1: 30 minutes
    { type: 'work', duration: 240 },   // Session 2: 240 minutes
    { type: 'rest', duration: 490 }    // End-of-day rest
  ]
};

// ========================================================================
// PURE MATHEMATICAL FORMULAS (Ground Truth)
// ========================================================================

/**
 * Calculate theoretical fatigue using pure Darwish mathematics
 * Darwish Equation (2): F(t) = 1 - (1 - F_0)e^(-λt)
 * 
 * @param {number} timeInSession - Time elapsed in current work session
 * @param {number} initialFatigue - Fatigue at session start
 * @param {number} fatigueRate - λ parameter
 * @returns {number} Theoretical fatigue level
 */
function pureCalculateFatigueGrowth(timeInSession, initialFatigue, fatigueRate) {
  return 1 - (1 - initialFatigue) * Math.exp(-fatigueRate * timeInSession);
}

/**
 * Calculate theoretical recovery using pure Darwish mathematics
 * Darwish Equation (4): R(t) = F_i(Δ_i)e^(-μ(t-Δ_i))
 * 
 * @param {number} timeInRest - Time elapsed in current rest period
 * @param {number} fatigueAtRestStart - Fatigue when rest began
 * @param {number} recoveryRate - μ parameter
 * @returns {number} Theoretical fatigue level after recovery
 */
function pureCalculateFatigueDecay(timeInRest, fatigueAtRestStart, recoveryRate) {
  return fatigueAtRestStart * Math.exp(-recoveryRate * timeInRest);
}

/**
 * Generate "Golden Data" - theoretical capacity values for 1000 time-steps
 * using pure mathematical formulas from Darwish (2023)
 * 
 * @param {Object} config - Validation configuration
 * @returns {Array} Array of theoretical capacity values
 */
function generateGoldenData(config) {
  const goldenData = [];
  
  // State tracking for pure math simulation
  let currentCapacity = config.initialCapacity;
  let currentFatigue = 1 - currentCapacity;
  let sessionStartFatigue = currentFatigue;
  let sessionStartTime = 0;
  let isWorking = false;
  let tick = 0;
  
  // Iterate through schedule
  config.schedule.forEach(session => {
    const isWorkSession = session.type === 'work';
    
    // Reset session tracking on state change
    if (isWorkSession !== isWorking) {
      sessionStartFatigue = currentFatigue;
      sessionStartTime = 0;
      isWorking = isWorkSession;
    }
    
    // Simulate each minute in this session
    for (let i = 0; i < session.duration && tick < config.timeSteps; i++) {
      sessionStartTime += config.deltaTime;
      
      // Calculate fatigue using pure mathematics
      if (isWorking) {
        currentFatigue = pureCalculateFatigueGrowth(
          sessionStartTime,
          sessionStartFatigue,
          config.fatigueRate
        );
      } else {
        currentFatigue = pureCalculateFatigueDecay(
          sessionStartTime,
          sessionStartFatigue,
          config.recoveryRate
        );
      }
      
      // Convert to capacity and clamp to [0, 1]
      currentCapacity = Math.max(0, Math.min(1, 1 - currentFatigue));
      
      // Record golden data point
      goldenData.push({
        tick: tick,
        time: tick * config.deltaTime,
        capacity: currentCapacity,
        fatigue: currentFatigue,
        isWorking: isWorking,
        sessionTime: sessionStartTime
      });
      
      tick++;
    }
  });
  
  return goldenData;
}

/**
 * Run live simulation using DarwishWorker class
 * 
 * @param {Object} config - Validation configuration
 * @returns {Array} Array of simulated capacity values
 */
function runLiveSimulation(config) {
  const liveData = [];
  
  // Initialize worker
  const worker = new DarwishWorker({
    id: 'validator-worker',
    fatigueRate: config.fatigueRate,
    recoveryRate: config.recoveryRate,
    minCapacity: config.minCapacity,
    criticalThreshold: config.criticalThreshold,
    initialCapacity: config.initialCapacity
  });
  
  let tick = 0;
  
  // Run simulation through schedule
  config.schedule.forEach(session => {
    const isWorking = session.type === 'work';
    
    for (let i = 0; i < session.duration && tick < config.timeSteps; i++) {
      const state = worker.tick(isWorking, config.deltaTime);
      
      liveData.push({
        tick: tick,
        time: tick * config.deltaTime,
        capacity: state.capacity,
        fatigue: state.fatigue,
        isWorking: state.isWorking,
        sessionTime: state.sessionTime
      });
      
      tick++;
    }
  });
  
  return liveData;
}

// ========================================================================
// STATISTICAL ANALYSIS
// ========================================================================

/**
 * Calculate Mean Absolute Error between golden data and live simulation
 * 
 * @param {Array} goldenData - Theoretical values
 * @param {Array} liveData - Simulated values
 * @returns {Object} Statistical metrics
 */
function calculateStatistics(goldenData, liveData) {
  if (goldenData.length !== liveData.length) {
    throw new Error(`Data length mismatch: Golden (${goldenData.length}) vs Live (${liveData.length})`);
  }
  
  let sumAbsoluteError = 0;
  let sumSquaredError = 0;
  let maxError = 0;
  let maxErrorTick = 0;
  
  const errors = [];
  
  for (let i = 0; i < goldenData.length; i++) {
    const goldenCapacity = goldenData[i].capacity;
    const liveCapacity = liveData[i].capacity;
    
    const absoluteError = Math.abs(goldenCapacity - liveCapacity);
    const squaredError = Math.pow(goldenCapacity - liveCapacity, 2);
    
    sumAbsoluteError += absoluteError;
    sumSquaredError += squaredError;
    
    if (absoluteError > maxError) {
      maxError = absoluteError;
      maxErrorTick = i;
    }
    
    errors.push({
      tick: i,
      golden: goldenCapacity,
      live: liveCapacity,
      error: absoluteError
    });
  }
  
  const n = goldenData.length;
  const mae = sumAbsoluteError / n;
  const rmse = Math.sqrt(sumSquaredError / n);
  
  return {
    mae: mae,
    rmse: rmse,
    maxError: maxError,
    maxErrorTick: maxErrorTick,
    dataPoints: n,
    errors: errors
  };
}

/**
 * Display variance check results
 * 
 * @param {Object} stats - Statistical metrics
 * @param {number} threshold - MAE threshold for success
 */
function displayResults(stats, threshold) {
  console.log('='.repeat(70));
  console.log('DARWISH VALIDATOR: High-Fidelity Benchmarking Results');
  console.log('='.repeat(70));
  console.log();
  
  console.log('📊 STATISTICAL ANALYSIS:');
  console.log('-'.repeat(70));
  console.log(`Data Points:            ${stats.dataPoints.toLocaleString()}`);
  console.log(`Mean Absolute Error:    ${stats.mae.toFixed(6)} (threshold: ${threshold})`);
  console.log(`Root Mean Square Error: ${stats.rmse.toFixed(6)}`);
  console.log(`Maximum Error:          ${stats.maxError.toFixed(6)} at tick ${stats.maxErrorTick}`);
  console.log();
  
  // Determine pass/fail
  const passed = stats.mae < threshold;
  
  if (passed) {
    console.log('✅ VALIDATION PASSED');
    console.log('='.repeat(70));
    console.log(`MAE ${stats.mae.toFixed(6)} < ${threshold} ✓`);
    console.log();
    console.log('CONCLUSION:');
    console.log('  DarwishWorker is a high-fidelity implementation of Darwish (2023)');
    console.log('  mathematical model. Code matches peer-reviewed research formulas');
    console.log('  with precision suitable for academic publication.');
  } else {
    console.log('❌ VALIDATION FAILED');
    console.log('='.repeat(70));
    console.log(`MAE ${stats.mae.toFixed(6)} >= ${threshold} ✗`);
    console.log();
    console.log('ISSUE:');
    console.log('  Implementation diverges from pure mathematical formulas.');
    console.log('  Review calculation methods in DarwishWorker class.');
  }
  
  console.log('='.repeat(70));
  console.log();
}

/**
 * Display sample comparisons at key time points
 * 
 * @param {Array} goldenData - Theoretical values
 * @param {Array} liveData - Simulated values
 */
function displaySampleComparisons(goldenData, liveData) {
  console.log('📋 SAMPLE COMPARISONS (every 100 ticks):');
  console.log('-'.repeat(70));
  console.log('Tick | Golden Cap | Live Cap   | Error      | State');
  console.log('-'.repeat(70));
  
  for (let i = 0; i < goldenData.length; i += 100) {
    const golden = goldenData[i];
    const live = liveData[i];
    const error = Math.abs(golden.capacity - live.capacity);
    const state = live.isWorking ? 'WORK' : 'REST';
    
    console.log(
      `${golden.tick.toString().padStart(4)} | ` +
      `${golden.capacity.toFixed(6)} | ` +
      `${live.capacity.toFixed(6)} | ` +
      `${error.toFixed(6)} | ` +
      `${state}`
    );
  }
  
  console.log('-'.repeat(70));
  console.log();
}

/**
 * Export detailed error analysis to CSV
 * 
 * @param {Object} stats - Statistical metrics
 * @param {string} filename - Output filename
 */
function exportErrorAnalysis(stats, filename = 'validation_errors.csv') {
  const fs = require('fs');
  
  let csv = 'Tick,Golden_Capacity,Live_Capacity,Absolute_Error\n';
  
  stats.errors.forEach(point => {
    csv += `${point.tick},${point.golden.toFixed(8)},${point.live.toFixed(8)},${point.error.toFixed(8)}\n`;
  });
  
  fs.writeFileSync(filename, csv);
  console.log(`📁 Detailed error analysis exported to: ${filename}`);
  console.log();
}

/**
 * Generate visual error distribution histogram
 * 
 * @param {Object} stats - Statistical metrics
 */
function displayErrorDistribution(stats) {
  console.log('📈 ERROR DISTRIBUTION:');
  console.log('-'.repeat(70));
  
  // Create bins
  const bins = [
    { range: '< 0.0001', count: 0, min: 0, max: 0.0001 },
    { range: '0.0001 - 0.0005', count: 0, min: 0.0001, max: 0.0005 },
    { range: '0.0005 - 0.001', count: 0, min: 0.0005, max: 0.001 },
    { range: '0.001 - 0.005', count: 0, min: 0.001, max: 0.005 },
    { range: '> 0.005', count: 0, min: 0.005, max: Infinity }
  ];
  
  // Categorize errors
  stats.errors.forEach(point => {
    for (let bin of bins) {
      if (point.error >= bin.min && point.error < bin.max) {
        bin.count++;
        break;
      }
    }
  });
  
  // Display histogram
  const maxCount = Math.max(...bins.map(b => b.count));
  const barWidth = 50;
  
  bins.forEach(bin => {
    const percentage = (bin.count / stats.dataPoints * 100).toFixed(1);
    const barLength = Math.round((bin.count / maxCount) * barWidth);
    const bar = '█'.repeat(barLength);
    
    console.log(
      `${bin.range.padEnd(18)} | ${bar} ${bin.count} (${percentage}%)`
    );
  });
  
  console.log('-'.repeat(70));
  console.log();
}

// ========================================================================
// MAIN VALIDATION ROUTINE
// ========================================================================

function runValidation() {
  console.log('\n🔬 STARTING DARWISH VALIDATION STRESS TEST\n');
  console.log('Configuration:');
  console.log(`  Time Steps: ${VALIDATION_CONFIG.timeSteps.toLocaleString()}`);
  console.log(`  Fatigue Rate (λ): ${VALIDATION_CONFIG.fatigueRate}`);
  console.log(`  Recovery Rate (μ): ${VALIDATION_CONFIG.recoveryRate}`);
  console.log(`  MAE Threshold: ${VALIDATION_CONFIG.maeThreshold}`);
  console.log();
  
  // Step 1: Generate Golden Data
  console.log('⚙️  Step 1: Generating Golden Data (Pure Mathematics)...');
  const startGolden = Date.now();
  const goldenData = generateGoldenData(VALIDATION_CONFIG);
  const timeGolden = Date.now() - startGolden;
  console.log(`   ✓ Generated ${goldenData.length} theoretical data points in ${timeGolden}ms`);
  console.log();
  
  // Step 2: Run Live Simulation
  console.log('⚙️  Step 2: Running Live Simulation (DarwishWorker)...');
  const startLive = Date.now();
  const liveData = runLiveSimulation(VALIDATION_CONFIG);
  const timeLive = Date.now() - startLive;
  console.log(`   ✓ Simulated ${liveData.length} time steps in ${timeLive}ms`);
  console.log();
  
  // Step 3: Calculate Statistics
  console.log('⚙️  Step 3: Calculating Variance...');
  const stats = calculateStatistics(goldenData, liveData);
  console.log(`   ✓ Computed statistics across ${stats.dataPoints} data points`);
  console.log();
  
  // Display Results
  displayResults(stats, VALIDATION_CONFIG.maeThreshold);
  displaySampleComparisons(goldenData, liveData);
  displayErrorDistribution(stats);
  
  // Export detailed analysis
  try {
    exportErrorAnalysis(stats);
  } catch (err) {
    console.log('⚠️  Could not export CSV (filesystem may not be available)');
    console.log();
  }
  
  // Performance metrics
  console.log('⚡ PERFORMANCE METRICS:');
  console.log('-'.repeat(70));
  console.log(`Pure Math Calculation:  ${timeGolden}ms`);
  console.log(`Live Simulation:        ${timeLive}ms`);
  console.log(`Overhead:               ${((timeLive/timeGolden - 1) * 100).toFixed(1)}%`);
  console.log('-'.repeat(70));
  console.log();
  
  // Return validation result
  return {
    passed: stats.mae < VALIDATION_CONFIG.maeThreshold,
    stats: stats,
    goldenData: goldenData,
    liveData: liveData
  };
}

// ========================================================================
// RUN VALIDATION
// ========================================================================

const validationResult = runValidation();

// Export for programmatic use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runValidation,
    generateGoldenData,
    runLiveSimulation,
    calculateStatistics,
    VALIDATION_CONFIG
  };
}
