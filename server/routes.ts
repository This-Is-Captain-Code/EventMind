import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeImage } from "./services/vertexai";
import { insertVisionAnalysisSchema, type VisionApiRequest } from "@shared/schema";
import { z } from "zod";

const visionApiRequestSchema = z.object({
  imageData: z.string().min(1, "Image data is required"),
  features: z.object({
    textDetection: z.boolean(),
    objectDetection: z.boolean(),
    faceDetection: z.boolean(),
    logoDetection: z.boolean(),
    safeSearch: z.boolean(),
  }).refine((features) => 
    Object.values(features).some(Boolean), 
    "At least one feature must be enabled"
  ),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Vision API analysis endpoint
  app.post("/api/vision/analyze", async (req, res) => {
    try {
      // Validate request body
      const validatedData = visionApiRequestSchema.parse(req.body);
      
      // Analyze image with Vertex AI
      const analysisResult = await analyzeImage(validatedData as VisionApiRequest);
      
      // Store analysis result
      const storedAnalysis = await storage.createVisionAnalysis({
        imageData: validatedData.imageData,
        textDetections: analysisResult.textDetections,
        objectDetections: analysisResult.objectDetections,
        faceDetections: analysisResult.faceDetections,
        logoDetections: analysisResult.logoDetections,
        safeSearchAnnotation: analysisResult.safeSearchAnnotation,
        processingTime: analysisResult.processingTime,
      });
      
      res.json(analysisResult);
    } catch (error) {
      console.error("Vision analysis error:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Get recent vision analyses
  app.get("/api/vision/analyses", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const analyses = await storage.getRecentVisionAnalyses(limit);
      res.json(analyses);
    } catch (error) {
      console.error("Get analyses error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      service: "vertex-ai-vision" 
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
