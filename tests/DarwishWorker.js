/**
 * DarwishWorker.js
 * 
 * Standalone biophysical fatigue model based on Darwish (2023)
 * "Optimal workday length considering worker fatigue and employer profit"
 * 
 * Implements exponential fatigue accumulation and recovery with
 * physiological constraints. Pure logic - no rendering dependencies.
 * 
 * @author Derek (HIGH-OCTANE Project)
 * @version 1.0.0
 * @date 2026-01-15
 */

class DarwishWorker {
  /**
   * Initialize worker with biophysical parameters
   * 
   * @param {Object} config - Worker configuration
   * @param {number} config.id - Unique worker identifier
   * @param {number} config.fatigueRate - Fatigue accumulation rate (λ)
   * @param {number} config.recoveryRate - Fatigue recovery rate (μ)
   * @param {number} config.minCapacity - Minimum safe capacity threshold (γ_min)
   * @param {number} config.initialCapacity - Starting capacity (default: 1.0)
   * @param {number} config.criticalThreshold - Emergency shutdown threshold (default: 0.7)
   */
  constructor(config = {}) {
    // Identity
    this.id = config.id || Math.random().toString(36).substr(2, 9);
    
    // Biophysical Parameters (from Gemini's specification)
    this.fatigueRate = config.fatigueRate || 0.0097;      // λ: fatigue growth
    this.recoveryRate = config.recoveryRate || 0.0009;    // μ: recovery decay
    this.minCapacity = config.minCapacity || 0.10;        // γ_min: biological floor
    this.criticalThreshold = config.criticalThreshold || 0.70; // Emergency threshold
    
    // Darwish Model Mapping
    // Capacity (C) = 1 - Fatigue (F)
    // Therefore: F = 1 - C
    this.initialCapacity = config.initialCapacity || 1.0;
    
    // State Variables
    this.capacity = this.initialCapacity;                 // Current capacity (0 to 1)
    this.fatigue = 1 - this.capacity;                     // Current fatigue level
    this.isWorking = false;                               // Work state flag
    this.sessionStartTime = 0;                            // When current session began
    this.sessionStartCapacity = this.initialCapacity;     // Capacity at session start
    this.totalWorkTime = 0;                               // Cumulative work time
    this.totalRestTime = 0;                               // Cumulative rest time
    this.emergencyShutdowns = 0;                          // Count of critical failures
    
    // Session Tracking
    this.currentSession = 1;                              // Session number
    this.sessionType = 'work';                            // 'work' or 'rest'
    
    // Performance Metrics
    this.performanceMultiplier = 1.0;                     // Output scaling factor
    this.productivityHistory = [];                        // Time-series data
    
    // Validation Flags
    this.hasViolatedMinCapacity = false;                  // Safety violation flag
    this.timeInCriticalZone = 0;                          // Duration in danger zone
  }
  
  // ========================================================================
  // CORE BIOPHYSICAL MODEL
  // ========================================================================
  
  /**
   * Calculate fatigue accumulation during work
   * Based on Darwish Equation (2): F(t) = 1 - (1 - F_0)e^(-λt)
   * 
   * @param {number} timeInSession - Elapsed time in current work session
   * @returns {number} Fatigue level (0 to 1)
   */
  calculateFatigueDuringWork(timeInSession) {
    const initialFatigue = 1 - this.sessionStartCapacity;
    
    // Exponential fatigue growth
    const fatigue = 1 - (1 - initialFatigue) * Math.exp(-this.fatigueRate * timeInSession);
    
    // Biological ceiling: fatigue cannot exceed 1.0
    return Math.min(fatigue, 1.0);
  }
  
  /**
   * Calculate fatigue recovery during rest
   * Based on Darwish Equation (4): R(t) = F_i(Δ_i)e^(-μ(t-Δ_i))
   * 
   * @param {number} timeInRest - Elapsed time in current rest period
   * @returns {number} Fatigue level after recovery (0 to 1)
   */
  calculateFatigueDuringRest(timeInRest) {
    const fatigueAtRestStart = 1 - this.sessionStartCapacity;
    
    // Exponential fatigue decay
    const fatigue = fatigueAtRestStart * Math.exp(-this.recoveryRate * timeInRest);
    
    // Biological floor: fatigue cannot go below 0
    return Math.max(fatigue, 0);
  }
  
