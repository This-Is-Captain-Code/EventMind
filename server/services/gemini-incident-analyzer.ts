/**
 * Gemini Incident Analyzer - AI-powered incident analysis with function calling
 */

import { GoogleGenAI } from "@google/genai";
import { db } from '../db';
import { safetyIncidents } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export class GeminiIncidentAnalyzer {

  /**
   * Get individual incident summary by timestamp and type
   */
  async getIncidentSummary(timestamp: string, incidentType?: string) {
    try {
      let whereConditions = [sql`DATE(${safetyIncidents.timestamp}) = DATE(${timestamp})`];
      
      if (incidentType) {
        whereConditions.push(eq(safetyIncidents.incidentType, incidentType));
      }

      const incidents = await db
        .select()
        .from(safetyIncidents)
        .where(and(...whereConditions))
        .orderBy(safetyIncidents.timestamp);
      
      return {
        date: timestamp,
        incidentType: incidentType || 'ALL',
        count: incidents.length,
        incidents: incidents.map(incident => ({
          id: incident.id,
          timestamp: incident.timestamp,
          type: incident.incidentType,
          severity: incident.severity,
          confidence: incident.confidence,
          details: incident.detectionData
        }))
      };
    } catch (error) {
      console.error('Error getting incident summary:', error);
      throw error;
    }
  }

  /**
   * Get total count and statistics for each incident type
   */
  async getIncidentTypeStats() {
    try {
      const stats = await db
        .select({
          incidentType: safetyIncidents.incidentType,
          count: sql<number>`count(*)`,
          avgConfidence: sql<number>`avg(${safetyIncidents.confidence})`,
          highSeverityCount: sql<number>`sum(case when ${safetyIncidents.severity} = 'HIGH' then 1 else 0 end)`,
          mediumSeverityCount: sql<number>`sum(case when ${safetyIncidents.severity} = 'MEDIUM' then 1 else 0 end)`,
          lowSeverityCount: sql<number>`sum(case when ${safetyIncidents.severity} = 'LOW' then 1 else 0 end)`,
          latestIncident: sql<string>`max(${safetyIncidents.timestamp})`
        })
        .from(safetyIncidents)
        .groupBy(safetyIncidents.incidentType);

      const totalIncidents = await db
        .select({ total: sql<number>`count(*)` })
        .from(safetyIncidents);

      return {
        totalIncidents: totalIncidents[0]?.total || 0,
        incidentTypes: stats.map(stat => ({
          type: stat.incidentType,
          count: stat.count,
          percentage: totalIncidents[0]?.total ? 
            Math.round((stat.count / totalIncidents[0].total) * 100) : 0,
          avgConfidence: Math.round(stat.avgConfidence * 100) / 100,
          severityBreakdown: {
            HIGH: stat.highSeverityCount,
            MEDIUM: stat.mediumSeverityCount,
            LOW: stat.lowSeverityCount
          },
          latestIncident: stat.latestIncident
        }))
      };
    } catch (error) {
      console.error('Error getting incident type stats:', error);
      throw error;
    }
  }

  /**
   * Analyze incidents using Gemini with function calling
   */
  async analyzeWithPrompt(userPrompt: string) {
    try {
      const functionDeclarations = [
        {
          name: "getIncidentSummary",
          description: "Get detailed summary of incidents by timestamp and optionally by incident type",
          parameters: {
            type: "object",
            properties: {
              timestamp: {
                type: "string",
                description: "Date in YYYY-MM-DD format to search for incidents"
              },
              incidentType: {
                type: "string",
                description: "Optional incident type filter (DENSITY_ALERT, SURGE_DETECTION, FALLING_PERSON, LYING_PERSON)",
                enum: ["DENSITY_ALERT", "SURGE_DETECTION", "FALLING_PERSON", "LYING_PERSON"]
              }
            },
            required: ["timestamp"]
          }
        },
        {
          name: "getIncidentTypeStats",
          description: "Get comprehensive statistics and counts for all incident types",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: userPrompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          functionDeclarations: functionDeclarations
        }
      });

      const responseText = response.text || "";
      const results: any[] = [];

      // Check if the response contains function calls by analyzing the content
      if (responseText.includes("getIncidentSummary") || responseText.includes("getIncidentTypeStats")) {
        // Determine which function to call based on user prompt
        if (userPrompt.toLowerCase().includes("stats") || userPrompt.toLowerCase().includes("count") || userPrompt.toLowerCase().includes("total")) {
          functionResult = await this.getIncidentTypeStats();
          results.push({
            functionName: "getIncidentTypeStats",
            args: {},
            result: functionResult
          });
        } else if (userPrompt.includes("202") || userPrompt.includes("incident")) {
          // Extract date from prompt (simplified)
          const dateMatch = userPrompt.match(/\d{4}-\d{2}-\d{2}/);
          const date = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];
          
          functionResult = await this.getIncidentSummary(date);
          results.push({
            functionName: "getIncidentSummary",
            args: { timestamp: date },
            result: functionResult
          });
        }

        // Generate final analysis
        const analysisPrompt = `Based on the following incident data, provide a comprehensive analysis:\n\nUser Query: ${userPrompt}\n\nData: ${JSON.stringify(functionResult, null, 2)}\n\nProvide insights, trends, and key findings.`;
        
        const finalResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: analysisPrompt
        });

        return {
          prompt: userPrompt,
          functionCalls: results,
          analysis: finalResponse.text || "Analysis completed successfully",
          timestamp: new Date().toISOString()
        };
      } else {
        // Use smart function detection based on keywords
        let functionResult;
        
        if (userPrompt.toLowerCase().includes("stats") || userPrompt.toLowerCase().includes("count") || userPrompt.toLowerCase().includes("total")) {
          functionResult = await this.getIncidentTypeStats();
          results.push({
            functionName: "getIncidentTypeStats",
            args: {},
            result: functionResult
          });
        } else {
          // Default to getting today's incidents
          const today = new Date().toISOString().split('T')[0];
          functionResult = await this.getIncidentSummary(today);
          results.push({
            functionName: "getIncidentSummary", 
            args: { timestamp: today },
            result: functionResult
          });
        }

        const analysisPrompt = `Based on the following incident data, provide a comprehensive analysis:\n\nUser Query: ${userPrompt}\n\nData: ${JSON.stringify(functionResult, null, 2)}\n\nProvide insights, trends, and key findings.`;
        
        const finalResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: analysisPrompt
        });

        return {
          prompt: userPrompt,
          functionCalls: results,
          analysis: finalResponse.text || "Analysis completed successfully",
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Error in Gemini analysis:', error);
      throw error;
    }
  }
}

export const geminiAnalyzer = new GeminiIncidentAnalyzer();