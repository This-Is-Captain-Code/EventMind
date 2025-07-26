import { type User, type InsertUser, type VisionAnalysis, type InsertVisionAnalysis } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createVisionAnalysis(analysis: InsertVisionAnalysis): Promise<VisionAnalysis>;
  getRecentVisionAnalyses(limit: number): Promise<VisionAnalysis[]>;
  getVisionAnalysis(id: string): Promise<VisionAnalysis | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private visionAnalyses: Map<string, VisionAnalysis>;

  constructor() {
    this.users = new Map();
    this.visionAnalyses = new Map();
  }

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

  async createVisionAnalysis(insertAnalysis: InsertVisionAnalysis): Promise<VisionAnalysis> {
    const id = randomUUID();
    const analysis: VisionAnalysis = {
      id,
      timestamp: new Date(),
      imageData: insertAnalysis.imageData,
      textDetections: insertAnalysis.textDetections || null,
      objectDetections: insertAnalysis.objectDetections || null,
      faceDetections: insertAnalysis.faceDetections || null,
      logoDetections: insertAnalysis.logoDetections || null,
      safeSearchAnnotation: insertAnalysis.safeSearchAnnotation || null,
      processingTime: insertAnalysis.processingTime || null,
    };
    this.visionAnalyses.set(id, analysis);
    return analysis;
  }

  async getRecentVisionAnalyses(limit: number): Promise<VisionAnalysis[]> {
    const analyses = Array.from(this.visionAnalyses.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
    return analyses;
  }

  async getVisionAnalysis(id: string): Promise<VisionAnalysis | undefined> {
    return this.visionAnalyses.get(id);
  }
}

export const storage = new MemStorage();