  /**
   * Calculate performance multiplier from capacity
   * Based on Darwish Equation (6): P(t) = P_0(1 - F(t))
   * 
   * This is the scaling factor for productivity/movement/output
   * 
   * @returns {number} Performance multiplier (0 to 1)
   */
  calculatePerformanceMultiplier() {
    // Direct mapping: performance = capacity
    // But we apply nonlinear scaling below critical threshold
    
    if (this.capacity >= this.criticalThreshold) {
      // Normal performance zone
      return this.capacity;
    } else if (this.capacity >= this.minCapacity) {
      // Degraded zone: nonlinear performance drop
      // Performance degrades faster than capacity in this range
      const degradationFactor = (this.capacity - this.minCapacity) / 
                                (this.criticalThreshold - this.minCapacity);
      return this.minCapacity + (degradationFactor * degradationFactor * 
                                 (this.criticalThreshold - this.minCapacity));
    } else {
      // Below minimum: system failure
      return 0;
    }
  }
  
  // ========================================================================
  // SIMULATION UPDATE METHOD (Called every frame)
  // ========================================================================
  
  /**
   * Update worker state for one simulation tick
   * 
   * This is the main method called by your simulation loop.
   * Pure biophysical calculation - no rendering logic.
   * 
   * @param {boolean} isWorking - True if worker should be working this tick
   * @param {number} deltaTime - Time step in simulation units (optional)
   * @returns {Object} State data for this tick
   */
  tick(isWorking, deltaTime = 1) {
    // Track state transition
    const wasWorking = this.isWorking;
    
    if (isWorking !== wasWorking) {
      // State change: reset session tracking
      this.sessionStartCapacity = this.capacity;
      this.sessionStartTime = 0;
      
      if (isWorking) {
        this.currentSession++;
        this.sessionType = 'work';
      } else {
        this.sessionType = 'rest';
      }
    }
    
    this.isWorking = isWorking;
    this.sessionStartTime += deltaTime;
    
    // Calculate new fatigue based on current state
    if (this.isWorking) {
      this.fatigue = this.calculateFatigueDuringWork(this.sessionStartTime);
      this.totalWorkTime += deltaTime;
    } else {
      this.fatigue = this.calculateFatigueDuringRest(this.sessionStartTime);
      this.totalRestTime += deltaTime;
    }
    
    // Convert fatigue back to capacity
    this.capacity = Math.max(1 - this.fatigue, 0);
    
    // Safety checks
    this.checkViolations();
    
    // Calculate performance multiplier
    this.performanceMultiplier = this.calculatePerformanceMultiplier();
    
    // Record metrics
    this.recordMetrics(deltaTime);
    
    // Return state snapshot
    return this.getState();
  }
  
  // ========================================================================
  // SAFETY & VALIDATION
  // ========================================================================
  
  /**
   * Check for biological constraint violations
   */
  checkViolations() {
    // Check minimum capacity threshold
    if (this.capacity < this.minCapacity) {
      if (!this.hasViolatedMinCapacity) {
        this.hasViolatedMinCapacity = true;
        this.emergencyShutdowns++;
      }
    }
    
    // Track time in critical zone
    if (this.capacity < this.criticalThreshold && this.isWorking) {
      this.timeInCriticalZone += 1; // Increment by tick
    }
  }
  
  /**
   * Check if worker is in safe operating range
   * 
   * @returns {boolean} True if capacity above minimum threshold
   */
  isSafe() {
    return this.capacity >= this.minCapacity;
  }
  
  /**
   * Check if worker is in critical zone
   * 
   * @returns {boolean} True if capacity below critical threshold
   */
  isCritical() {
    return this.capacity < this.criticalThreshold;
  }
  
  /**
   * Get current state classification
   * 
   * @returns {string} 'optimal', 'degraded', 'critical', or 'shutdown'
   */
  getStateClassification() {
    if (this.capacity < this.minCapacity) {
      return 'shutdown';  // Red alert
    } else if (this.capacity < this.criticalThreshold) {
      return 'critical';  // Red
    } else if (this.capacity < 0.7) {
      return 'degraded';  // Yellow
    } else {
      return 'optimal';   // Green
    }
  }
  
