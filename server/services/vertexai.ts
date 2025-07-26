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
      // Use Vertex AI Gemini for advanced multimodal vision analysis
      const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
      
      // Build comprehensive analysis prompt
      const analysisPrompt = this.buildAnalysisPrompt(data.models);
      
      const geminiRequest = {
        contents: [{
          parts: [
            { text: analysisPrompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      };
      
      const response = await fetch(`${geminiEndpoint}?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiRequest),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vision API error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      const processingTime = Date.now() - startTime;
      
      // Parse Gemini vision response into our format
      const detections = this.parseGeminiVisionResponse(result);
      
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
      console.error('Vertex AI Gemini error:', error);
      
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
  
  private buildAnalysisPrompt(models: string[]): string {
    return `You are a computer vision AI assistant. Analyze this image and detect objects, faces, and notable features.

Return your response as a JSON object with this exact structure:
{
  "detections": [
    {
      "type": "OBJECT_DETECTION",
      "description": "Person",
      "confidence": 0.95,
      "boundingBox": {
        "x": 0.2,
        "y": 0.1,
        "width": 0.3,
        "height": 0.6
      }
    },
    {
      "type": "FACE_DETECTION", 
      "description": "Human face",
      "confidence": 0.92,
      "boundingBox": {
        "x": 0.4,
        "y": 0.15,
        "width": 0.15,
        "height": 0.2
      }
    }
  ]
}

Requirements:
- Scan the entire image for people, faces, objects, vehicles, animals, furniture, text, logos
- Use normalized coordinates (0.0 to 1.0) where (0,0) is top-left corner
- Confidence should be 0.7-0.99 for clear detections
- Include at least 1-5 detections if you see anything recognizable
- Types: "OBJECT_DETECTION", "FACE_DETECTION", "LABEL_DETECTION", "TEXT_DETECTION"

Respond with ONLY the JSON, no additional text.`;
  }
  
  private parseGeminiVisionResponse(result: any): any[] {
    try {
      console.log('Full Gemini response:', JSON.stringify(result, null, 2));
      
      const candidates = result.candidates || [];
      if (candidates.length === 0) {
        console.log('No candidates in response');
        return [];
      }
      
      const content = candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        console.log('No content or parts in response');
        return [];
      }
      
      const textResponse = content.parts[0].text;
      console.log('Gemini text response:', textResponse);
      
      if (!textResponse) {
        console.log('No text response from Gemini');
        return [];
      }
      
      // Parse JSON response from Gemini
      const parsed = JSON.parse(textResponse);
      console.log('Parsed detections:', parsed.detections);
      return parsed.detections || [];
      
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      console.error('Raw result:', result);
      // Return empty array for parsing errors
      return [];
    }
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