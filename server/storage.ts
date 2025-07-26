import { 
  type User, 
  type InsertUser, 
  type VisionAnalysis, 
  type InsertVisionAnalysis,
  type VisionApplication,
  type InsertVisionApplication,
  type VisionStream,
  type InsertVisionStream,
  users,
  visionApplications,
  visionStreams,
  visionAnalyses
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Vision Application management
  createVisionApplication(app: InsertVisionApplication): Promise<VisionApplication>;
  getVisionApplication(id: string): Promise<VisionApplication | undefined>;
  getVisionApplications(): Promise<VisionApplication[]>;
  updateVisionApplicationState(id: string, state: string): Promise<void>;
  
  // Vision Stream management
  createVisionStream(stream: InsertVisionStream): Promise<VisionStream>;
  getVisionStream(id: string): Promise<VisionStream | undefined>;
  getVisionStreamsByApplication(applicationId: string): Promise<VisionStream[]>;
  updateVisionStreamState(id: string, state: string): Promise<void>;
  
  // Vision Analysis management
  createVisionAnalysis(analysis: InsertVisionAnalysis): Promise<VisionAnalysis>;
  getRecentVisionAnalyses(limit: number): Promise<VisionAnalysis[]>;
  getVisionAnalysesByStream(streamId: string, limit: number): Promise<VisionAnalysis[]>;
  getVisionAnalysis(id: string): Promise<VisionAnalysis | undefined>;
  clearAllVisionAnalyses(): Promise<void>;
  clearOldVisionAnalyses(maxAgeMinutes: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Vision Application management
  async createVisionApplication(insertApp: InsertVisionApplication): Promise<VisionApplication> {
    const [app] = await db
      .insert(visionApplications)
      .values(insertApp)
      .returning();
    return app;
  }

  async getVisionApplication(id: string): Promise<VisionApplication | undefined> {
    const [app] = await db.select().from(visionApplications).where(eq(visionApplications.id, id));
    return app || undefined;
  }

  async getVisionApplications(): Promise<VisionApplication[]> {
    return await db.select().from(visionApplications);
  }

  async updateVisionApplicationState(id: string, state: string): Promise<void> {
    await db
      .update(visionApplications)
      .set({ state, updateTime: new Date() })
      .where(eq(visionApplications.id, id));
  }

  // Vision Stream management
  async createVisionStream(insertStream: InsertVisionStream): Promise<VisionStream> {
    const [stream] = await db
      .insert(visionStreams)
      .values(insertStream)
      .returning();
    return stream;
  }

  async getVisionStream(id: string): Promise<VisionStream | undefined> {
    const [stream] = await db.select().from(visionStreams).where(eq(visionStreams.id, id));
    return stream || undefined;
  }

  async getVisionStreamsByApplication(applicationId: string): Promise<VisionStream[]> {
    return await db
      .select()
      .from(visionStreams)
      .where(eq(visionStreams.applicationId, applicationId));
  }

  async updateVisionStreamState(id: string, state: string): Promise<void> {
    await db
      .update(visionStreams)
      .set({ state })
      .where(eq(visionStreams.id, id));
  }

  // Vision Analysis management
  async createVisionAnalysis(insertAnalysis: InsertVisionAnalysis): Promise<VisionAnalysis> {
    const [analysis] = await db
      .insert(visionAnalyses)
      .values(insertAnalysis)
      .returning();
    return analysis;
  }

  async getRecentVisionAnalyses(limit: number): Promise<VisionAnalysis[]> {
    return await db
      .select()
      .from(visionAnalyses)
      .orderBy(desc(visionAnalyses.timestamp))
      .limit(limit);
  }

  async getVisionAnalysesByStream(streamId: string, limit: number): Promise<VisionAnalysis[]> {
    return await db
      .select()
      .from(visionAnalyses)
      .where(eq(visionAnalyses.streamId, streamId))
      .orderBy(desc(visionAnalyses.timestamp))
      .limit(limit);
  }

  async getVisionAnalysis(id: string): Promise<VisionAnalysis | undefined> {
    const [analysis] = await db.select().from(visionAnalyses).where(eq(visionAnalyses.id, id));
    return analysis || undefined;
  }

  async clearAllVisionAnalyses(): Promise<void> {
    await db.delete(visionAnalyses);
    console.log('🗑️ Cleared all vision analysis data from database');
  }

  async clearOldVisionAnalyses(maxAgeMinutes: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    
    // Get count before deletion
    const oldAnalyses = await db
      .select({ count: sql`count(*)` })
      .from(visionAnalyses)
      .where(sql`${visionAnalyses.timestamp} < ${cutoffTime}`);
    
    const countBefore = Number(oldAnalyses[0]?.count || 0);
    
    // Delete old analyses
    await db
      .delete(visionAnalyses)
      .where(sql`${visionAnalyses.timestamp} < ${cutoffTime}`);
    
    console.log(`🗑️ Removed ${countBefore} old vision analyses from database (older than ${maxAgeMinutes} minutes)`);
    return countBefore;
  }
}

export const storage = new DatabaseStorage();