  // ========================================================================
  // METRICS & REPORTING
  // ========================================================================
  
  /**
   * Record current state for time-series analysis
   */
  recordMetrics(deltaTime) {
    this.productivityHistory.push({
      time: this.totalWorkTime + this.totalRestTime,
      capacity: this.capacity,
      fatigue: this.fatigue,
      performance: this.performanceMultiplier,
      state: this.getStateClassification(),
      isWorking: this.isWorking
    });
  }
  
  /**
   * Get current state snapshot
   * 
   * @returns {Object} Complete state data
   */
  getState() {
    return {
      id: this.id,
      
      // Biophysical State
      capacity: this.capacity,
      fatigue: this.fatigue,
      performanceMultiplier: this.performanceMultiplier,
      
      // Classification
      state: this.getStateClassification(),
      isWorking: this.isWorking,
      isSafe: this.isSafe(),
      isCritical: this.isCritical(),
      
      // Session Info
      currentSession: this.currentSession,
      sessionType: this.sessionType,
      sessionTime: this.sessionStartTime,
      
      // Cumulative Metrics
      totalWorkTime: this.totalWorkTime,
      totalRestTime: this.totalRestTime,
      timeInCriticalZone: this.timeInCriticalZone,
      emergencyShutdowns: this.emergencyShutdowns,
      
      // Violations
      hasViolatedMinCapacity: this.hasViolatedMinCapacity
    };
  }
  
  /**
   * Get summary statistics for completed simulation
   * 
   * @returns {Object} Aggregate metrics
   */
  getSummary() {
    const avgCapacity = this.productivityHistory.reduce(
      (sum, point) => sum + point.capacity, 0
    ) / this.productivityHistory.length;
    
    const avgPerformance = this.productivityHistory.reduce(
      (sum, point) => sum + point.performance, 0
    ) / this.productivityHistory.length;
    
    const minCapacity = Math.min(
      ...this.productivityHistory.map(p => p.capacity)
    );
    
    const maxFatigue = Math.max(
      ...this.productivityHistory.map(p => p.fatigue)
    );
    
    return {
      workerId: this.id,
      totalWorkTime: this.totalWorkTime,
      totalRestTime: this.totalRestTime,
      avgCapacity: avgCapacity,
      avgPerformance: avgPerformance,
      minCapacity: minCapacity,
      maxFatigue: maxFatigue,
      timeInCriticalZone: this.timeInCriticalZone,
      emergencyShutdowns: this.emergencyShutdowns,
      violatedMinCapacity: this.hasViolatedMinCapacity,
      totalDataPoints: this.productivityHistory.length
    };
  }
  
  /**
   * Export time-series data for analysis
   * 
   * @returns {Array} Complete productivity history
   */
  exportTimeSeries() {
    return this.productivityHistory;
  }
  
  // ========================================================================
  // RESET & INITIALIZATION
  // ========================================================================
  
  /**
   * Reset worker to initial state
   */
  reset() {
    this.capacity = this.initialCapacity;
    this.fatigue = 1 - this.capacity;
    this.isWorking = false;
    this.sessionStartTime = 0;
    this.sessionStartCapacity = this.initialCapacity;
    this.totalWorkTime = 0;
    this.totalRestTime = 0;
    this.emergencyShutdowns = 0;
    this.currentSession = 1;
    this.sessionType = 'work';
    this.performanceMultiplier = 1.0;
    this.productivityHistory = [];
    this.hasViolatedMinCapacity = false;
    this.timeInCriticalZone = 0;
  }
  
  /**
   * Set custom initial capacity (e.g., simulating pre-fatigued worker)
   * 
   * @param {number} capacity - Initial capacity (0 to 1)
   */
  setInitialCapacity(capacity) {
    this.initialCapacity = Math.max(0, Math.min(1, capacity));
    this.reset();
  }
}

// ========================================================================
// MODULE EXPORTS
// ========================================================================

// For Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DarwishWorker;
}
