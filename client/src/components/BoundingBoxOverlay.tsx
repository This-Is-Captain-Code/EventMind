import React from 'react';
import { Badge } from '@/components/ui/badge';

interface Detection {
  type: string;
  label: string;
  confidence: number;
  bbox?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  boundingPoly?: {
    normalizedVertices?: Array<{ x: number; y: number }>;
    vertices?: Array<{ x: number; y: number }>;
  };
  emotions?: {
    joy: number;
    sorrow: number;
    anger: number;
    surprise: number;
  };
  text?: string;
  logoName?: string;
  ppeType?: string;
}

interface BoundingBoxOverlayProps {
  detections: Detection[];
  videoWidth: number;
  videoHeight: number;
  className?: string;
}

export function BoundingBoxOverlay({ detections, videoWidth, videoHeight, className = '' }: BoundingBoxOverlayProps) {
  const getColorForType = (type: string): string => {
    const colors = {
      'OBJECT_DETECTION': 'border-blue-500 bg-blue-500/10',
      'FACE_DETECTION': 'border-green-500 bg-green-500/10',
      'TEXT_DETECTION': 'border-purple-500 bg-purple-500/10',
      'LOGO_DETECTION': 'border-orange-500 bg-orange-500/10',
      'PPE_DETECTION': 'border-yellow-500 bg-yellow-500/10',
      'PERSON_DETECTION': 'border-red-500 bg-red-500/10',
      'OCCUPANCY_COUNT': 'border-cyan-500 bg-cyan-500/10',
      'LABEL_DETECTION': 'border-gray-500 bg-gray-500/10'
    };
    return colors[type as keyof typeof colors] || 'border-gray-400 bg-gray-400/10';
  };

  const getBadgeColorForType = (type: string): string => {
    const colors = {
      'OBJECT_DETECTION': 'bg-blue-600',
      'FACE_DETECTION': 'bg-green-600',
      'TEXT_DETECTION': 'bg-purple-600',
      'LOGO_DETECTION': 'bg-orange-600',
      'PPE_DETECTION': 'bg-yellow-600',
      'PERSON_DETECTION': 'bg-red-600',
      'OCCUPANCY_COUNT': 'bg-cyan-600',
      'LABEL_DETECTION': 'bg-gray-600'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-600';
  };

  const renderBoundingBox = (detection: Detection, index: number) => {
    let bbox = detection.bbox;
    
    // Handle different coordinate systems
    if (!bbox && detection.boundingPoly) {
      if (detection.boundingPoly.normalizedVertices) {
        // Normalized coordinates (0-1)
        const vertices = detection.boundingPoly.normalizedVertices;
        bbox = {
          left: vertices[0].x,
          top: vertices[0].y,
          right: vertices[2].x,
          bottom: vertices[2].y
        };
      } else if (detection.boundingPoly.vertices) {
        // Pixel coordinates
        const vertices = detection.boundingPoly.vertices;
        bbox = {
          left: vertices[0].x / videoWidth,
          top: vertices[0].y / videoHeight,
          right: vertices[2].x / videoWidth,
          bottom: vertices[2].y / videoHeight
        };
      }
    }

    if (!bbox) return null;

    // Convert normalized coordinates to pixel coordinates
    const left = bbox.left * videoWidth;
    const top = bbox.top * videoHeight;
    const width = (bbox.right - bbox.left) * videoWidth;
    const height = (bbox.bottom - bbox.top) * videoHeight;

    // Skip invalid bounding boxes
    if (width <= 0 || height <= 0) return null;

    const colorClass = getColorForType(detection.type);
    const badgeColor = getBadgeColorForType(detection.type);

    return (
      <div
        key={`${detection.type}-${index}`}
        className={`absolute border-2 ${colorClass} pointer-events-none`}
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Label badge */}
        <Badge 
          className={`absolute -top-6 left-0 text-xs ${badgeColor} text-white border-none`}
          style={{ fontSize: '10px', padding: '2px 6px' }}
        >
          {detection.label}
          {detection.confidence && (
            <span className="ml-1 opacity-80">
              {Math.round(detection.confidence * 100)}%
            </span>
          )}
        </Badge>

        {/* Additional info for face detection */}
        {detection.emotions && (
          <div className="absolute -bottom-8 left-0 text-xs text-white bg-black/60 px-2 py-1 rounded">
            Joy: {Math.round(detection.emotions.joy * 100)}%
          </div>
        )}

        {/* Additional info for text detection */}
        {detection.text && detection.text.length > 20 && (
          <div className="absolute -bottom-8 left-0 text-xs text-white bg-black/60 px-2 py-1 rounded max-w-40 truncate">
            "{detection.text}"
          </div>
        )}

        {/* Additional info for PPE detection */}
        {detection.ppeType && (
          <div className="absolute -bottom-8 left-0 text-xs text-white bg-black/60 px-2 py-1 rounded">
            {detection.ppeType}
          </div>
        )}
      </div>
    );
  };

  // Only render if we have detections with bounding boxes
  const detectionsWithBboxes = detections.filter(d => d.bbox || d.boundingPoly);

  if (detectionsWithBboxes.length === 0) {
    return null;
  }

  return (
    <div 
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: videoWidth, height: videoHeight }}
    >
      {detectionsWithBboxes.map((detection, index) => renderBoundingBox(detection, index))}
      
      {/* Detection count indicator */}
      <div className="absolute top-2 right-2 bg-black/60 text-white px-3 py-1 rounded text-sm">
        {detectionsWithBboxes.length} detection{detectionsWithBboxes.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}