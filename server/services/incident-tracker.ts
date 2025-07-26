import { db } from "../db";
import { safetyIncidents, type InsertSafetyIncident, type SafetyIncident } from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";

export interface IncidentData {
  incidentType: 'DENSITY_ALERT' | 'FALLING_PERSON' | 'LYING_PERSON' | 'SURGE_DETECTION';
  severity: 'HIGH' | 'MEDIUM';
  confidence: number;
  personCount?: string;
  streamSource?: string;
  applicationId?: string;
  streamId?: string;
  frameId?: string;
  analysisId?: string;
  detectionData?: any;
  safetyAnalysis?: any;
}

export class IncidentTracker {

  /**
   * Process density alerts for HIGH/MEDIUM density levels
   */
  async processDensityAlert(
    personCount: number,
    densityLevel: 'HIGH' | 'MEDIUM' | 'LOW',
    frameId: string,
    analysisId: string,
    applicationId: string,
    streamId: string
  ): Promise<void> {
    // Only log MEDIUM and HIGH density incidents
    if (densityLevel === 'LOW') return;

    const incident = {
      type: 'DENSITY_ALERT' as const,
      severity: densityLevel,
      data: {
        personCount,
        densityLevel,
        alertType: 'OCCUPANCY_DENSITY'
      },
      timestamp: Date.now(),
      frameId,
      analysisId,
      applicationId,
      streamId
    };

    // Publish to queue for reliable processing
    const { incidentQueue } = await import('./incident-queue');
    await incidentQueue.publishIncident(incident);
  }

  /**
   * Record density incident directly (called from queue processor)
   */
  async recordDensityIncident(incident: any): Promise<SafetyIncident> {
    const insertData: InsertSafetyIncident = {
      timestamp: new Date(incident.timestamp),
      incidentType: 'DENSITY_ALERT',
      severity: incident.severity,
      confidence: 0.9, // High confidence for density detection
      personCount: incident.data.personCount,
      streamSource: 'default-camera',
      applicationId: incident.applicationId,
      streamId: incident.streamId,
      frameId: incident.frameId,
      analysisId: incident.analysisId,
      detectionData: incident.data,
      safetyAnalysis: null,
      acknowledged: 'false',
      resolvedAt: null,
      notes: null
    };

    const [newIncident] = await db
      .insert(safetyIncidents)
      .values(insertData)
      .returning();

    const localTime = new Date(newIncident.timestamp).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    console.log(`🚨 DENSITY INCIDENT RECORDED: ${newIncident.incidentType} - ${newIncident.severity} severity (${incident.data.personCount} people) at ${localTime} (ID: ${newIncident.id})`);
    
    return newIncident;
  }

