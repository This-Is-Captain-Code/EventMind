/**
 * Advanced Safety Analysis Service
 * Analyzes multiple frames for density surge detection and falling/lying person detection
 */

interface FrameData {
  timestamp: number;
  detections: any[];
  frameId: string;
}

interface PersonTracker {
  id: string;
  positions: { x: number; y: number; timestamp: number }[];
  lastSeen: number;
  isLyingDown: boolean;
  isFalling: boolean;
}

interface DensityZone {
  x: number;
  y: number;
  width: number;
  height: number;
  personCount: number;
  density: number;
  timestamp: number;
}

export class SafetyAnalyzer {
  private frameHistory: FrameData[] = [];
  private personTrackers: Map<string, PersonTracker> = new Map();
  private densityHistory: DensityZone[][] = [];
  private readonly maxFrameHistory = 30; // Store last 30 frames (~5 seconds at 6fps)
  private readonly densityGridSize = 8; // 8x8 grid for density analysis
  private readonly densityThreshold = 0.15; // 15% of area occupied = high density
  private readonly surgeThreshold = 0.5; // 50% increase in density = surge
  private readonly fallingVelocityThreshold = 0.3; // Threshold for detecting falling motion

  /**
   * Process a new frame and perform safety analysis
   */
  public async processFrame(frameData: FrameData): Promise<{
    densitySurges: any[];
    fallingPersons: any[];
    lyingPersons: any[];
    overallSafetyStatus: 'SAFE' | 'WARNING' | 'CRITICAL';
  }> {
    // Add frame to history
    this.frameHistory.push(frameData);
    if (this.frameHistory.length > this.maxFrameHistory) {
      this.frameHistory.shift();
    }

    // Update person tracking
    this.updatePersonTracking(frameData);

    // Analyze density patterns
    const densityAnalysis = this.analyzeDensity(frameData);
    this.densityHistory.push(densityAnalysis);
    if (this.densityHistory.length > this.maxFrameHistory) {
      this.densityHistory.shift();
    }

    // Detect density surges
    const densitySurges = this.detectDensitySurges();

    // Detect falling and lying persons
    const fallingPersons = this.detectFallingPersons();
    const lyingPersons = this.detectLyingPersons(frameData);

    // Determine overall safety status
    const overallSafetyStatus = this.calculateSafetyStatus(densitySurges, fallingPersons, lyingPersons);

    return {
      densitySurges,
      fallingPersons,
      lyingPersons,
      overallSafetyStatus
    };
  }

  /**
   * Update person tracking across frames
   */
  private updatePersonTracking(frameData: FrameData): void {
    const currentPersons = frameData.detections.filter(d => 
      d.type === 'PERSON_DETECTION' || d.label === 'Person'
    );

    // Clean up old trackers
    const currentTime = frameData.timestamp;
    for (const [id, tracker] of this.personTrackers.entries()) {
      if (currentTime - tracker.lastSeen > 3000) { // 3 seconds timeout
        this.personTrackers.delete(id);
      }
    }

    // Match current detections to existing trackers
    for (const person of currentPersons) {
      const bbox = person.bbox;
      if (!bbox) continue;

      const centerX = (bbox.left + bbox.right) / 2;
      const centerY = (bbox.top + bbox.bottom) / 2;

      // Find closest existing tracker
      let closestTracker: PersonTracker | null = null;
      let minDistance = Infinity;

      for (const tracker of this.personTrackers.values()) {
        if (tracker.positions.length === 0) continue;
        const lastPos = tracker.positions[tracker.positions.length - 1];
        const distance = Math.sqrt(
          Math.pow(centerX - lastPos.x, 2) + Math.pow(centerY - lastPos.y, 2)
        );
        if (distance < minDistance && distance < 0.2) { // 20% of frame diagonal
          minDistance = distance;
          closestTracker = tracker;
        }
      }

      if (closestTracker) {
        // Update existing tracker
        closestTracker.positions.push({
          x: centerX,
          y: centerY,
          timestamp: currentTime
        });
        closestTracker.lastSeen = currentTime;

        // Keep only recent positions
        closestTracker.positions = closestTracker.positions.filter(
          pos => currentTime - pos.timestamp < 5000 // 5 seconds
        );
      } else {
        // Create new tracker
        const trackerId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.personTrackers.set(trackerId, {
          id: trackerId,
          positions: [{
            x: centerX,
            y: centerY,
            timestamp: currentTime
          }],
          lastSeen: currentTime,
          isLyingDown: false,
          isFalling: false
        });
      }
    }
  }

  /**
   * Analyze density patterns in the current frame
   */
  private analyzeDensity(frameData: FrameData): DensityZone[] {
    const zones: DensityZone[] = [];
    const gridWidth = 1 / this.densityGridSize;
    const gridHeight = 1 / this.densityGridSize;

    const persons = frameData.detections.filter(d => 
      d.type === 'PERSON_DETECTION' || d.label === 'Person'
    );

    for (let i = 0; i < this.densityGridSize; i++) {
      for (let j = 0; j < this.densityGridSize; j++) {
        const zoneX = i * gridWidth;
        const zoneY = j * gridHeight;
        
        // Count persons in this zone
        let personCount = 0;
        for (const person of persons) {
          const bbox = person.bbox;
          if (!bbox) continue;

          const centerX = (bbox.left + bbox.right) / 2;
          const centerY = (bbox.top + bbox.bottom) / 2;

          if (centerX >= zoneX && centerX < zoneX + gridWidth &&
              centerY >= zoneY && centerY < zoneY + gridHeight) {
            personCount++;
          }
        }

        const density = personCount / (gridWidth * gridHeight);
        
        zones.push({
          x: zoneX,
          y: zoneY,
          width: gridWidth,
          height: gridHeight,
          personCount,
          density,
          timestamp: frameData.timestamp
        });
      }
    }

    return zones;
  }

