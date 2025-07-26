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
            
          case 'TEXT_DETECTION':
            const textData = await this.runTextDetection(imageBuffer);
            detections.push(...textData);
            break;
            
          case 'LOGO_DETECTION':
            const logoData = await this.runLogoDetection(imageBuffer);
            detections.push(...logoData);
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
      // Use Gemini 2.5 Flash for object detection with bounding boxes
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }

      const request = {
        contents: [{
          parts: [
            {
              text: "Detect objects in this image and provide bounding box coordinates. Return JSON format: [{\"object\": \"object_name\", \"confidence\": 0.95, \"box\": [y_min, x_min, y_max, x_max]}]. Use normalized 0-1000 coordinates."
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: imageBuffer.toString('base64')
              }
            }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Gemini API failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseGeminiObjectDetections(data);
      
    } catch (error) {
      console.error('Gemini object detection error:', error);
      return [];
    }
  }

  private async runFaceDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const request = {
        requests: [{
          image: {
            content: imageBuffer.toString('base64')
          },
          features: [{
            type: 'FACE_DETECTION',
            maxResults: 10
          }]
        }]
      };
      
      const endpoint = 'https://vision.googleapis.com/v1/images:annotate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Vision API response: ${errorText}`);
        throw new Error(`Face detection failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseVisionAPIFaceResponse(data);
      
    } catch (error) {
      console.error('Vertex AI face detection error:', error);
      return [];
    }
  }

  private async runOccupancyAnalytics(imageBuffer: Buffer): Promise<any[]> {
    try {
      // Use person detection from Vision API to estimate occupancy
      const headers = await this.getAuthHeaders();
      
      const request = {
        requests: [{
          image: {
            content: imageBuffer.toString('base64')
          },
          features: [
            {
              type: 'OBJECT_LOCALIZATION',
              maxResults: 50  // Higher limit to catch all people
            }
          ]
        }]
      };
      
      const endpoint = 'https://vision.googleapis.com/v1/images:annotate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Occupancy analytics failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseOccupancyFromObjects(data);
      
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
      // Use object detection to identify safety equipment
      const headers = await this.getAuthHeaders();
      
      const request = {
        requests: [{
          image: {
            content: imageBuffer.toString('base64')
          },
          features: [{
            type: 'OBJECT_LOCALIZATION',
            maxResults: 20
          }]
        }]
      };
      
      const endpoint = 'https://vision.googleapis.com/v1/images:annotate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`PPE detection failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parsePPEFromObjects(data);
      
    } catch (error) {
      console.error('Vertex AI PPE detection error:', error);
      return [];
    }
  }

  private async runTextDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const request = {
        requests: [{
          image: {
            content: imageBuffer.toString('base64')
          },
          features: [{
            type: 'TEXT_DETECTION',
            maxResults: 50
          }]
        }]
      };
      
      const endpoint = 'https://vision.googleapis.com/v1/images:annotate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Text detection failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseTextDetections(data);
      
    } catch (error) {
      console.error('Text detection error:', error);
      return [];
    }
  }

  private async runLogoDetection(imageBuffer: Buffer): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const request = {
        requests: [{
          image: {
            content: imageBuffer.toString('base64')
          },
          features: [{
            type: 'LOGO_DETECTION',
            maxResults: 10
          }]
        }]
      };
      
      const endpoint = 'https://vision.googleapis.com/v1/images:annotate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Logo detection failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseLogoDetections(data);
      
    } catch (error) {
      console.error('Logo detection error:', error);
      return [];
    }
  }

  // Enhanced parsing methods for Vision API responses with detailed bounding boxes
  private parseVisionAPIResponse(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];
    
    const detections: any[] = [];
    
    data.responses.forEach((response: any) => {
      // Parse object localizations with precise bounding boxes
      if (response.localizedObjectAnnotations) {
        response.localizedObjectAnnotations.forEach((obj: any) => {
          const vertices = obj.boundingPoly?.normalizedVertices || [];
          if (vertices.length >= 4) {
            detections.push({
              type: 'OBJECT_DETECTION',
              label: obj.name || 'Object',
              confidence: obj.score || 0.5,
              bbox: {
                left: vertices[0].x || 0,
                top: vertices[0].y || 0,
                right: vertices[2].x || 0,
                bottom: vertices[2].y || 0
              },
              boundingPoly: {
                normalizedVertices: vertices
              }
            });
          }
        });
      }
      
      // Parse label detections for additional context
      if (response.labelAnnotations) {
        response.labelAnnotations.slice(0, 5).forEach((label: any) => {
          detections.push({
            type: 'LABEL_DETECTION',
            label: label.description || 'Label',
            confidence: label.score || 0.5,
            topicality: label.topicality || 0
          });
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
              type: 'FACE_DETECTION',
              label: 'Face',
              confidence: face.detectionConfidence || 0.8,
              bbox: {
                left: vertices[0].x || 0,
                top: vertices[0].y || 0,
                right: vertices[2].x || 0,
                bottom: vertices[2].y || 0
              },
              boundingPoly: {
                vertices: vertices
              },
              emotions: {
                joy: this.getLikelihoodScore(face.joyLikelihood),
                sorrow: this.getLikelihoodScore(face.sorrowLikelihood),
                anger: this.getLikelihoodScore(face.angerLikelihood),
                surprise: this.getLikelihoodScore(face.surpriseLikelihood)
              },
              landmarks: face.landmarks?.map((landmark: any) => ({
                type: landmark.type,
                position: landmark.position
              })) || []
            });
          }
        });
      }
    });
    
    return detections;
  }

  private getLikelihoodScore(likelihood: string): number {
    const scores = {
      'VERY_UNLIKELY': 0.1,
      'UNLIKELY': 0.3,
      'POSSIBLE': 0.5,
      'LIKELY': 0.7,
      'VERY_LIKELY': 0.9
    };
    return scores[likelihood as keyof typeof scores] || 0.5;
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

  private parseOccupancyFromObjects(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];
    
    let personCount = 0;
    const personDetections: any[] = [];
    
    data.responses.forEach((response: any) => {
      if (response.localizedObjectAnnotations) {
        response.localizedObjectAnnotations.forEach((obj: any) => {
          if (obj.name === 'Person' && obj.score > 0.5) {
            personCount++;
            const vertices = obj.boundingPoly?.normalizedVertices || [];
            if (vertices.length >= 4) {
              personDetections.push({
                type: 'PERSON_DETECTION',
                label: 'Person',
                confidence: obj.score,
                bbox: {
                  left: vertices[0].x || 0,
                  top: vertices[0].y || 0,
                  right: vertices[2].x || 0,
                  bottom: vertices[2].y || 0
                }
              });
            }
          }
        });
      }
    });
    
    // Add occupancy summary
    const occupancyData = [{
      type: 'OCCUPANCY_COUNT',
      label: `Occupancy: ${personCount} people`,
      confidence: 0.9,
      count: personCount,
      density: personCount > 10 ? 'High' : personCount > 5 ? 'Medium' : 'Low'
    }];
    
    return [...occupancyData, ...personDetections];
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

  private parsePPEFromObjects(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];
    
    const ppeItems: any[] = [];
    const safetyKeywords = ['helmet', 'hard hat', 'safety vest', 'gloves', 'goggles', 'mask'];
    
    data.responses.forEach((response: any) => {
      if (response.localizedObjectAnnotations) {
        response.localizedObjectAnnotations.forEach((obj: any) => {
          const objName = (obj.name || '').toLowerCase();
          const isPPE = safetyKeywords.some(keyword => objName.includes(keyword));
          
          if (isPPE && obj.score > 0.5) {
            const vertices = obj.boundingPoly?.normalizedVertices || [];
            if (vertices.length >= 4) {
              ppeItems.push({
                type: 'PPE_DETECTION',
                label: `Safety Equipment: ${obj.name}`,
                confidence: obj.score,
                bbox: {
                  left: vertices[0].x || 0,
                  top: vertices[0].y || 0,
                  right: vertices[2].x || 0,
                  bottom: vertices[2].y || 0
                },
                ppeType: obj.name,
                isCompliant: true
              });
            }
          }
        });
      }
    });
    
    return ppeItems;
  }

  private parseTextDetections(data: any): any[] {
    if (!data.responses || !Array.isArray(data.responses)) return [];
    
    const textDetections: any[] = [];
    
    data.responses.forEach((response: any) => {
      if (response.textAnnotations) {
        response.textAnnotations.slice(1).forEach((text: any) => { // Skip first full text annotation
          const vertices = text.boundingPoly?.vertices || [];
          if (vertices.length >= 4 && text.description) {
            textDetections.push({
              type: 'TEXT_DETECTION',
              label: text.description,
              confidence: 0.9,
              bbox: {
                left: vertices[0].x || 0,
                top: vertices[0].y || 0,
                right: vertices[2].x || 0,
                bottom: vertices[2].y || 0
              },
              text: text.description,
              locale: text.locale || 'en'
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
              type: 'LOGO_DETECTION',
              label: `Logo: ${logo.description}`,
              confidence: logo.score || 0.8,
              bbox: {
                left: vertices[0].x || 0,
                top: vertices[0].y || 0,
                right: vertices[2].x || 0,
                bottom: vertices[2].y || 0
              },
              logoName: logo.description
            });
          }
        });
      }
    });
    
    return logoDetections;
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