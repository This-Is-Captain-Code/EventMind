import { 
  type User, 
  type InsertUser, 
  type VisionAnalysis, 
  type InsertVisionAnalysis,
  type VisionApplication,
  type InsertVisionApplication,
  type VisionStream,
  type InsertVisionStream
} from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private visionApplications: Map<string, VisionApplication>;
  private visionStreams: Map<string, VisionStream>;
  public visionAnalyses: Map<string, VisionAnalysis>;

  constructor() {
    this.users = new Map();
    this.visionApplications = new Map();
    this.visionStreams = new Map();
    this.visionAnalyses = new Map();
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Vision Application management
  async createVisionApplication(insertApp: InsertVisionApplication): Promise<VisionApplication> {
    const id = randomUUID();
    const app: VisionApplication = {
      id,
      createTime: new Date(),
      updateTime: new Date(),
      ...insertApp,
    };
    this.visionApplications.set(id, app);
    return app;
  }

  async getVisionApplication(id: string): Promise<VisionApplication | undefined> {
    return this.visionApplications.get(id);
  }

  async getVisionApplications(): Promise<VisionApplication[]> {
    return Array.from(this.visionApplications.values());
  }

  async updateVisionApplicationState(id: string, state: string): Promise<void> {
    const app = this.visionApplications.get(id);
    if (app) {
      app.state = state;
      app.updateTime = new Date();
      this.visionApplications.set(id, app);
    }
  }

  // Vision Stream management
  async createVisionStream(insertStream: InsertVisionStream): Promise<VisionStream> {
    const id = randomUUID();
    const stream: VisionStream = {
      id,
      createTime: new Date(),
      ...insertStream,
    };
    this.visionStreams.set(id, stream);
    return stream;
  }

  async getVisionStream(id: string): Promise<VisionStream | undefined> {
    return this.visionStreams.get(id);
  }

  async getVisionStreamsByApplication(applicationId: string): Promise<VisionStream[]> {
    return Array.from(this.visionStreams.values()).filter(
      stream => stream.applicationId === applicationId
    );
  }

  async updateVisionStreamState(id: string, state: string): Promise<void> {
    const stream = this.visionStreams.get(id);
    if (stream) {
      stream.state = state;
      this.visionStreams.set(id, stream);
    }
  }

  // Vision Analysis management
  async createVisionAnalysis(insertAnalysis: InsertVisionAnalysis): Promise<VisionAnalysis> {
    const id = randomUUID();
    const analysis: VisionAnalysis = {
      id,
      timestamp: new Date(),
      ...insertAnalysis,
    };
    this.visionAnalyses.set(id, analysis);
    return analysis;
  }

  async getRecentVisionAnalyses(limit: number): Promise<VisionAnalysis[]> {
    const analyses = Array.from(this.visionAnalyses.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    return analyses;
  }

  async getVisionAnalysesByStream(streamId: string, limit: number): Promise<VisionAnalysis[]> {
    return Array.from(this.visionAnalyses.values())
      .filter(analysis => analysis.streamId === streamId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getVisionAnalysis(id: string): Promise<VisionAnalysis | undefined> {
    return this.visionAnalyses.get(id);
  }

  async clearAllVisionAnalyses(): Promise<void> {
    this.visionAnalyses.clear();
    console.log('🗑️ Cleared all vision analysis data');
  }

  async clearOldVisionAnalyses(maxAgeMinutes: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const initialSize = this.visionAnalyses.size;
    
    // Remove old analyses
    for (const [id, analysis] of this.visionAnalyses.entries()) {
      if (new Date(analysis.timestamp) < cutoffTime) {
        this.visionAnalyses.delete(id);
      }
    }
    
    const removedCount = initialSize - this.visionAnalyses.size;
    console.log(`🗑️ Removed ${removedCount} old vision analyses (older than ${maxAgeMinutes} minutes)`);
    return removedCount;
  }
}

export const storage = new MemStorage();
