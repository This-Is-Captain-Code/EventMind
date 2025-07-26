import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { VertexAIVisionPlatformService } from "./services/vertex-ai-vision-platform";
import { incidentTracker } from "./services/incident-tracker";

import { z } from "zod";

// Initialize the Vertex AI Vision Platform service
const vertexAIVisionService = new VertexAIVisionPlatformService();

// Initialize RTMP Streaming Server (will be imported when ready)
// const rtmpServer = new RTMPStreamingServer();

// Validation schemas
const applicationConfigSchema = z.object({
  name: z.string().min(1, "Application name is required"),
  displayName: z.string().min(1, "Display name is required"),
  location: z.string().default('us-central1'),
  models: z.array(z.string()).default(['GENERAL_OBJECT_DETECTION']),
});

const streamConfigSchema = z.object({
  name: z.string().min(1, "Stream name is required"),
  displayName: z.string().min(1, "Display name is required"),
  applicationId: z.string().min(1, "Application ID is required"),
  sourceType: z.enum(['WEBCAM', 'RTMP', 'FILE']).default('WEBCAM'),
  sourceUri: z.string().optional(),
});

const processFrameSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  streamId: z.string().min(1, "Stream ID is required"),
  frameData: z.string().min(1, "Frame data is required"),
  models: z.array(z.string()).min(1, "At least one model is required"),
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const health = await vertexAIVisionService.checkHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Vision Application Management
  app.get("/api/vision/applications", async (req, res) => {
    try {
      const applications = await vertexAIVisionService.listApplications();
      res.json(applications);
    } catch (error) {
      console.error('Error listing applications:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to list applications' 
      });
    }
  });

  app.post("/api/vision/applications", async (req, res) => {
    try {
      const validatedData = applicationConfigSchema.parse(req.body);
      
      // Create application in Vertex AI Vision platform
      const application = await vertexAIVisionService.createApplication({
        id: validatedData.name,
        displayName: validatedData.displayName,
        location: validatedData.location,
        models: validatedData.models
      });
      
      res.json({ 
        ...application,
        message: "Application created successfully. Add streams before deploying." 
      });
    } catch (error) {
      console.error('Error creating application:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to create application' 
        });
      }
    }
  });

  app.post("/api/vision/applications/:id/deploy", async (req, res) => {
    try {
      const applicationId = req.params.id;
      const result = await vertexAIVisionService.createApplication({ 
        id: applicationId, 
        displayName: `Deployed-${applicationId}`, 
        models: ['GENERAL_OBJECT_DETECTION'] 
      });
      
      res.json({ 
        ...result,
        message: "Application deployment initiated successfully." 
      });
    } catch (error) {
      console.error('Error deploying application:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to deploy application' 
      });
    }
  });

  // Vision Stream Management
  app.post("/api/vision/streams", async (req, res) => {
    try {
      const validatedData = streamConfigSchema.parse(req.body);
      
      // Create stream in Vertex AI Vision platform
      const stream = await vertexAIVisionService.createStream(validatedData);
      
      res.json({ 
        ...stream,
        message: "Stream created successfully." 
      });
    } catch (error) {
      console.error('Error creating stream:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to create stream' 
        });
      }
    }
  });

  // Frame Processing
  app.post("/api/vision/process-frame", async (req, res) => {
    try {
      const validatedData = processFrameSchema.parse(req.body);
      
      // Process frame with Vertex AI Vision platform
      const analysis = await vertexAIVisionService.processFrame(validatedData);
      
      // Store analysis result in memory for the analysis history
      await storage.createVisionAnalysis({
        streamId: analysis.streamId,
        frameData: validatedData.frameData.substring(0, 100) + '...', // Store truncated frame data
        annotations: analysis.detections,
        processingTime: analysis.processingTime,
        confidence: analysis.confidence
      });
      
      res.json(analysis);
    } catch (error) {
      console.error('Error processing frame:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to process frame' 
        });
      }
    }
  });

  // Analysis History
  app.get("/api/vision/analyses", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Get stored analysis results from memory storage
      const analyses = await storage.getRecentVisionAnalyses(limit);
      
      res.json(analyses);
    } catch (error) {
      console.error('Error fetching analyses:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch analyses' 
      });
    }
  });

  // Real-time Safety Statistics
  app.get("/api/safety/stats", async (req, res) => {
    try {
      const safetyStats = vertexAIVisionService.getSafetyStats();
      res.json(safetyStats);
    } catch (error) {
      console.error('Error getting safety stats:', error);
      res.status(500).json({ 
        error: 'Failed to get safety statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // RTMP Streaming Endpoints for Multiple Phone Support
  app.get("/api/streaming/status", async (req, res) => {
    try {
      // Mock response for now - will integrate with actual RTMP server
      const activeStreams = [
        {
          deviceId: "mobile_1",
          streamKey: "phone_camera_1",
          isActive: true,
          startTime: Date.now() - 30000,
          rtmpUrl: `rtmp://${req.get('host') || 'localhost'}:1935/live/mobile_1`,
          playbackUrl: `http://${req.get('host') || 'localhost'}:8000/live/mobile_1.flv`
        }
      ];
      
      res.json({
        totalStreams: activeStreams.length,
        activeStreams,
        serverStatus: "ready"
      });
    } catch (error) {
      console.error('Error getting streaming status:', error);
      res.status(500).json({ 
        error: 'Failed to get streaming status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/streaming/register", async (req, res) => {
    try {
      const { deviceId, deviceInfo } = req.body;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
      }

      // Generate streaming URLs for the device
      const streamKey = `mobile_${deviceId}_${Date.now()}`;
      const rtmpUrl = `rtmp://${req.get('host') || 'localhost'}:1935/live/${streamKey}`;
      const playbackUrl = `http://${req.get('host') || 'localhost'}:8000/live/${streamKey}.flv`;
      
      res.json({
        deviceId,
        streamKey,
        rtmpUrl,
        playbackUrl,
        instructions: {
          step1: "Use an RTMP streaming app on your mobile device",
          step2: `Set the server URL to: ${rtmpUrl}`,
          step3: "Start streaming from your mobile camera",
          step4: "Dashboard will automatically detect and analyze the stream"
        },
        recommendedApps: [
          "Larix Broadcaster (Android/iOS)",
          "Live Stream Camera (iOS)", 
          "RTMP Camera (Android)",
          "OBS Mobile (Android/iOS)"
        ]
      });
    } catch (error) {
      console.error('Error registering device:', error);
      res.status(500).json({ 
        error: 'Failed to register device',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🚨 SAFETY INCIDENT MANAGEMENT ENDPOINTS
  
  // Get all recent incidents
  app.get("/api/incidents", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const incidents = await incidentTracker.getRecentIncidents(limit);
      res.json(incidents);
    } catch (error) {
      console.error('Error fetching incidents:', error);
      res.status(500).json({ 
        error: 'Failed to fetch incidents',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get incidents by severity
  app.get("/api/incidents/severity/:severity", async (req, res) => {
    try {
      const severity = req.params.severity.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM';
      if (severity !== 'CRITICAL' && severity !== 'HIGH' && severity !== 'MEDIUM') {
        return res.status(400).json({ error: 'Severity must be CRITICAL, HIGH or MEDIUM' });
      }
      
      const limit = parseInt(req.query.limit as string) || 25;
      const incidents = await incidentTracker.getIncidentsBySeverity(severity, limit);
      res.json(incidents);
    } catch (error) {
      console.error('Error fetching incidents by severity:', error);
      res.status(500).json({ 
        error: 'Failed to fetch incidents by severity',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get incident statistics
  app.get("/api/incidents/stats", async (req, res) => {
    try {
      const hoursBack = parseInt(req.query.hours as string) || 24;
      const stats = await incidentTracker.getIncidentStats(hoursBack);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching incident stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch incident statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Acknowledge an incident
  app.post("/api/incidents/:incidentId/acknowledge", async (req, res) => {
    try {
      const { incidentId } = req.params;
      const { notes } = req.body;
      
      const success = await incidentTracker.acknowledgeIncident(incidentId, notes);
      
      if (success) {
        res.json({ success: true, message: 'Incident acknowledged successfully' });
      } else {
        res.status(404).json({ error: 'Incident not found or could not be acknowledged' });
      }
    } catch (error) {
      console.error('Error acknowledging incident:', error);
      res.status(500).json({ 
        error: 'Failed to acknowledge incident',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Manual incident recording (for testing or manual entries)
  app.post("/api/incidents", async (req, res) => {
    try {
      const { incidentType, severity, confidence, personCount, notes } = req.body;
      
      if (!incidentType || !severity) {
        return res.status(400).json({ error: 'incidentType and severity are required' });
      }

      const incidentId = await incidentTracker.recordIncident({
        incidentType,
        severity,
        confidence: confidence || 0.9,
        personCount,
        streamSource: 'manual',
        notes
      });

      res.status(201).json({ 
        success: true, 
        incidentId,
        message: 'Incident recorded successfully' 
      });
    } catch (error) {
      console.error('Error recording manual incident:', error);
      res.status(500).json({ 
        error: 'Failed to record incident',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}