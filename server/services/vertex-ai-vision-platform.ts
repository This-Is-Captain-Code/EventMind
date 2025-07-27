import { GoogleAuth } from "google-auth-library";
import aiplatform from "@google-cloud/aiplatform";
import { VideoIntelligenceServiceClient } from "@google-cloud/video-intelligence";
import * as fs from "fs";
import { SafetyAnalyzer } from "./safety-analyzer";

export interface VisionApplication {
  name: string;
  displayName: string;
  location: string;
  state: string;
  createTime: string;
  updateTime: string;
  models: string[];
  streams: VisionStream[];
}

export interface VisionStream {
  name: string;
  displayName: string;
  sourceType: string;
  state: string;
  createTime: string;
  updateTime: string;
}

export interface VisionAnalysis {
  id: string;
  timestamp: string;
  confidence: number;
  processingTime: number;
  detections: any[];
  applicationId: string;
  streamId: string;
  safetyAnalysis?: any;
  occupancyDensity?: any;
  frameId?: string;
}

export interface StreamingEvent {
  type:
    | "OBJECT_DETECTION"
    | "OCCUPANCY_COUNT"
    | "LINE_CROSSING"
    | "ZONE_ENTRY"
    | "FACE_DETECTION";
  timestamp: string;
  confidence: number;
  bbox?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  attributes?: Record<string, any>;
}

export class VertexAIVisionPlatformService {
  private auth: GoogleAuth;
  private projectId: string;
  private location: string;
  private predictionClient: any;
  private videoClient: VideoIntelligenceServiceClient;
  private visionAIBaseUrl: string;
  private aiPlatformBaseUrl: string;
  private safetyAnalyzer: SafetyAnalyzer;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || "agenticai-466913";
    this.location = "us-central1";

    // Load service account credentials
    const credentials = JSON.parse(
      fs.readFileSync("./google-credentials.json", "utf8"),
    );

