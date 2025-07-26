import { GoogleAuth } from 'google-auth-library';
import aiplatform from '@google-cloud/aiplatform';
import { VideoIntelligenceServiceClient } from '@google-cloud/video-intelligence';
import * as fs from 'fs';

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
}

export interface StreamingEvent {
  type: 'OBJECT_DETECTION' | 'OCCUPANCY_COUNT' | 'LINE_CROSSING' | 'ZONE_ENTRY' | 'FACE_DETECTION';
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

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'agenticai-466913';
    this.location = 'us-central1';
    
    // Load service account credentials
    const credentials = JSON.parse(fs.readFileSync('./google-credentials.json', 'utf8'));
    
    // Initialize Google Auth with comprehensive scopes
    this.auth = new GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/cloud-vision',
        'https://www.googleapis.com/auth/compute',
        'https://www.googleapis.com/auth/bigquery'
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
  }

  private async getAuthHeaders() {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    return {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json',
    };
  }

  async listApplications(location: string = 'us-central1'): Promise<VisionApplication[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.visionAIBaseUrl}/${location}/applications`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`Failed to list applications: ${response.statusText}`);
      }

      const data = await response.json();
      return data.applications || [];
    } catch (error) {
      console.error('Error listing applications:', error);
      return [];
    }
  }

  async createApplication(data: {
    id: string;
    displayName: string;
    location?: string;
    models: string[];
  }): Promise<VisionApplication> {
    const location = data.location || 'us-central1';
    const headers = await this.getAuthHeaders();

    const applicationData = {
      displayName: data.displayName,
      applicationConfigs: {
        nodes: data.models.map(model => ({
          displayName: model,
          node: this.getNodeConfigForModel(model)
        }))
      }
    };

    const response = await fetch(
      `${this.visionAIBaseUrl}/${location}/applications?applicationId=${data.id}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(applicationData),
      }
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
    const location = 'us-central1';
    const headers = await this.getAuthHeaders();

    const streamData = {
      displayName: data.displayName,
      sourceType: data.sourceType || 'WEBCAM',
      sourceUri: data.sourceUri,
    };

    const response = await fetch(
      `${this.visionAIBaseUrl}/${location}/applications/${data.applicationId}/streams?streamId=${data.name}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(streamData),
      }
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
      console.log(`Processing frame with Vertex AI Vision Platform for app ${data.applicationId}, stream ${data.streamId}`);
      
      // Extract base64 data from data URL
      const base64Data = data.frameData.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid frame data format');
      }
      
      // Process frame using real Vertex AI Vision models
      const detections = await this.analyzeFrameWithVertexAIVision(base64Data, data.models);
      
      const processingTime = Date.now() - startTime;
      
      const analysis: VisionAnalysis = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        confidence: detections.length > 0 ? Math.max(...detections.map(d => d.confidence || 0.5)) : 0,
        processingTime,
        detections,
        applicationId: data.applicationId,
        streamId: data.streamId,
      };
      
      console.log(`Vertex AI Vision analysis completed in ${processingTime}ms with ${detections.length} detections`);
      return analysis;
      
    } catch (error) {
      console.error('Error processing frame with Vertex AI Vision:', error);
      
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

  private async analyzeFrameWithVertexAIVision(base64Data: string, models: string[]): Promise<any[]> {
    try {
      const detections: any[] = [];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Process each requested model using Vertex AI Vision platform
      for (const model of models) {
        switch (model) {
          case 'OBJECT_DETECTION':
          case 'GENERAL_OBJECT_DETECTION':
            const objectDetections = await this.runObjectDetection(imageBuffer);
            detections.push(...objectDetections);
            break;
            
          case 'FACE_DETECTION':
            const faceDetections = await this.runFaceDetection(imageBuffer);
            detections.push(...faceDetections);
            break;
            
          case 'OCCUPANCY_COUNTING':
            const occupancyData = await this.runOccupancyAnalytics(imageBuffer);
            detections.push(...occupancyData);
            break;
            
          case 'PERSON_BLUR':
            const personData = await this.runPersonDetection(imageBuffer);
            detections.push(...personData);
            break;
            
          case 'PPE_DETECTION':
            const ppeData = await this.runPPEDetection(imageBuffer);
            detections.push(...ppeData);
            break;
            
          default:
            console.warn(`Unsupported Vertex AI Vision model: ${model}`);
        }
      }
      
      return detections;
      
    } catch (error) {
      console.error('Error in Vertex AI Vision analysis:', error);
      return [];
    }
  }

  private async runObjectDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      // Use Vertex AI Vision object detection model
      const request = {
        instances: [{
          image: {
            imageBytes: imageBuffer.toString('base64')
          }
        }],
        parameters: {
          confidenceThreshold: 0.5,
          maxPredictions: 20
        }
      };
      
      const endpoint = `${this.aiPlatformBaseUrl}/publishers/google/models/imageobjectdetection@1:predict`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Object detection failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseObjectDetections(data);
      
    } catch (error) {
      console.error('Vertex AI object detection error:', error);
      return [];
    }
  }

  private async runFaceDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const request = {
        instances: [{
          image: {
            imageBytes: imageBuffer.toString('base64')
          }
        }],
        parameters: {
          maxFaces: 10,
          includeLandmarks: true,
          includeAttributes: true
        }
      };
      
      const endpoint = `${this.aiPlatformBaseUrl}/publishers/google/models/facedetection@1:predict`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Face detection failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseFaceDetections(data);
      
    } catch (error) {
      console.error('Vertex AI face detection error:', error);
      return [];
    }
  }

  private async runOccupancyAnalytics(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      // Use specialized Vertex AI Vision occupancy analytics
      const request = {
        instances: [{
          image: {
            imageBytes: imageBuffer.toString('base64')
          }
        }],
        parameters: {
          activeZone: {
            normalizedVertices: [
              { x: 0.0, y: 0.0 },
              { x: 1.0, y: 0.0 },
              { x: 1.0, y: 1.0 },
              { x: 0.0, y: 1.0 }
            ]
          }
        }
      };
      
      const endpoint = `${this.aiPlatformBaseUrl}/publishers/google/models/occupancy-analytics@1:predict`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Occupancy analytics failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseOccupancyData(data);
      
    } catch (error) {
      console.error('Vertex AI occupancy analytics error:', error);
      return [];
    }
  }

  private async runPersonDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const request = {
        instances: [{
          image: {
            imageBytes: imageBuffer.toString('base64')
          }
        }],
        parameters: {
          confidenceThreshold: 0.6,
          enableBlurring: true
        }
      };
      
      const endpoint = `${this.aiPlatformBaseUrl}/publishers/google/models/person-detection@1:predict`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Person detection failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parsePersonDetections(data);
      
    } catch (error) {
      console.error('Vertex AI person detection error:', error);
      return [];
    }
  }

  private async runPPEDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const request = {
        instances: [{
          image: {
            imageBytes: imageBuffer.toString('base64')
          }
        }],
        parameters: {
          confidenceThreshold: 0.7,
          ppeTypes: ['HARD_HAT', 'SAFETY_VEST', 'SAFETY_GLASSES', 'GLOVES']
        }
      };
      
      const endpoint = `${this.aiPlatformBaseUrl}/publishers/google/models/ppe-detection@1:predict`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`PPE detection failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parsePPEDetections(data);
      
    } catch (error) {
      console.error('Vertex AI PPE detection error:', error);
      return [];
    }
  }

  // Parsing methods for different detection types
  private parseObjectDetections(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];
    
    return data.predictions.flatMap((prediction: any) => {
      if (!prediction.displayNames || !prediction.confidences || !prediction.bboxes) return [];
      
      return prediction.displayNames.map((name: string, index: number) => ({
        type: 'OBJECT_DETECTION',
        label: name,
        confidence: prediction.confidences[index],
        bbox: {
          left: prediction.bboxes[index][0],
          top: prediction.bboxes[index][1],
          right: prediction.bboxes[index][2],
          bottom: prediction.bboxes[index][3]
        }
      }));
    });
  }

  private parseFaceDetections(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];
    
    return data.predictions.flatMap((prediction: any) => {
      if (!prediction.faceAnnotations) return [];
      
      return prediction.faceAnnotations.map((face: any) => ({
        type: 'FACE_DETECTION',
        label: 'Face',
        confidence: face.detectionConfidence || 0.8,
        bbox: {
          left: face.boundingPoly?.vertices?.[0]?.x || 0,
          top: face.boundingPoly?.vertices?.[0]?.y || 0,
          right: face.boundingPoly?.vertices?.[2]?.x || 0,
          bottom: face.boundingPoly?.vertices?.[2]?.y || 0
        },
        attributes: {
          joyLikelihood: face.joyLikelihood,
          sorrowLikelihood: face.sorrowLikelihood,
          angerLikelihood: face.angerLikelihood,
          surpriseLikelihood: face.surpriseLikelihood
        }
      }));
    });
  }

  private parseOccupancyData(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];
    
    return data.predictions.map((prediction: any) => ({
      type: 'OCCUPANCY_COUNT',
      label: 'Occupancy',
      confidence: 0.9,
      count: prediction.personCount || 0,
      dwellTime: prediction.dwellTime || 0,
      activeZone: prediction.activeZone
    }));
  }

  private parsePersonDetections(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];
    
    return data.predictions.flatMap((prediction: any) => {
      if (!prediction.persons) return [];
      
      return prediction.persons.map((person: any) => ({
        type: 'PERSON_DETECTION',
        label: 'Person',
        confidence: person.confidence || 0.8,
        bbox: {
          left: person.bbox?.[0] || 0,
          top: person.bbox?.[1] || 0,
          right: person.bbox?.[2] || 0,
          bottom: person.bbox?.[3] || 0
        },
        blurred: person.blurred || false
      }));
    });
  }

  private parsePPEDetections(data: any): any[] {
    if (!data.predictions || !Array.isArray(data.predictions)) return [];
    
    return data.predictions.flatMap((prediction: any) => {
      if (!prediction.ppeDetections) return [];
      
      return prediction.ppeDetections.map((ppe: any) => ({
        type: 'PPE_DETECTION',
        label: ppe.ppeType || 'PPE',
        confidence: ppe.confidence || 0.7,
        bbox: {
          left: ppe.bbox?.[0] || 0,
          top: ppe.bbox?.[1] || 0,
          right: ppe.bbox?.[2] || 0,
          bottom: ppe.bbox?.[3] || 0
        },
        ppeType: ppe.ppeType,
        isCompliant: ppe.isCompliant
      }));
    });
  }

  private getNodeConfigForModel(model: string): any {
    const nodeConfigs: Record<string, any> = {
      'GENERAL_OBJECT_DETECTION': {
        processor: 'GENERAL_OBJECT_DETECTION_PROCESSOR',
        displayName: 'Object Detection'
      },
      'OCCUPANCY_COUNTING': {
        processor: 'OCCUPANCY_COUNTING_PROCESSOR',
        displayName: 'Occupancy Analytics'
      },
      'PERSON_BLUR': {
        processor: 'PERSON_BLUR_PROCESSOR',
        displayName: 'Person Blur'
      },
      'PPE_DETECTION': {
        processor: 'PPE_DETECTION_PROCESSOR',
        displayName: 'PPE Detection'
      },
      'FACE_DETECTION': {
        processor: 'FACE_DETECTION_PROCESSOR',
        displayName: 'Face Detection'
      }
    };
    
    return nodeConfigs[model] || nodeConfigs['GENERAL_OBJECT_DETECTION'];
  }

  async checkHealth(): Promise<{ status: string; services: any[] }> {
    const services = [];
    
    try {
      // Check Vertex AI Platform connectivity
      const headers = await this.getAuthHeaders();
      const aiResponse = await fetch(`${this.aiPlatformBaseUrl}/publishers`, { headers });
      services.push({
        name: 'Vertex AI Platform',
        status: aiResponse.ok ? 'healthy' : 'unhealthy',
        endpoint: this.aiPlatformBaseUrl
      });
    } catch (error) {
      services.push({
        name: 'Vertex AI Platform',
        status: 'unhealthy',
        error: (error as Error).message
      });
    }
    
    try {
      // Check Vision AI connectivity
      const headers = await this.getAuthHeaders();
      const visionResponse = await fetch(`${this.visionAIBaseUrl}/us-central1/applications`, { headers });
      services.push({
        name: 'Vertex AI Vision',
        status: visionResponse.ok ? 'healthy' : 'unhealthy',
        endpoint: this.visionAIBaseUrl
      });
    } catch (error) {
      services.push({
        name: 'Vertex AI Vision',
        status: 'unhealthy',
        error: (error as Error).message
      });
    }
    
    const allHealthy = services.every(service => service.status === 'healthy');
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      services
    };
  }
}