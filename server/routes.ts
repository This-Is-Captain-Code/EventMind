import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { VertexAIVisionPlatformService } from "./services/vertex-ai-vision-platform";

import { z } from "zod";

// Initialize the Vertex AI Vision Platform service
const vertexAIVisionService = new VertexAIVisionPlatformService();

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

  const httpServer = createServer(app);
  return httpServer;
}