    // Initialize Google Auth with comprehensive scopes
    this.auth = new GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/cloud-vision",
        "https://www.googleapis.com/auth/compute",
        "https://www.googleapis.com/auth/bigquery",
      ],
      projectId: this.projectId,
    });

    // Initialize Vertex AI Platform client for predictions
    this.predictionClient = new aiplatform.PredictionServiceClient({
      credentials,
      projectId: this.projectId,
    });

    // Initialize Video Intelligence client for video processing
    this.videoClient = new VideoIntelligenceServiceClient({
      credentials,
      projectId: this.projectId,
    });

    // Set up API endpoints
    this.visionAIBaseUrl = `https://visionai.googleapis.com/v1/projects/${this.projectId}/locations`;
    this.aiPlatformBaseUrl = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}`;

    // Initialize safety analyzer for real-time monitoring
    this.safetyAnalyzer = new SafetyAnalyzer();
  }

  private async getAuthHeaders() {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    return {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    };
  }

  async listApplications(
    location: string = "us-central1",
  ): Promise<VisionApplication[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.visionAIBaseUrl}/${location}/applications`,
        { headers },
      );

      if (!response.ok) {
        console.log(
          `Applications API not available: ${response.status} ${response.statusText}`,
        );
        return this.getDefaultApplications();
      }

      const data = await response.json();
      const applications = data.applications || [];

      // If no applications exist, return default ones
      if (applications.length === 0) {
        return this.getDefaultApplications();
      }

      return applications;
    } catch (error) {
      console.log(
        "Error listing applications, returning default applications:",
        error,
      );
      return this.getDefaultApplications();
    }
  }

  private getDefaultApplications(): VisionApplication[] {
    return [
      {
        name: `projects/${this.projectId}/locations/us-central1/applications/my-vision-app`,
        displayName: "My Vision App",
        location: "us-central1",
        state: "DEPLOYED",
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        models: ["GENERAL_OBJECT_DETECTION", "FACE_DETECTION", "FIRE_DETECTION", "SMOKE_DETECTION"],
        streams: []
      },
      {
        name: `projects/${this.projectId}/locations/us-central1/applications/test-app-2`,
        displayName: "Test App 2",
        location: "us-central1",
        state: "DEPLOYED",
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        models: ["OCCUPANCY_COUNTING", "PPE_DETECTION"],
        streams: []
      },
      {
        name: `projects/${this.projectId}/locations/us-central1/applications/production-vision`,
        displayName: "Production Vision",
        location: "us-central1",
        state: "DEPLOYED",
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        models: ["OBJECT_DETECTION", "PERSON_DETECTION", "FIRE_DETECTION", "SMOKE_DETECTION"],
        streams: []
      },
    ];
  }

  async createApplication(data: {
    id: string;
    displayName: string;
    location?: string;
    models: string[];
  }): Promise<VisionApplication> {
    const location = data.location || "us-central1";
    const headers = await this.getAuthHeaders();

    const applicationData = {
      displayName: data.displayName,
      applicationConfigs: {
        nodes: data.models.map((model) => ({
          displayName: model,
          node: this.getNodeConfigForModel(model),
        })),
      },
    };

    const response = await fetch(
      `${this.visionAIBaseUrl}/${location}/applications?applicationId=${data.id}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(applicationData),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create application: ${errorText}`);
    }

    return await response.json();
  }

  async createStream(data: {
    name: string;
    displayName: string;
    applicationId: string;
    sourceType?: string;
    sourceUri?: string;
  }): Promise<VisionStream> {
    const location = "us-central1";
    const headers = await this.getAuthHeaders();

    const streamData = {
      displayName: data.displayName,
      sourceType: data.sourceType || "WEBCAM",
      sourceUri: data.sourceUri,
    };

    const response = await fetch(
      `${this.visionAIBaseUrl}/${location}/applications/${data.applicationId}/streams?streamId=${data.name}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(streamData),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create stream: ${errorText}`);
    }

    return await response.json();
  }

  async processFrame(data: {
    applicationId: string;
    streamId: string;
    frameData: string;
    models: string[];
  }): Promise<VisionAnalysis> {
    const startTime = Date.now();

    try {
      console.log(
        `Processing frame with Vertex AI Vision Platform for app ${data.applicationId}, stream ${data.streamId}`,
      );

      // Extract base64 data from data URL
      const base64Data = data.frameData.split(",")[1];
      if (!base64Data) {
        throw new Error("Invalid frame data format");
      }

      // Process frame using real Vertex AI Vision models
      const detections = await this.analyzeFrameWithVertexAIVision(
        base64Data,
        data.models,
      );

      // Use only real detections from Google Cloud Vision API

      const processingTime = Date.now() - startTime;

      // Perform advanced safety analysis on the detections
      const frameData = {
        timestamp: Date.now(),
        detections,
        frameId: `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      const safetyAnalysis = await this.safetyAnalyzer.processFrame(frameData);

      // Extract occupancy data from detections for incident recording
      const occupancyDetection = detections.find(d => d.type === "OCCUPANCY_COUNT");
      const occupancyDensity = occupancyDetection ? {
        personCount: occupancyDetection.count,
        densityLevel: occupancyDetection.density,
        densityColor: occupancyDetection.densityColor,
        densityDescription: occupancyDetection.densityDescription
      } : null;

      const analysis: VisionAnalysis = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        confidence:
          detections.length > 0
            ? Math.max(...detections.map((d) => d.confidence || 0.5))
            : 0,
        processingTime,
        detections,
        applicationId: data.applicationId,
        streamId: data.streamId,
        safetyAnalysis, // Add safety analysis results
        occupancyDensity, // Add occupancy data for incident recording
        frameId: frameData.frameId, // Add frame ID for tracking
      };

      console.log(
        `Vertex AI Vision analysis completed in ${processingTime}ms with ${detections.length} detections`,
      );
      return analysis;
    } catch (error) {
      console.error("Error processing frame with Vertex AI Vision:", error);

      const processingTime = Date.now() - startTime;
      return {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        confidence: 0,
        processingTime,
        detections: [],
        applicationId: data.applicationId,
        streamId: data.streamId,
      };
    }
  }

  private async analyzeFrameWithVertexAIVision(
    base64Data: string,
    models: string[],
  ): Promise<any[]> {
    try {
      const detections: any[] = [];
      const imageBuffer = Buffer.from(base64Data, "base64");

      // Process each requested model using Vertex AI Vision platform
      for (const model of models) {
        switch (model) {
          case "OBJECT_DETECTION":
          case "GENERAL_OBJECT_DETECTION":
            const allObjectDetections =
              await this.runObjectDetection(imageBuffer);
            detections.push(...allObjectDetections);
            break;
          case "PERSON_DETECTION":
            const objectDetections = await this.runObjectDetection(imageBuffer);
            const personDetections = objectDetections.filter(
              (d) => d.label === "Person" || d.label === "person",
            );
            detections.push(...personDetections);
            break;

          case "FACE_DETECTION":
            const faceDetections = await this.runFaceDetection(imageBuffer);
            detections.push(...faceDetections);
            break;

          case "OCCUPANCY_COUNTING":
            const occupancyData = await this.runOccupancyAnalytics(imageBuffer);
            detections.push(...occupancyData);
            break;

          case "PERSON_BLUR":
            const personData = await this.runPersonDetection(imageBuffer);
            detections.push(...personData);
            break;

          case "PPE_DETECTION":
            const ppeData = await this.runPPEDetection(imageBuffer);
            detections.push(...ppeData);
            break;

          case "TEXT_DETECTION":
            const textData = await this.runTextDetection(imageBuffer);
            detections.push(...textData);
            break;

          case "LOGO_DETECTION":
            const logoData = await this.runLogoDetection(imageBuffer);
            detections.push(...logoData);
            break;

          case "FIRE_DETECTION":
            const fireData = await this.runFireDetection(imageBuffer);
            detections.push(...fireData);
            break;

          case "SMOKE_DETECTION":
            const smokeData = await this.runSmokeDetection(imageBuffer);
            detections.push(...smokeData);
            break;

          default:
            console.warn(`Unsupported Vertex AI Vision model: ${model}`);
        }
      }

      return detections;
    } catch (error) {
      console.error("Error in Vertex AI Vision analysis:", error);
      return [];
    }
  }

  private async runObjectDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();

      // Use Google Cloud Vision API for object localization
      const request = {
        requests: [
          {
            image: {
              content: imageBuffer.toString("base64"),
            },
            features: [
              {
                type: "OBJECT_LOCALIZATION",
                maxResults: 20,
              },
            ],
          },
        ],
      };

      const endpoint = "https://vision.googleapis.com/v1/images:annotate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Google Cloud Vision API error: ${errorText}`);

        // Check if it's a service disabled error
        if (
          errorText.includes("SERVICE_DISABLED") ||
          errorText.includes("has not been used")
        ) {
          console.log(
            "Google Cloud Vision API needs to be enabled for this project",
          );
          return []; // Return empty array instead of throwing error
        }

        throw new Error(`Object detection failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseVisionAPIObjectResponse(data);
    } catch (error) {
      console.error("Vertex AI object detection error:", error);
      return [];
    }
  }

  private async runFaceDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();

      const request = {
        requests: [
          {
            image: {
              content: imageBuffer.toString("base64"),
            },
            features: [
              {
                type: "FACE_DETECTION",
                maxResults: 10,
              },
            ],
          },
        ],
      };

      const endpoint = "https://vision.googleapis.com/v1/images:annotate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Google Cloud Vision API error: ${errorText}`);

        // Check if it's a service disabled error
        if (
          errorText.includes("SERVICE_DISABLED") ||
          errorText.includes("has not been used")
        ) {
          console.log(
            "Google Cloud Vision API needs to be enabled for this project",
          );
          return []; // Return empty array instead of throwing error
        }

        throw new Error(`Face detection failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseVisionAPIFaceResponse(data);
    } catch (error) {
      console.error("Vertex AI face detection error:", error);
      return [];
    }
  }

  private async runOccupancyAnalytics(imageBuffer: Buffer): Promise<any[]> {
    try {
      // Use person detection from Vision API to estimate occupancy
      const headers = await this.getAuthHeaders();

      const request = {
        requests: [
          {
            image: {
              content: imageBuffer.toString("base64"),
            },
            features: [
              {
                type: "OBJECT_LOCALIZATION",
                maxResults: 100, // Maximum limit to catch all people
              },
            ],
          },
        ],
      };

      const endpoint = "https://vision.googleapis.com/v1/images:annotate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Occupancy analytics failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseOccupancyFromObjects(data);
    } catch (error) {
      console.error("Vertex AI occupancy analytics error:", error);
      return [];
    }
  }

  private async runPersonDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();

      const request = {
        instances: [
          {
            image: {
              imageBytes: imageBuffer.toString("base64"),
            },
          },
        ],
        parameters: {
          confidenceThreshold: 0.6,
          enableBlurring: true,
        },
      };

      const endpoint = `${this.aiPlatformBaseUrl}/publishers/google/models/person-detection@1:predict`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Person detection failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parsePersonDetections(data);
    } catch (error) {
      console.error("Vertex AI person detection error:", error);
      return [];
    }
  }

  private async runPPEDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      // Use object detection to identify safety equipment
      const headers = await this.getAuthHeaders();

      const request = {
        requests: [
          {
            image: {
              content: imageBuffer.toString("base64"),
            },
            features: [
              {
                type: "OBJECT_LOCALIZATION",
                maxResults: 20,
              },
            ],
          },
        ],
      };

      const endpoint = "https://vision.googleapis.com/v1/images:annotate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`PPE detection failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parsePPEFromObjects(data);
    } catch (error) {
      console.error("Vertex AI PPE detection error:", error);
      return [];
    }
  }

  private async runTextDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();

      const request = {
        requests: [
          {
            image: {
              content: imageBuffer.toString("base64"),
            },
            features: [
              {
                type: "TEXT_DETECTION",
                maxResults: 50,
              },
            ],
          },
        ],
      };

      const endpoint = "https://vision.googleapis.com/v1/images:annotate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Google Cloud Vision API error: ${errorText}`);

        // Check if it's a service disabled error
        if (
          errorText.includes("SERVICE_DISABLED") ||
          errorText.includes("has not been used")
        ) {
          console.log(
            "Google Cloud Vision API needs to be enabled for this project",
          );
          return []; // Return empty array instead of throwing error
        }

        throw new Error(`Text detection failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseVisionAPITextResponse(data);
    } catch (error) {
      console.error("Vertex AI text detection error:", error);
      return [];
    }
  }

  private async runLogoDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();

      const request = {
        requests: [
          {
            image: {
              content: imageBuffer.toString("base64"),
            },
            features: [
              {
                type: "LOGO_DETECTION",
                maxResults: 10,
              },
            ],
          },
        ],
      };

      const endpoint = "https://vision.googleapis.com/v1/images:annotate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Logo detection failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseLogoDetections(data);
    } catch (error) {
      console.error("Logo detection error:", error);
      return [];
    }
  }

  // Enhanced parsing methods for Google Cloud Vision API responses with detailed bounding boxes
  private parseVisionAPIObjectResponse(
    data: any,
    filterPersonsOnly: boolean = false,
  ): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];

    const detections: any[] = [];

    data.responses.forEach((response: any) => {
      if (response.localizedObjectAnnotations) {
        response.localizedObjectAnnotations.forEach((obj: any) => {
          const vertices = obj.boundingPoly?.normalizedVertices || [];
          if (vertices.length >= 4) {
            // Filter to only people if person detection mode is enabled
            if (filterPersonsOnly && obj.name !== "Person") {
              return; // Skip non-person objects
            }

            // Calculate bounding box from all vertices for accurate positioning
            const minX = Math.min(...vertices.map((v: any) => v.x || 0));
            const minY = Math.min(...vertices.map((v: any) => v.y || 0));
            const maxX = Math.max(...vertices.map((v: any) => v.x || 0));
            const maxY = Math.max(...vertices.map((v: any) => v.y || 0));

            // Use specific type for person detection
            const detectionType =
              obj.name === "Person" ? "PERSON_DETECTION" : "OBJECT_DETECTION";

            detections.push({
              type: detectionType,
              label: obj.name || "Object",
              confidence: obj.score || 0.5,
              bbox: {
                left: minX,
                top: minY,
                right: maxX,
                bottom: maxY,
              },
            });
          }
        });
      }
    });

    return detections;
  }

  private parseVisionAPIFaceResponse(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];

    const detections: any[] = [];

    data.responses.forEach((response: any) => {
      if (response.faceAnnotations) {
        response.faceAnnotations.forEach((face: any) => {
          const vertices = face.boundingPoly?.vertices || [];
          if (vertices.length >= 4) {
            detections.push({
              type: "FACE_DETECTION",
              label: "Face",
              confidence: face.detectionConfidence || 0.8,
              bbox: {
                left: Math.min(...vertices.map((v: any) => v.x || 0)) / 1000, // Normalize to 0-1
                top: Math.min(...vertices.map((v: any) => v.y || 0)) / 1000,
                right: Math.max(...vertices.map((v: any) => v.x || 0)) / 1000,
                bottom: Math.max(...vertices.map((v: any) => v.y || 0)) / 1000,
              },
            });
          }
        });
      }
    });

    return detections;
  }

  private parseVisionAPITextResponse(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];

    const textDetections: any[] = [];

    data.responses.forEach((response: any) => {
      if (response.textAnnotations) {
        response.textAnnotations.slice(1).forEach((text: any) => {
          const vertices = text.boundingPoly?.vertices || [];
          if (vertices.length >= 4 && text.description) {
            textDetections.push({
              type: "TEXT_DETECTION",
              label: text.description,
              confidence: 0.9,
              bbox: {
                left: Math.min(...vertices.map((v: any) => v.x || 0)) / 1000,
                top: Math.min(...vertices.map((v: any) => v.y || 0)) / 1000,
                right: Math.max(...vertices.map((v: any) => v.x || 0)) / 1000,
                bottom: Math.max(...vertices.map((v: any) => v.y || 0)) / 1000,
              },
              text: text.description,
            });
          }
        });
      }
    });

    return textDetections;
  }

  private parseVertexAIObjectDetections(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];

    const detections: any[] = [];

    data.predictions.forEach((prediction: any) => {
      if (
        prediction.displayNames &&
        prediction.confidences &&
        prediction.bboxes
      ) {
        prediction.displayNames.forEach((name: string, index: number) => {
          const bbox = prediction.bboxes[index];
          if (bbox && bbox.length >= 4) {
            detections.push({
              type: "OBJECT_DETECTION",
              label: name,
              confidence: prediction.confidences[index],
              bbox: {
                left: bbox[1], // x_min
                top: bbox[0], // y_min
                right: bbox[3], // x_max
                bottom: bbox[2], // y_max
              },
            });
          }
        });
      }
    });

    return detections;
  }

  private parseVertexAIFaceDetections(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];

    const detections: any[] = [];

    data.predictions.forEach((prediction: any) => {
      if (prediction.faces && Array.isArray(prediction.faces)) {
        prediction.faces.forEach((face: any) => {
          const bbox = face.boundingBox;
          if (bbox) {
            detections.push({
              type: "FACE_DETECTION",
              label: "Face",
              confidence: face.confidence || 0.8,
              bbox: {
                left: bbox.x1 || 0,
                top: bbox.y1 || 0,
                right: bbox.x2 || 0,
                bottom: bbox.y2 || 0,
              },
              emotions: {
                joy: face.emotions?.joy || 0,
                sorrow: face.emotions?.sorrow || 0,
                anger: face.emotions?.anger || 0,
                surprise: face.emotions?.surprise || 0,
              },
              landmarks: face.landmarks || [],
            });
          }
        });
      }
    });

    return detections;
  }

  private getLikelihoodScore(likelihood: string): number {
    const scores = {
      VERY_UNLIKELY: 0.1,
      UNLIKELY: 0.3,
      POSSIBLE: 0.5,
      LIKELY: 0.7,
      VERY_LIKELY: 0.9,
    };
    return scores[likelihood as keyof typeof scores] || 0.5;
  }

  private parseFaceDetections(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];

    return data.predictions.flatMap((prediction: any) => {
      if (!prediction.faceAnnotations) return [];

      return prediction.faceAnnotations.map((face: any) => ({
        type: "FACE_DETECTION",
        label: "Face",
        confidence: face.detectionConfidence || 0.8,
        bbox: {
          left: face.boundingPoly?.vertices?.[0]?.x || 0,
          top: face.boundingPoly?.vertices?.[0]?.y || 0,
          right: face.boundingPoly?.vertices?.[2]?.x || 0,
          bottom: face.boundingPoly?.vertices?.[2]?.y || 0,
        },
        attributes: {
          joyLikelihood: face.joyLikelihood,
          sorrowLikelihood: face.sorrowLikelihood,
          angerLikelihood: face.angerLikelihood,
          surpriseLikelihood: face.surpriseLikelihood,
        },
      }));
    });
  }

  private parseOccupancyFromObjects(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];

    let personCount = 0;
    const personDetections: any[] = [];
    
    // Debug: Log all detected objects
    console.log(`🔍 VISION API RESPONSE: Processing ${data.responses.length} responses`);

    data.responses.forEach((response: any, responseIndex: number) => {
      if (response.localizedObjectAnnotations) {
        console.log(`🔍 Response ${responseIndex}: Found ${response.localizedObjectAnnotations.length} total objects`);
        response.localizedObjectAnnotations.forEach((obj: any) => {
          // More liberal person detection - include more variations
          const objectName = (obj.name || "").toLowerCase();
          const isPerson = objectName === "person" || 
                          objectName === "human" || 
                          objectName === "people" ||
                          objectName.includes("person") ||
                          objectName.includes("human");
          
          if (isPerson && obj.score > 0.4) { // Lower confidence threshold
            personCount++;
            console.log(`🔍 Found ${obj.name} with confidence ${obj.score}`);
            const vertices = obj.boundingPoly?.normalizedVertices || [];
            if (vertices.length >= 4) {
              personDetections.push({
                type: "PERSON_DETECTION",
                label: `Person (${Math.round(obj.score * 100)}%)`,
                confidence: obj.score,
                bbox: {
                  left: vertices[0].x || 0,
                  top: vertices[0].y || 0,
                  right: vertices[2].x || 0,
                  bottom: vertices[2].y || 0,
                },
              });
            }
          }
        });
      }
    });

    // Enhanced occupancy summary with smart density thresholds and visual indicators
    let densityLevel = "LOW";
    let densityColor = "#22c55e"; // Green
    let densityDescription = "Safe occupancy level";
    
    if (personCount > 12) {
      densityLevel = "HIGH";
      densityColor = "#ef4444"; // Red
      densityDescription = "High density - Monitor closely";
    } else if (personCount > 5) {
      densityLevel = "MEDIUM";
      densityColor = "#f97316"; // Orange
      densityDescription = "Moderate density - Watch for changes";
    }

    // Add debugging to see what's happening
    console.log(`🔍 OCCUPANCY DEBUG: Found ${personCount} people, density: ${densityLevel}`);

    const occupancyData = [
      {
        type: "OCCUPANCY_COUNT",
        label: `${personCount} People - ${densityLevel} Density`,
        confidence: 0.9,
        count: personCount,
        density: densityLevel,
        densityColor: densityColor,
        densityDescription: densityDescription,
        bbox: {
          left: 0.02, // Top-left corner positioning
          top: 0.02,
          right: 0.35,
          bottom: 0.15
        }
      },
    ];

    return [...occupancyData, ...personDetections];
  }

  private parsePersonDetections(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];

    return data.predictions.flatMap((prediction: any) => {
      if (!prediction.persons) return [];

      return prediction.persons.map((person: any) => ({
        type: "PERSON_DETECTION",
        label: "Person",
        confidence: person.confidence || 0.8,
        bbox: {
          left: person.bbox?.[0] || 0,
          top: person.bbox?.[1] || 0,
          right: person.bbox?.[2] || 0,
          bottom: person.bbox?.[3] || 0,
        },
        blurred: person.blurred || false,
      }));
    });
  }

  private parsePPEFromObjects(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];

    const ppeItems: any[] = [];
    const safetyKeywords = [
      "helmet",
      "hard hat",
      "safety vest",
      "gloves",
      "goggles",
      "mask",
    ];

    data.responses.forEach((response: any) => {
      if (response.localizedObjectAnnotations) {
        response.localizedObjectAnnotations.forEach((obj: any) => {
          const objName = (obj.name || "").toLowerCase();
          const isPPE = safetyKeywords.some((keyword) =>
            objName.includes(keyword),
          );

          if (isPPE && obj.score > 0.5) {
            const vertices = obj.boundingPoly?.normalizedVertices || [];
            if (vertices.length >= 4) {
              ppeItems.push({
                type: "PPE_DETECTION",
                label: `Safety Equipment: ${obj.name}`,
                confidence: obj.score,
                bbox: {
                  left: vertices[0].x || 0,
                  top: vertices[0].y || 0,
                  right: vertices[2].x || 0,
                  bottom: vertices[2].y || 0,
                },
                ppeType: obj.name,
                isCompliant: true,
              });
            }
          }
        });
      }
    });

    return ppeItems;
  }

  private parseVertexAITextDetections(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];

    const textDetections: any[] = [];

    data.predictions.forEach((prediction: any) => {
      if (prediction.textSegments && Array.isArray(prediction.textSegments)) {
        prediction.textSegments.forEach((segment: any) => {
          const bbox = segment.boundingBox;
          if (bbox && segment.text) {
            textDetections.push({
              type: "TEXT_DETECTION",
              label: segment.text,
              confidence: segment.confidence || 0.9,
              bbox: {
                left: bbox.x1 || 0,
                top: bbox.y1 || 0,
                right: bbox.x2 || 0,
                bottom: bbox.y2 || 0,
              },
              text: segment.text,
              locale: segment.locale || "en",
            });
          }
        });
      }
    });

    return textDetections;
  }

  private parseLogoDetections(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];

    const logoDetections: any[] = [];

    data.responses.forEach((response: any) => {
      if (response.logoAnnotations) {
        response.logoAnnotations.forEach((logo: any) => {
          const vertices = logo.boundingPoly?.vertices || [];
          if (vertices.length >= 4) {
            logoDetections.push({
              type: "LOGO_DETECTION",
              label: `Logo: ${logo.description}`,
              confidence: logo.score || 0.8,
              bbox: {
                left: vertices[0].x || 0,
                top: vertices[0].y || 0,
                right: vertices[2].x || 0,
                bottom: vertices[2].y || 0,
              },
              logoName: logo.description,
            });
          }
        });
      }
    });

    return logoDetections;
  }

  private getNodeConfigForModel(model: string): any {
    const nodeConfigs: Record<string, any> = {
      GENERAL_OBJECT_DETECTION: {
        processor: "GENERAL_OBJECT_DETECTION_PROCESSOR",
        displayName: "Object Detection",
      },
      OCCUPANCY_COUNTING: {
        processor: "OCCUPANCY_COUNTING_PROCESSOR",
        displayName: "Occupancy Analytics",
      },
      PERSON_BLUR: {
        processor: "PERSON_BLUR_PROCESSOR",
        displayName: "Person Blur",
      },
      PPE_DETECTION: {
        processor: "PPE_DETECTION_PROCESSOR",
        displayName: "PPE Detection",
      },
      FACE_DETECTION: {
        processor: "FACE_DETECTION_PROCESSOR",
        displayName: "Face Detection",
      },
    };

    return nodeConfigs[model] || nodeConfigs["GENERAL_OBJECT_DETECTION"];
  }

  async checkHealth(): Promise<{ status: string; services: any[] }> {
    const services = [];

    try {
      // Check Vertex AI Platform connectivity
      const headers = await this.getAuthHeaders();
      const aiResponse = await fetch(`${this.aiPlatformBaseUrl}/publishers`, {
        headers,
      });
      services.push({
        name: "Vertex AI Platform",
        status: aiResponse.ok ? "healthy" : "unhealthy",
        endpoint: this.aiPlatformBaseUrl,
      });
    } catch (error) {
      services.push({
        name: "Vertex AI Platform",
        status: "unhealthy",
        error: (error as Error).message,
      });
    }

    try {
      // Check Vision AI connectivity
      const headers = await this.getAuthHeaders();
      const visionResponse = await fetch(
        `${this.visionAIBaseUrl}/us-central1/applications`,
        { headers },
      );
      services.push({
        name: "Vertex AI Vision",
        status: visionResponse.ok ? "healthy" : "unhealthy",
        endpoint: this.visionAIBaseUrl,
      });
    } catch (error) {
      services.push({
        name: "Vertex AI Vision",
        status: "unhealthy",
        error: (error as Error).message,
      });
    }

    const allHealthy = services.every(
      (service) => service.status === "healthy",
    );

    return {
      status: allHealthy ? "healthy" : "unhealthy",
      services,
    };
  }

  /**
   * Get safety analysis statistics from the safety analyzer
   */
  getSafetyStats(): any {
    return this.safetyAnalyzer.getSafetyStats();
  }

  /**
   * Fire detection using object detection to identify fire and flame objects
   */
  private async runFireDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();

      // Use Google Cloud Vision API for object localization to detect fire-related objects
      const request = {
        requests: [
          {
            image: {
              content: imageBuffer.toString("base64"),
            },
            features: [
              {
                type: "OBJECT_LOCALIZATION",
                maxResults: 20,
              },
            ],
          },
        ],
      };

      const endpoint = "https://vision.googleapis.com/v1/images:annotate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Fire detection API error: ${errorText}`);
        return [];
      }

      const data = await response.json();
      return this.parseFireDetections(data);
    } catch (error) {
      console.error("Fire detection error:", error);
      return [];
    }
  }

  /**
   * Smoke detection using object detection to identify smoke patterns
   */
  private async runSmokeDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();

      // Use Google Cloud Vision API for object localization to detect smoke-related objects
      const request = {
        requests: [
          {
            image: {
              content: imageBuffer.toString("base64"),
            },
            features: [
              {
                type: "OBJECT_LOCALIZATION",
                maxResults: 20,
              },
            ],
          },
        ],
      };

      const endpoint = "https://vision.googleapis.com/v1/images:annotate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Smoke detection API error: ${errorText}`);
        return [];
      }

      const data = await response.json();
      return this.parseSmokeDetections(data);
    } catch (error) {
      console.error("Smoke detection error:", error);
      return [];
    }
  }

  /**
   * Parse fire detection results from Google Cloud Vision API
   */
  private parseFireDetections(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];

    const fireDetections: any[] = [];
    
    // Fire-related keywords to identify in object detection
    const fireKeywords = [
      "fire", "flame", "flames", "burning", "blaze", "bonfire",
      "campfire", "fireplace", "torch", "candle", "lighter"
    ];

    data.responses.forEach((response: any) => {
      if (response.localizedObjectAnnotations) {
        response.localizedObjectAnnotations.forEach((obj: any) => {
          const objectName = (obj.name || "").toLowerCase();
          const isFire = fireKeywords.some(keyword => 
            objectName.includes(keyword)
          );

          if (isFire && obj.score > 0.3) { // Lower threshold for fire detection
            console.log(`🔥 Fire detected: ${obj.name} with confidence ${obj.score}`);
            const vertices = obj.boundingPoly?.normalizedVertices || [];
            
            if (vertices.length >= 4) {
              fireDetections.push({
                type: "FIRE_DETECTION",
                label: `🔥 Fire: ${obj.name} (${Math.round(obj.score * 100)}%)`,
                confidence: obj.score,
                bbox: {
                  left: vertices[0].x || 0,
                  top: vertices[0].y || 0,
                  right: vertices[2].x || 0,
                  bottom: vertices[2].y || 0,
                },
                alertLevel: obj.score > 0.7 ? "HIGH" : obj.score > 0.5 ? "MEDIUM" : "LOW",
                detectedObject: obj.name,
              });
            }
          }
        });
      }
    });

    // Log fire detection results
    if (fireDetections.length > 0) {
      console.log(`🚨 FIRE ALERT: Detected ${fireDetections.length} fire-related objects`);
    }

    return fireDetections;
  }

  /**
   * Parse smoke detection results from Google Cloud Vision API
   */
  private parseSmokeDetections(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];

    const smokeDetections: any[] = [];
    
    // Smoke-related keywords to identify in object detection
    const smokeKeywords = [
      "smoke", "smoking", "steam", "vapor", "mist", "fog",
      "cigarette", "cigar", "pipe", "chimney"
    ];

    data.responses.forEach((response: any) => {
      if (response.localizedObjectAnnotations) {
        response.localizedObjectAnnotations.forEach((obj: any) => {
          const objectName = (obj.name || "").toLowerCase();
          const isSmoke = smokeKeywords.some(keyword => 
            objectName.includes(keyword)
          );

          if (isSmoke && obj.score > 0.3) { // Lower threshold for smoke detection
            console.log(`💨 Smoke detected: ${obj.name} with confidence ${obj.score}`);
            const vertices = obj.boundingPoly?.normalizedVertices || [];
            
            if (vertices.length >= 4) {
              smokeDetections.push({
                type: "SMOKE_DETECTION",
                label: `💨 Smoke: ${obj.name} (${Math.round(obj.score * 100)}%)`,
                confidence: obj.score,
                bbox: {
                  left: vertices[0].x || 0,
                  top: vertices[0].y || 0,
                  right: vertices[2].x || 0,
                  bottom: vertices[2].y || 0,
                },
                alertLevel: obj.score > 0.7 ? "HIGH" : obj.score > 0.5 ? "MEDIUM" : "LOW",
                detectedObject: obj.name,
              });
            }
          }
        });
      }
    });

    // Log smoke detection results
    if (smokeDetections.length > 0) {
      console.log(`🚨 SMOKE ALERT: Detected ${smokeDetections.length} smoke-related objects`);
    }

    return smokeDetections;
  }
}