  /**
   * Detect density surges by comparing recent frames
   */
  private detectDensitySurges(): any[] {
    if (this.densityHistory.length < 2) return [];

    const surges = [];
    const currentDensity = this.densityHistory[this.densityHistory.length - 1];
    const previousDensity = this.densityHistory[this.densityHistory.length - 2];

    for (let i = 0; i < currentDensity.length; i++) {
      const current = currentDensity[i];
      const previous = previousDensity[i];

      if (current.density > this.densityThreshold && 
          current.density > previous.density * (1 + this.surgeThreshold)) {
        surges.push({
          type: 'DENSITY_SURGE',
          zone: {
            x: current.x,
            y: current.y,
            width: current.width,
            height: current.height
          },
          currentDensity: current.density,
          previousDensity: previous.density,
          increase: ((current.density - previous.density) / previous.density * 100).toFixed(1),
          severity: current.density > this.densityThreshold * 2 ? 'HIGH' : 'MEDIUM',
          timestamp: current.timestamp
        });
      }
    }

    return surges;
  }

  /**
   * Detect falling persons based on movement patterns
   */
  private detectFallingPersons(): any[] {
    const fallingPersons = [];

    for (const [id, tracker] of this.personTrackers.entries()) {
      if (tracker.positions.length < 3) continue;

      // Analyze last 3 positions for falling motion
      const positions = tracker.positions.slice(-3);
      let isFalling = false;

      // Check for rapid downward movement
      for (let i = 1; i < positions.length; i++) {
        const prev = positions[i - 1];
        const curr = positions[i];
        const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // seconds
        
        if (timeDiff > 0) {
          const verticalVelocity = (curr.y - prev.y) / timeDiff;
          
          if (verticalVelocity > this.fallingVelocityThreshold) {
            isFalling = true;
            break;
          }
        }
      }

      if (isFalling && !tracker.isFalling) {
        tracker.isFalling = true;
        fallingPersons.push({
          type: 'FALLING_PERSON',
          trackerId: id,
          position: positions[positions.length - 1],
          velocity: this.calculateVelocity(positions),
          timestamp: positions[positions.length - 1].timestamp,
          severity: 'HIGH'
        });
      }
    }

    return fallingPersons;
  }

  /**
   * Detect persons lying down based on bounding box aspect ratio
   */
  private detectLyingPersons(frameData: FrameData): any[] {
    const lyingPersons = [];

    const persons = frameData.detections.filter(d => 
      d.type === 'PERSON_DETECTION' || d.label === 'Person'
    );

    for (const person of persons) {
      const bbox = person.bbox;
      if (!bbox) continue;

      const width = bbox.right - bbox.left;
      const height = bbox.bottom - bbox.top;
      const aspectRatio = width / height;

      // If aspect ratio > 1.5, person might be lying down
      if (aspectRatio > 1.5) {
        lyingPersons.push({
          type: 'LYING_PERSON',
          bbox,
          aspectRatio: aspectRatio.toFixed(2),
          confidence: Math.min(aspectRatio / 1.5, 1.0), // Normalize confidence
          timestamp: frameData.timestamp,
          severity: 'MEDIUM'
        });
      }
    }

    return lyingPersons;
  }

  /**
   * Calculate overall safety status
   */
  private calculateSafetyStatus(
    densitySurges: any[], 
    fallingPersons: any[], 
    lyingPersons: any[]
  ): 'SAFE' | 'WARNING' | 'CRITICAL' {
    const highSeverityEvents = [
      ...densitySurges.filter(s => s.severity === 'HIGH'),
      ...fallingPersons.filter(f => f.severity === 'HIGH')
    ];

    const mediumSeverityEvents = [
      ...densitySurges.filter(s => s.severity === 'MEDIUM'),
      ...lyingPersons.filter(l => l.severity === 'MEDIUM')
    ];

    if (highSeverityEvents.length > 0) {
      return 'CRITICAL';
    } else if (mediumSeverityEvents.length > 1) {
      return 'WARNING';
    } else {
      return 'SAFE';
    }
  }

  /**
   * Calculate velocity from position history
   */
  private calculateVelocity(positions: { x: number; y: number; timestamp: number }[]): number {
    if (positions.length < 2) return 0;

    const first = positions[0];
    const last = positions[positions.length - 1];
    const timeDiff = (last.timestamp - first.timestamp) / 1000;

    if (timeDiff === 0) return 0;

    const distance = Math.sqrt(
      Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
    );

    return distance / timeDiff;
  }

  /**
   * Get current safety statistics
   */
  public getSafetyStats(): any {
    return {
      activePersonTrackers: this.personTrackers.size,
      frameHistoryLength: this.frameHistory.length,
      densityZones: this.densityHistory.length > 0 ? this.densityHistory[this.densityHistory.length - 1].length : 0,
      lastAnalysisTime: this.frameHistory.length > 0 ? this.frameHistory[this.frameHistory.length - 1].timestamp : null
    };
  }
}