  /**
   * Record safety analysis incident (called from queue processor)
   */
  async recordSafetyIncident(incident: any): Promise<SafetyIncident[]> {
    const incidents: SafetyIncident[] = [];
    
    // Process each safety analysis type
    const safetyAnalysis = incident.data;
    
    for (const surge of safetyAnalysis.densitySurges || []) {
      if (surge.severity === 'HIGH' || surge.severity === 'MEDIUM') {
        const insertData: InsertSafetyIncident = {
          timestamp: new Date(incident.timestamp),
          incidentType: 'SURGE_DETECTION',
          severity: surge.severity,
          confidence: 0.8,
          personCount: null,
          streamSource: 'default-camera',
          applicationId: incident.applicationId,
          streamId: incident.streamId,
          frameId: incident.frameId,
          analysisId: incident.analysisId,
          detectionData: surge,
          safetyAnalysis: safetyAnalysis,
          acknowledged: 'false',
          resolvedAt: null,
          notes: null
        };

        const [newIncident] = await db
          .insert(safetyIncidents)
          .values(insertData)
          .returning();
        
        incidents.push(newIncident);
      }
    }

    for (const fallingPerson of safetyAnalysis.fallingPersons || []) {
      const insertData: InsertSafetyIncident = {
        timestamp: new Date(incident.timestamp),
        incidentType: 'FALLING_PERSON',
        severity: 'HIGH',
        confidence: 0.9,
        personCount: null,
        streamSource: 'default-camera',
        applicationId: incident.applicationId,
        streamId: incident.streamId,
        frameId: incident.frameId,
        analysisId: incident.analysisId,
        detectionData: fallingPerson,
        safetyAnalysis: safetyAnalysis,
        acknowledged: 'false',
        resolvedAt: null,
        notes: null
      };

      const [newIncident] = await db
        .insert(safetyIncidents)
        .values(insertData)
        .returning();
      
      incidents.push(newIncident);
    }

    for (const lyingPerson of safetyAnalysis.lyingPersons || []) {
      const insertData: InsertSafetyIncident = {
        timestamp: new Date(incident.timestamp),
        incidentType: 'LYING_PERSON',
        severity: 'MEDIUM',
        confidence: 0.8,
        personCount: null,
        streamSource: 'default-camera',
        applicationId: incident.applicationId,
        streamId: incident.streamId,
        frameId: incident.frameId,
        analysisId: incident.analysisId,
        detectionData: lyingPerson,
        safetyAnalysis: safetyAnalysis,
        acknowledged: 'false',
        resolvedAt: null,
        notes: null
      };

      const [newIncident] = await db
        .insert(safetyIncidents)
        .values(insertData)
        .returning();
      
      incidents.push(newIncident);
    }

    if (incidents.length > 0) {
      const localTime = new Date(incident.timestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      console.log(`🚨 RECORDED ${incidents.length} SAFETY INCIDENTS at ${localTime}`);
    }

    return incidents;
  }

  /**
   * Process safety analysis results for incidents (main entry point)
   */
  async processSafetyAnalysis(
    safetyAnalysis: any,
    frameId: string,
    analysisId: string,
    applicationId: string,
    streamId: string
  ): Promise<void> {
    if (!safetyAnalysis || 
        (!safetyAnalysis.densitySurges?.length && 
         !safetyAnalysis.fallingPersons?.length && 
         !safetyAnalysis.lyingPersons?.length)) {
      return; // No incidents to process
    }

    const incident = {
      type: 'SAFETY_ANALYSIS' as const,
      severity: safetyAnalysis.overallSafetyStatus === 'CRITICAL' ? 'HIGH' as const : 'MEDIUM' as const,
      data: safetyAnalysis,
      timestamp: Date.now(),
      frameId,
      analysisId,
      applicationId,
      streamId
    };

    // Publish to queue for reliable processing
    const { incidentQueue } = await import('./incident-queue');
    await incidentQueue.publishIncident(incident);
  }

  /**
   * Record a safety incident to the database
   */
  async recordIncident(incidentData: IncidentData): Promise<SafetyIncident> {
    const insertData: InsertSafetyIncident = {
      incidentType: incidentData.incidentType,
      severity: incidentData.severity,
      confidence: incidentData.confidence,
      personCount: incidentData.personCount,
      streamSource: incidentData.streamSource || 'default-camera',
      applicationId: incidentData.applicationId || 'default-app',
      streamId: incidentData.streamId || 'default-stream',
      frameId: incidentData.frameId,
      analysisId: incidentData.analysisId,
      detectionData: incidentData.detectionData,
      safetyAnalysis: incidentData.safetyAnalysis,
      acknowledged: "false"
    };

    const [incident] = await db
      .insert(safetyIncidents)
      .values(insertData)
      .returning();

    const localTime = new Date(incident.timestamp).toLocaleString('en-US', {
      timeZone: 'America/New_York', // Adjust to user's timezone as needed
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    console.log(`🚨 INCIDENT RECORDED: ${incident.incidentType} - ${incident.severity} severity at ${localTime} (ID: ${incident.id})`);
    
    return incident;
  }

  /**
   * Record multiple incidents at once
   */
  async recordIncidents(incidents: IncidentData[]): Promise<SafetyIncident[]> {
    if (incidents.length === 0) return [];

    const insertData: InsertSafetyIncident[] = incidents.map(incident => ({
      incidentType: incident.incidentType,
      severity: incident.severity,
      confidence: incident.confidence,
      personCount: incident.personCount,
      streamSource: incident.streamSource || 'default-camera',
      applicationId: incident.applicationId || 'default-app',
      streamId: incident.streamId || 'default-stream',
      frameId: incident.frameId,
      analysisId: incident.analysisId,
      detectionData: incident.detectionData,
      safetyAnalysis: incident.safetyAnalysis,
      acknowledged: "false"
    }));

    const recordedIncidents = await db
      .insert(safetyIncidents)
      .values(insertData)
      .returning();

    const incidentIds = recordedIncidents.map(i => i.id);
    console.log(`🚨 RECORDED ${recordedIncidents.length} SAFETY INCIDENTS: ${incidentIds.join(', ')}`);
    
    return recordedIncidents;
  }

  /**
   * Get recent incidents
   */
  async getRecentIncidents(limit: number = 50): Promise<SafetyIncident[]> {
    return await db
      .select()
      .from(safetyIncidents)
      .orderBy(desc(safetyIncidents.timestamp))
      .limit(limit);
  }

  /**
   * Get incident statistics
   */
  async getIncidentStats(): Promise<{
    total: number;
    last24Hours: number;
    highSeverity: number;
    mediumSeverity: number;
    acknowledged: number;
    unacknowledged: number;
  }> {
    // Get total count
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(safetyIncidents);
    
    // Get last 24 hours count
    const last24HoursResult = await db
      .select({ count: sql`count(*)` })
      .from(safetyIncidents)
      .where(sql`${safetyIncidents.timestamp} > now() - interval '24 hours'`);

    // Get severity counts
    const highSeverityResult = await db
      .select({ count: sql`count(*)` })
      .from(safetyIncidents)
      .where(eq(safetyIncidents.severity, 'HIGH'));

    const mediumSeverityResult = await db
      .select({ count: sql`count(*)` })
      .from(safetyIncidents)
      .where(eq(safetyIncidents.severity, 'MEDIUM'));

    // Get acknowledgment counts
    const acknowledgedResult = await db
      .select({ count: sql`count(*)` })
      .from(safetyIncidents)
      .where(eq(safetyIncidents.acknowledged, 'true'));

    const unacknowledgedResult = await db
      .select({ count: sql`count(*)` })
      .from(safetyIncidents)
      .where(eq(safetyIncidents.acknowledged, 'false'));

    return {
      total: Number(totalResult[0]?.count || 0),
      last24Hours: Number(last24HoursResult[0]?.count || 0),
      highSeverity: Number(highSeverityResult[0]?.count || 0),
      mediumSeverity: Number(mediumSeverityResult[0]?.count || 0),
      acknowledged: Number(acknowledgedResult[0]?.count || 0),
      unacknowledged: Number(unacknowledgedResult[0]?.count || 0)
    };
  }

  /**
   * Acknowledge an incident
   */
  async acknowledgeIncident(id: string, notes?: string): Promise<void> {
    await db
      .update(safetyIncidents)
      .set({ 
        acknowledged: "true", 
        resolvedAt: new Date(),
        notes: notes || null
      })
      .where(eq(safetyIncidents.id, id));
  }

  /**
   * Process safety analysis results and record incidents automatically
   */
  async processSafetyAnalysis(safetyAnalysis: any, frameId: string, analysisId: string, applicationId?: string, streamId?: string): Promise<SafetyIncident[]> {
    const incidents: IncidentData[] = [];

    // Record density surges
    if (safetyAnalysis.densitySurges && safetyAnalysis.densitySurges.length > 0) {
      for (const surge of safetyAnalysis.densitySurges) {
        incidents.push({
          incidentType: 'SURGE_DETECTION',
          severity: surge.severity || 'HIGH',
          confidence: surge.confidence || 0.8,
          frameId,
          analysisId,
          applicationId,
          streamId,
          detectionData: surge,
          safetyAnalysis
        });
      }
    }

    // Record falling persons
    if (safetyAnalysis.fallingPersons && safetyAnalysis.fallingPersons.length > 0) {
      for (const falling of safetyAnalysis.fallingPersons) {
        incidents.push({
          incidentType: 'FALLING_PERSON',
          severity: falling.severity || 'HIGH',
          confidence: falling.confidence || 0.9,
          frameId,
          analysisId,
          applicationId,
          streamId,
          detectionData: falling,
          safetyAnalysis
        });
      }
    }

    // Record lying persons
    if (safetyAnalysis.lyingPersons && safetyAnalysis.lyingPersons.length > 0) {
      for (const lying of safetyAnalysis.lyingPersons) {
        incidents.push({
          incidentType: 'LYING_PERSON',
          severity: lying.severity || 'MEDIUM',
          confidence: lying.confidence || 0.7,
          frameId,
          analysisId,
          applicationId,
          streamId,
          detectionData: lying,
          safetyAnalysis
        });
      }
    }

    // Record incidents if any were detected
    if (incidents.length > 0) {
      return await this.recordIncidents(incidents);
    }

    return [];
  }

  /**
   * Process occupancy density alerts and record as incidents
   */
  async processDensityAlert(personCount: number, densityLevel: string, frameId: string, analysisId: string, applicationId?: string, streamId?: string): Promise<SafetyIncident | null> {
    // Only record HIGH and MEDIUM density as incidents
    if (densityLevel === 'HIGH' || densityLevel === 'MEDIUM') {
      const severity = densityLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';
      
      const incidentData: IncidentData = {
        incidentType: 'DENSITY_ALERT',
        severity,
        confidence: 0.95, // High confidence for density counting
        personCount: personCount.toString(),
        frameId,
        analysisId,
        applicationId,
        streamId,
        detectionData: { personCount, densityLevel },
        safetyAnalysis: { densityLevel, personCount }
      };

      return await this.recordIncident(incidentData);
    }

    return null;
  }
}

export const incidentTracker = new IncidentTracker();