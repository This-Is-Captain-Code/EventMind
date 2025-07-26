import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { VertexAIVisionPlatformService } from "./services/vertex-ai-vision-platform";
import { incidentTracker } from "./services/incident-tracker";
import { directIncidentRecorder } from "./services/direct-incident-recorder";

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
      
      // Store analysis result in database for the analysis history
      const storedAnalysis = await storage.createVisionAnalysis({
        streamId: analysis.streamId || 'default-stream',
        frameData: validatedData.frameData.substring(0, 100) + '...', // Store truncated frame data
        annotations: analysis.detections,
        processingTime: analysis.processingTime,
        confidence: analysis.confidence
      });

      // **DIRECT INCIDENT RECORDING** (gRPC-style database insertion)
      // Debug: Check analysis structure
      console.log('🔍 ANALYSIS OBJECT KEYS:', Object.keys(analysis));
      console.log('🔍 OCCUPANCY DENSITY:', (analysis as any).occupancyDensity);
      
      // Record density alerts immediately for HIGH and MEDIUM density
      if ((analysis as any).occupancyDensity && (analysis as any).occupancyDensity.personCount > 0) {
        const densityLevel = (analysis as any).occupancyDensity.densityLevel;
        const personCount = (analysis as any).occupancyDensity.personCount;
        
        // Direct database recording for density incidents
        await directIncidentRecorder.recordDensityAlert(
          personCount,
          densityLevel,
          (analysis as any).frameId || Date.now().toString(),
          storedAnalysis.id,
          validatedData.applicationId,
          validatedData.streamId
        );
      }

      // Record safety analysis incidents directly to database
      if ((analysis as any).safetyAnalysis) {
        await directIncidentRecorder.recordSafetyAnalysis(
          (analysis as any).safetyAnalysis,
          (analysis as any).frameId || Date.now().toString(),
          storedAnalysis.id,
          validatedData.applicationId,
          validatedData.streamId
        );
      }
      
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
      const incidentStats = await incidentTracker.getIncidentStats();
      
      res.json({
        ...safetyStats,
        incidents: incidentStats
      });
    } catch (error) {
      console.error('Error getting safety stats:', error);
      res.status(500).json({ 
        error: 'Failed to get safety statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Safety Incidents Endpoints
  app.get("/api/safety/incidents", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const incidents = await incidentTracker.getRecentIncidents(limit);
      res.json(incidents);
    } catch (error) {
      console.error('Error fetching incidents:', error);
      res.status(500).json({ 
        error: 'Failed to fetch safety incidents',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/safety/incidents/:id/acknowledge", async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      await incidentTracker.acknowledgeIncident(id, notes);
      res.json({ message: 'Incident acknowledged successfully' });
    } catch (error) {
      console.error('Error acknowledging incident:', error);
      res.status(500).json({ 
        error: 'Failed to acknowledge incident',
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

  const httpServer = createServer(app);
  return httpServer;
}