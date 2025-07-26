import { GoogleGenAI } from '@google/genai';
import type { VisionApiResponse, VisionApiRequest, TextDetection, ObjectDetection, FaceDetection, LogoDetection, SafeSearchAnnotation } from '@shared/schema';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export async function analyzeImage(request: VisionApiRequest): Promise<VisionApiResponse> {
  const startTime = Date.now();
  
  try {
    const ai = getClient();
    
    // Clean the base64 data
    const imageData = request.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Build analysis prompt based on enabled features
    const features = [];
    if (request.features.textDetection) features.push('text detection (OCR)');
    if (request.features.objectDetection) features.push('object detection');
    if (request.features.faceDetection) features.push('face detection');
    if (request.features.logoDetection) features.push('logo detection');
    if (request.features.safeSearch) features.push('content safety analysis');

    if (features.length === 0) {
      throw new Error('At least one feature must be enabled');
    }

    const prompt = `Analyze this image for ${features.join(', ')}. Return a JSON response with the following structure:
{
  "textDetections": [{"text": "detected text", "confidence": 0.95}],
  "objectDetections": [{"name": "object name", "confidence": 0.85}],
  "faceDetections": [{"confidence": 0.90, "emotions": {"joy": "LIKELY", "sorrow": "UNLIKELY", "anger": "UNLIKELY", "surprise": "UNLIKELY"}}],
  "logoDetections": [{"description": "brand name", "confidence": 0.80}],
  "safeSearchAnnotation": {"adult": "UNLIKELY", "spoof": "VERY_UNLIKELY", "medical": "UNLIKELY", "violence": "UNLIKELY", "racy": "UNLIKELY", "overall": "SAFE"}
}

Only include arrays for enabled features. Use confidence values between 0 and 1. For emotions and safety, use: VERY_UNLIKELY, UNLIKELY, POSSIBLE, LIKELY, VERY_LIKELY.`;

    const contents = [
      {
        inlineData: {
          data: imageData,
          mimeType: "image/jpeg",
        },
      },
      prompt,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: contents,
      config: {
        responseMimeType: "application/json",
      },
    });

    const processingTime = Date.now() - startTime;
    
    if (!response.text) {
      throw new Error('Empty response from Gemini API');
    }

    const result = JSON.parse(response.text);

    // Ensure proper structure with defaults
    const visionResponse: VisionApiResponse = {
      textDetections: result.textDetections || [],
      objectDetections: result.objectDetections || [],
      faceDetections: result.faceDetections || [],
      logoDetections: result.logoDetections || [],
      safeSearchAnnotation: result.safeSearchAnnotation || {
        adult: 'UNKNOWN',
        spoof: 'UNKNOWN',
        medical: 'UNKNOWN',
        violence: 'UNKNOWN',
        racy: 'UNKNOWN',
        overall: 'SAFE',
      },
      processingTime,
    };

    // Determine overall safety if not provided
    if (visionResponse.safeSearchAnnotation && !visionResponse.safeSearchAnnotation.overall) {
      const riskLevels = ['VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
      const maxRiskIndex = Math.max(
        riskLevels.indexOf(visionResponse.safeSearchAnnotation.adult),
        riskLevels.indexOf(visionResponse.safeSearchAnnotation.violence),
        riskLevels.indexOf(visionResponse.safeSearchAnnotation.racy)
      );
      
      if (maxRiskIndex >= 3) {
        visionResponse.safeSearchAnnotation.overall = 'UNSAFE';
      } else if (maxRiskIndex >= 2) {
        visionResponse.safeSearchAnnotation.overall = 'MODERATE';
      } else {
        visionResponse.safeSearchAnnotation.overall = 'SAFE';
      }
    }

    return visionResponse;

  } catch (error) {
    console.error('Gemini Vision API error:', error);
    throw new Error(`Vision API analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
