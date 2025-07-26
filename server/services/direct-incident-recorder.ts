/**
 * Direct Incident Recorder - gRPC-style direct database insertion
 * Bypasses message queues for immediate incident recording
 */

import { db } from '../db';
import { safetyIncidents, type InsertSafetyIncident } from '@shared/schema';

export class DirectIncidentRecorder {
  
  /**
   * Record density alert incident directly to database
   */
  async recordDensityAlert(
    personCount: number,
    densityLevel: 'HIGH' | 'MEDIUM' | 'LOW',
    frameId: string,
    analysisId: string,
    applicationId: string,
    streamId: string
  ): Promise<void> {
    // Only record MEDIUM and HIGH incidents
    if (densityLevel === 'LOW') return;

    try {
      console.log(`📝 ATTEMPTING TO RECORD DENSITY INCIDENT: ${densityLevel} severity with ${personCount} people`);
      const insertData: InsertSafetyIncident = {
        incidentType: 'DENSITY_ALERT',
        severity: densityLevel,
        confidence: 0.9,
        personCount: personCount.toString(),
        streamSource: 'default-camera',
        applicationId: applicationId,
        streamId: streamId,
        frameId: frameId,
        analysisId: analysisId,
        detectionData: {
          personCount,
          densityLevel,
          alertType: 'OCCUPANCY_DENSITY',
          threshold: densityLevel === 'HIGH' ? 10 : 5
        },
        safetyAnalysis: null,
        acknowledged: 'false',
        resolvedAt: null,
        notes: null
      };

      const [newIncident] = await db
        .insert(safetyIncidents)
        .values(insertData)
        .returning();

      const localTime = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      console.log(`🚨 DIRECT DENSITY INCIDENT: ${densityLevel} severity - ${personCount} people detected at ${localTime} (ID: ${newIncident.id})`);
    } catch (error) {
      console.error('❌ Failed to record density incident:', error);
    }
  }

  /**
   * Record safety analysis incidents directly to database
   */
  async recordSafetyAnalysis(
    safetyAnalysis: any,
    frameId: string,
    analysisId: string,
    applicationId: string,
    streamId: string
  ): Promise<void> {
    if (!safetyAnalysis) return;

    try {
      const incidents: InsertSafetyIncident[] = [];

      // Process density surges
      for (const surge of safetyAnalysis.densitySurges || []) {
        if (surge.severity === 'HIGH' || surge.severity === 'MEDIUM') {
          incidents.push({
            incidentType: 'SURGE_DETECTION',
            severity: surge.severity,
            confidence: 0.8,
            personCount: null,
            streamSource: 'default-camera',
            applicationId: applicationId,
            streamId: streamId,
            frameId: frameId,
            analysisId: analysisId,
            detectionData: surge,
            safetyAnalysis: safetyAnalysis,
            acknowledged: 'false',
            resolvedAt: null,
            notes: null
          });
        }
      }

      // Process falling persons
      for (const fallingPerson of safetyAnalysis.fallingPersons || []) {
        incidents.push({
          incidentType: 'FALLING_PERSON',
          severity: 'HIGH',
          confidence: 0.9,
          personCount: null,
          streamSource: 'default-camera',
          applicationId: applicationId,
          streamId: streamId,
          frameId: frameId,
          analysisId: analysisId,
          detectionData: fallingPerson,
          safetyAnalysis: safetyAnalysis,
          acknowledged: 'false',
          resolvedAt: null,
          notes: null
        });
      }

      // Process lying persons
      for (const lyingPerson of safetyAnalysis.lyingPersons || []) {
        incidents.push({
          incidentType: 'LYING_PERSON',
          severity: 'MEDIUM',
          confidence: 0.8,
          personCount: null,
          streamSource: 'default-camera',
          applicationId: applicationId,
          streamId: streamId,
          frameId: frameId,
          analysisId: analysisId,
          detectionData: lyingPerson,
          safetyAnalysis: safetyAnalysis,
          acknowledged: 'false',
          resolvedAt: null,
          notes: null
        });
      }

      // Bulk insert all incidents
      if (incidents.length > 0) {
        const newIncidents = await db
          .insert(safetyIncidents)
          .values(incidents)
          .returning();

        const localTime = new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        console.log(`🚨 DIRECT SAFETY INCIDENTS: ${newIncidents.length} incidents recorded at ${localTime}`);
      }
    } catch (error) {
      console.error('❌ Failed to record safety incidents:', error);
    }
  }
}

export const directIncidentRecorder = new DirectIncidentRecorder();