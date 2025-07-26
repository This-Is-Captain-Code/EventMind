import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Vertex AI Vision platform tables
export const visionApplications = pgTable("vision_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  location: text("location").notNull().default('us-central1'),
  state: text("state").notNull().default('PENDING'), // PENDING, DEPLOYED, UNDEPLOYED
  createTime: timestamp("create_time").defaultNow().notNull(),
  updateTime: timestamp("update_time").defaultNow().notNull(),
});

export const visionStreams = pgTable("vision_streams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => visionApplications.id).notNull(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  sourceUri: text("source_uri"), // RTMP/WebRTC stream URI
  state: text("state").notNull().default('INACTIVE'), // ACTIVE, INACTIVE, ERROR
  createTime: timestamp("create_time").defaultNow().notNull(),
});

export const visionAnalyses = pgTable("vision_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").references(() => visionStreams.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  frameData: text("frame_data"), // base64 encoded frame
  annotations: jsonb("annotations"), // Vision model annotations
  processingTime: real("processing_time"),
  confidence: real("confidence"),
});

export const safetyIncidents = pgTable("safety_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  incidentType: text("incident_type").notNull(), // DENSITY_ALERT, FALLING_PERSON, LYING_PERSON, SURGE_DETECTION
  severity: text("severity").notNull(), // HIGH, MEDIUM
  confidence: real("confidence").notNull(),
  personCount: text("person_count"),
  streamSource: text("stream_source"),
  applicationId: text("application_id"),
  streamId: text("stream_id"),
  frameId: text("frame_id"),
  analysisId: text("analysis_id"),
  detectionData: jsonb("detection_data"),
  safetyAnalysis: jsonb("safety_analysis"),
  acknowledged: text("acknowledged").default("false"),
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertVisionApplicationSchema = createInsertSchema(visionApplications).omit({
  id: true,
  createTime: true,
  updateTime: true,
});

export const insertVisionStreamSchema = createInsertSchema(visionStreams).omit({
  id: true,
  createTime: true,
});

export const insertVisionAnalysisSchema = createInsertSchema(visionAnalyses).omit({
  id: true,
  timestamp: true,
});

export const insertSafetyIncidentSchema = createInsertSchema(safetyIncidents).omit({
  id: true,
  timestamp: true,
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type VisionApplication = typeof visionApplications.$inferSelect;
export type InsertVisionApplication = z.infer<typeof insertVisionApplicationSchema>;

export type VisionStream = typeof visionStreams.$inferSelect;
export type InsertVisionStream = z.infer<typeof insertVisionStreamSchema>;

export type VisionAnalysis = typeof visionAnalyses.$inferSelect;
export type InsertVisionAnalysis = z.infer<typeof insertVisionAnalysisSchema>;

export type SafetyIncident = typeof safetyIncidents.$inferSelect;
export type InsertSafetyIncident = z.infer<typeof insertSafetyIncidentSchema>;

// Additional types for Vertex AI Vision platform
export interface VisionPlatformRequest {
  applicationId: string;
  streamId: string;
  frameData: string;
  models: string[];
}

export interface VisionPlatformResponse {
  id: string;
  timestamp: string;
  confidence: number;
  processingTime: number;
  detections: any[];
  applicationId: string;
  streamId: string;
}

export interface VertexAIVisionApplicationConfig {
  name: string;
  displayName: string;
  location: string;
  models: string[];
}

export interface VertexAIVisionStreamConfig {
  name: string;
  displayName: string;
  applicationId: string;
  sourceType: 'WEBCAM' | 'RTMP' | 'FILE';
  sourceUri?: string;
}
export interface VertexAIVisionApplicationConfig {
  name: string;
  displayName: string;
  location: string;
  models: string[]; // Pre-trained model names
}

export interface VertexAIVisionStreamConfig {
  name: string;
  displayName: string;
  applicationId: string;
  sourceType: 'WEBCAM' | 'RTMP' | 'FILE';
  sourceUri?: string;
}

export interface StreamingAnnotation {
  timestamp: number;
  frameId: string;
  detections: {
    type: 'OBJECT' | 'PERSON' | 'VEHICLE' | 'FACE' | 'TEXT';
    name: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    attributes?: Record<string, any>;
  }[];
}

export interface VisionPlatformResponse {
  streamId: string;
  frameTimestamp: number;
  annotations: StreamingAnnotation;
  processingLatency: number;
  modelVersion: string;
}

export interface VisionPlatformRequest {
  applicationId: string;
  streamId: string;
  frameData: string; // base64 encoded frame
  models: string[]; // Models to run
}
