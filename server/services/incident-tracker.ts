import { db } from "../db";
import { safetyIncidents, type InsertSafetyIncident } from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export class IncidentTracker {
  
  /**
   * Record a safety incident to the database
   * Handles all types: DENSITY_ALERT, FALLING_PERSON, LYING_PERSON, SURGE_DETECTION, FIRE_SMOKE_ALERT
   */
  async recordIncident(incident: {
    incidentType: 'DENSITY_ALERT' | 'FALLING_PERSON' | 'LYING_PERSON' | 'SURGE_DETECTION' | 'FIRE_SMOKE_ALERT';
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    confidence: number;
    personCount?: number;
    streamSource?: string;
    applicationId?: string;
    streamId?: string;
    frameId?: string;
    analysisId?: string;
    detectionData?: any;
    safetyAnalysis?: any;
  }): Promise<string> {
    try {
      const incidentData: InsertSafetyIncident = {
        incidentType: incident.incidentType,
        severity: incident.severity,
        confidence: incident.confidence,
        personCount: incident.personCount?.toString() || null,
        streamSource: incident.streamSource || 'webcam',
        applicationId: incident.applicationId || null,
        streamId: incident.streamId || 'default-stream',
        frameId: incident.frameId || null,
        analysisId: incident.analysisId || null,
        detectionData: incident.detectionData || null,
        safetyAnalysis: incident.safetyAnalysis || null,
        acknowledged: "false",
        resolvedAt: null,
        notes: null
      };

      const [insertedIncident] = await db
        .insert(safetyIncidents)
        .values(incidentData)
        .returning({ id: safetyIncidents.id });

      console.log(`🚨 INCIDENT RECORDED: ${incident.incidentType} - ${incident.severity} severity (ID: ${insertedIncident.id})`);
      
      return insertedIncident.id;
    } catch (error) {
      console.error("Failed to record safety incident:", error);
      throw error;
    }
  }

  /**
   * Process occupancy density and record if HIGH or MEDIUM
   */
  async processOccupancyAlert(data: {
    personCount: number;
    density: string;
    confidence: number;
    frameId?: string;
    analysisId?: string;
    detectionData?: any;
  }): Promise<string | null> {
    if (data.density === 'HIGH' || data.density === 'MEDIUM') {
      return await this.recordIncident({
        incidentType: 'DENSITY_ALERT',
        severity: data.density as 'HIGH' | 'MEDIUM',
        confidence: data.confidence,
        personCount: data.personCount,
        frameId: data.frameId,
        analysisId: data.analysisId,
        detectionData: data.detectionData,
        safetyAnalysis: {
          densityLevel: data.density,
          personCount: data.personCount,
          alertTrigger: `Occupancy ${data.density.toLowerCase()} density threshold exceeded`
        }
      });
    }
    return null;
  }

  /**
   * 🔥 Process fire/smoke detections and record CRITICAL/HIGH/MEDIUM incidents
   */
  async processFireSmokeAlert(data: {
    detections: any[];
    frameId?: string;
    analysisId?: string;
  }): Promise<string[]> {
    const recordedIncidents: string[] = [];

    for (const detection of data.detections) {
      if (detection.type === 'FIRE_SMOKE_DETECTION' && 
          (detection.severity === 'CRITICAL' || detection.severity === 'HIGH' || detection.severity === 'MEDIUM')) {
        
        const incidentId = await this.recordIncident({
          incidentType: 'FIRE_SMOKE_ALERT',
          severity: detection.severity,
          confidence: detection.confidence,
          personCount: 0, // Fire/smoke doesn't involve person count
          frameId: data.frameId,
          analysisId: data.analysisId,
          detectionData: detection,
          safetyAnalysis: {
            objectType: detection.label,
            emergencyLevel: detection.emergencyLevel,
            confidence: detection.confidence,
            location: detection.bbox,
            alertTrigger: `Fire/Smoke detected: ${detection.label} with ${detection.severity} severity`
          }
        });
        
        recordedIncidents.push(incidentId);
        console.log(`🔥 FIRE/SMOKE INCIDENT RECORDED: ${detection.label} - ${detection.severity} severity (ID: ${incidentId})`);
      }
    }

    return recordedIncidents;
  }

  /**
   * Process safety analysis results and record incidents
   */
  async processSafetyAnalysis(safetyData: any, frameId?: string, analysisId?: string): Promise<string[]> {
    const recordedIncidents: string[] = [];

    // Check for falling persons
    if (safetyData.fallingPersons && safetyData.fallingPersons.length > 0) {
      for (const fallingPerson of safetyData.fallingPersons) {
        const incidentId = await this.recordIncident({
          incidentType: 'FALLING_PERSON',
          severity: 'HIGH', // Falling is always high severity
          confidence: fallingPerson.confidence || 0.8,
          personCount: 1,
          frameId,
          analysisId,
          detectionData: fallingPerson,
          safetyAnalysis: {
            personId: fallingPerson.personId,
            velocity: fallingPerson.velocity,
            direction: fallingPerson.direction,
            alertTrigger: 'Rapid downward movement detected'
          }
        });
        recordedIncidents.push(incidentId);
      }
    }

    // Check for lying persons
    if (safetyData.lyingPersons && safetyData.lyingPersons.length > 0) {
      for (const lyingPerson of safetyData.lyingPersons) {
        const incidentId = await this.recordIncident({
          incidentType: 'LYING_PERSON',
          severity: 'MEDIUM', // Lying person is medium severity (could be resting)
          confidence: lyingPerson.confidence || 0.7,
          personCount: 1,
          frameId,
          analysisId,
          detectionData: lyingPerson,
          safetyAnalysis: {
            personId: lyingPerson.personId,
            aspectRatio: lyingPerson.aspectRatio,
            duration: lyingPerson.duration,
            alertTrigger: 'Person in horizontal position detected'
          }
        });
        recordedIncidents.push(incidentId);
      }
    }

    // Check for density surges
    if (safetyData.densitySurges && safetyData.densitySurges.length > 0) {
      for (const surge of safetyData.densitySurges) {
        const incidentId = await this.recordIncident({
          incidentType: 'SURGE_DETECTION',
          severity: surge.severity || 'HIGH',
          confidence: surge.confidence || 0.9,
          personCount: surge.newDensity || 0,
          frameId,
          analysisId,
          detectionData: surge,
          safetyAnalysis: {
            gridCell: surge.gridCell,
            previousDensity: surge.previousDensity,
            newDensity: surge.newDensity,
            increasePercent: surge.increasePercent,
            alertTrigger: `Density surge of ${surge.increasePercent}% detected in grid cell ${surge.gridCell}`
          }
        });
        recordedIncidents.push(incidentId);
      }
    }

    return recordedIncidents;
  }

  /**
   * Get recent incidents
   */
  async getRecentIncidents(limit: number = 50): Promise<any[]> {
    try {
      const incidents = await db
        .select()
        .from(safetyIncidents)
        .orderBy(desc(safetyIncidents.timestamp))
        .limit(limit);

      return incidents;
    } catch (error) {
      console.error("Failed to retrieve incidents:", error);
      return [];
    }
  }

  /**
   * Get incidents by severity
   */
  async getIncidentsBySeverity(severity: 'CRITICAL' | 'HIGH' | 'MEDIUM', limit: number = 25): Promise<any[]> {
    try {
      const incidents = await db
        .select()
        .from(safetyIncidents)
        .where(eq(safetyIncidents.severity, severity))
        .orderBy(desc(safetyIncidents.timestamp))
        .limit(limit);

      return incidents;
    } catch (error) {
      console.error("Failed to retrieve incidents by severity:", error);
      return [];
    }
  }

  /**
   * Acknowledge an incident
   */
  async acknowledgeIncident(incidentId: string, notes?: string): Promise<boolean> {
    try {
      await db
        .update(safetyIncidents)
        .set({ 
          acknowledged: "true",
          notes: notes || null
        })
        .where(eq(safetyIncidents.id, incidentId));

      console.log(`✅ Incident ${incidentId} acknowledged`);
      return true;
    } catch (error) {
      console.error("Failed to acknowledge incident:", error);
      return false;
    }
  }

  /**
   * Get incident statistics
   */
  async getIncidentStats(hoursBack: number = 24): Promise<any> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

      const recentIncidents = await db
        .select()
        .from(safetyIncidents)
        .where(gte(safetyIncidents.timestamp, cutoffTime));

      const stats = {
        totalIncidents: recentIncidents.length,
        criticalSeverity: recentIncidents.filter(i => i.severity === 'CRITICAL').length,
        highSeverity: recentIncidents.filter(i => i.severity === 'HIGH').length,
        mediumSeverity: recentIncidents.filter(i => i.severity === 'MEDIUM').length,
        byType: {
          DENSITY_ALERT: recentIncidents.filter(i => i.incidentType === 'DENSITY_ALERT').length,
          FALLING_PERSON: recentIncidents.filter(i => i.incidentType === 'FALLING_PERSON').length,
          LYING_PERSON: recentIncidents.filter(i => i.incidentType === 'LYING_PERSON').length,
          SURGE_DETECTION: recentIncidents.filter(i => i.incidentType === 'SURGE_DETECTION').length,
          FIRE_SMOKE_ALERT: recentIncidents.filter(i => i.incidentType === 'FIRE_SMOKE_ALERT').length,
        },
        acknowledged: recentIncidents.filter(i => i.acknowledged === "true").length,
        unacknowledged: recentIncidents.filter(i => i.acknowledged === "false").length
      };

      return stats;
    } catch (error) {
      console.error("Failed to get incident statistics:", error);
      return null;
    }
  }
}

export const incidentTracker = new IncidentTracker();