import { GoogleAuth, JWT } from 'google-auth-library';
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

export class VertexAIVisionService {
  private auth: GoogleAuth;
  private projectId: string;
  private baseUrl: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'agenticai-466913';
    
    // Use GoogleAuth with service account credentials
    this.auth = new GoogleAuth({
      credentials: JSON.parse(fs.readFileSync('./google-credentials.json', 'utf8')),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      projectId: this.projectId,
    });
    
    this.baseUrl = `https://visionai.googleapis.com/v1/projects/${this.projectId}/locations`;
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
        `${this.baseUrl}/${location}/applications`,
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
    name: string;
    displayName: string;
    location?: string;
    models?: string[];
  }): Promise<VisionApplication> {
    const location = data.location || 'us-central1';
    const headers = await this.getAuthHeaders();

    const applicationData = {
      displayName: data.displayName,
    };

    const response = await fetch(
      `${this.baseUrl}/${location}/applications?applicationId=${data.name}`,
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

  async deployApplication(applicationId: string, location: string = 'us-central1'): Promise<any> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(
      `${this.baseUrl}/${location}/applications/${applicationId}:deploy`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to deploy application: ${errorText}`);
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
      `${this.baseUrl}/${location}/applications/${data.applicationId}/streams?streamId=${data.name}`,
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
    const headers = await this.getAuthHeaders();
    
    // Extract base64 image data (remove data:image/jpeg;base64, prefix)
    const base64Image = data.frameData.split(',')[1];
    
    // Build Cloud Vision API request
    const features = [];
    
    // Add requested features based on models
    if (data.models.includes('OBJECT_DETECTION') || data.models.includes('GENERAL_OBJECT_DETECTION')) {
      features.push({ type: 'OBJECT_LOCALIZATION', maxResults: 10 });
    }
    if (data.models.includes('FACE_DETECTION')) {
      features.push({ type: 'FACE_DETECTION', maxResults: 10 });
    }
    if (data.models.includes('LABEL_DETECTION')) {
      features.push({ type: 'LABEL_DETECTION', maxResults: 10 });
    }
    
    // Default to object detection if no specific models requested
    if (features.length === 0) {
      features.push({ type: 'OBJECT_LOCALIZATION', maxResults: 10 });
      features.push({ type: 'FACE_DETECTION', maxResults: 10 });
    }
    
    const visionRequest = {
      requests: [{
        features: features,
        image: {
          content: base64Image
        }
      }]
    };
    
    try {
      // Use Cloud Vision API for actual object and face detection
      const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visionRequest),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vision API error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      const processingTime = Date.now() - startTime;
      
      // Parse Vision API response into our format
      const detections = this.parseVisionApiResponse(result);
      
      return {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        confidence: this.calculateOverallConfidence(detections),
        processingTime,
        detections,
        applicationId: data.applicationId,
        streamId: data.streamId,
      };
      
    } catch (error) {
      console.error('Cloud Vision API error:', error);
      
      // Fallback to ensure the app continues working even if API fails
      const processingTime = Date.now() - startTime;
      return {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        confidence: 0.0,
        processingTime,
        detections: [{
          type: 'ERROR',
          description: `API Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          confidence: 0.0,
          boundingBox: { x: 0, y: 0, width: 1, height: 1 }
        }],
        applicationId: data.applicationId,
        streamId: data.streamId,
      };
    }
  }
  
  private parseVisionApiResponse(result: any): any[] {
    const detections: any[] = [];
    const responses = result.responses || [];
    
    if (responses.length === 0) return detections;
    
    const response = responses[0];
    
    // Parse object detections
    if (response.localizedObjectAnnotations) {
      for (const obj of response.localizedObjectAnnotations) {
        detections.push({
          type: 'OBJECT_DETECTION',
          description: obj.name || 'Object',
          confidence: obj.score || 0,
          boundingBox: {
            x: obj.boundingPoly?.normalizedVertices?.[0]?.x || 0,
            y: obj.boundingPoly?.normalizedVertices?.[0]?.y || 0,
            width: (obj.boundingPoly?.normalizedVertices?.[2]?.x || 1) - (obj.boundingPoly?.normalizedVertices?.[0]?.x || 0),
            height: (obj.boundingPoly?.normalizedVertices?.[2]?.y || 1) - (obj.boundingPoly?.normalizedVertices?.[0]?.y || 0)
          }
        });
      }
    }
    
    // Parse face detections
    if (response.faceAnnotations) {
      for (const face of response.faceAnnotations) {
        const vertices = face.boundingPoly?.vertices || [];
        if (vertices.length >= 4) {
          // Calculate normalized coordinates
          const x = Math.min(...vertices.map((v: any) => v.x || 0));
          const y = Math.min(...vertices.map((v: any) => v.y || 0));
          const maxX = Math.max(...vertices.map((v: any) => v.x || 0));
          const maxY = Math.max(...vertices.map((v: any) => v.y || 0));
          
          detections.push({
            type: 'FACE_DETECTION',
            description: `Face (Joy: ${this.getLikelihoodText(face.joyLikelihood)})`,
            confidence: face.detectionConfidence || 0.9,
            boundingBox: {
              x: x / 1000, // Normalize assuming typical image width
              y: y / 1000, // Normalize assuming typical image height  
              width: (maxX - x) / 1000,
              height: (maxY - y) / 1000
            },
            emotions: {
              joy: face.joyLikelihood,
              anger: face.angerLikelihood,
              surprise: face.surpriseLikelihood,
              sorrow: face.sorrowLikelihood
            }
          });
        }
      }
    }
    
    // Parse label detections
    if (response.labelAnnotations) {
      for (const label of response.labelAnnotations.slice(0, 5)) { // Top 5 labels
        detections.push({
          type: 'LABEL_DETECTION',
          description: label.description || 'Label',
          confidence: label.score || 0,
          boundingBox: { x: 0, y: 0, width: 1, height: 1 } // Labels don't have bounding boxes
        });
      }
    }
    
    return detections;
  }
  
  private getLikelihoodText(likelihood: string): string {
    const map: { [key: string]: string } = {
      'VERY_UNLIKELY': 'Very Low',
      'UNLIKELY': 'Low',  
      'POSSIBLE': 'Possible',
      'LIKELY': 'High',
      'VERY_LIKELY': 'Very High'
    };
    return map[likelihood] || 'Unknown';
  }
  
  private calculateOverallConfidence(detections: any[]): number {
    if (detections.length === 0) return 0;
    const total = detections.reduce((sum, det) => sum + (det.confidence || 0), 0);
    return total / detections.length;
  }

  async getHealth(): Promise<{ status: string; services: any[] }> {
    try {
      const headers = await this.getAuthHeaders();
      
      // Test connectivity to Vertex AI Vision API
      const response = await fetch(
        `${this.baseUrl}`,
        { headers }
      );

      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        services: [
          {
            name: 'Vertex AI Vision API',
            status: response.ok ? 'available' : 'unavailable',
            lastCheck: new Date().toISOString(),
          }
        ],
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        services: [
          {
            name: 'Vertex AI Vision API',
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            lastCheck: new Date().toISOString(),
          }
        ],
      };
    }
  }
}

export const vertexAIService = new VertexAIVisionService();