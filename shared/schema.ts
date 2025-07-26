import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const visionAnalyses = pgTable("vision_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  imageData: text("image_data").notNull(),
  textDetections: jsonb("text_detections"),
  objectDetections: jsonb("object_detections"),
  faceDetections: jsonb("face_detections"),
  logoDetections: jsonb("logo_detections"),
  safeSearchAnnotation: jsonb("safe_search_annotation"),
  processingTime: real("processing_time"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertVisionAnalysisSchema = createInsertSchema(visionAnalyses).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type VisionAnalysis = typeof visionAnalyses.$inferSelect;
export type InsertVisionAnalysis = z.infer<typeof insertVisionAnalysisSchema>;

// Vertex AI Vision API response types
export interface TextDetection {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ObjectDetection {
  name: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FaceDetection {
  confidence: number;
  emotions?: {
    joy?: string;
    sorrow?: string;
    anger?: string;
    surprise?: string;
  };
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface LogoDetection {
  description: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SafeSearchAnnotation {
  adult: string;
  spoof: string;
  medical: string;
  violence: string;
  racy: string;
  overall: string;
}

export interface VisionApiResponse {
  textDetections: TextDetection[];
  objectDetections: ObjectDetection[];
  faceDetections: FaceDetection[];
  logoDetections: LogoDetection[];
  safeSearchAnnotation: SafeSearchAnnotation;
  processingTime: number;
}

export interface VisionApiRequest {
  imageData: string; // base64 encoded image
  features: {
    textDetection: boolean;
    objectDetection: boolean;
    faceDetection: boolean;
    logoDetection: boolean;
    safeSearch: boolean;
  };
}
