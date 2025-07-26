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
  // Enhanced occupancy data properties
  count?: number;
  density?: string;
  densityColor?: string;
  densityDescription?: string;
  displayText?: string;
  style?: React.CSSProperties;
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
    
    // Handle different coordinate systems from Google Cloud Vision API
    if (!bbox && detection.boundingPoly) {
      if (detection.boundingPoly.normalizedVertices) {
        // Normalized coordinates (0-1) - most common from Vision API
        const vertices = detection.boundingPoly.normalizedVertices;
        const minX = Math.min(...vertices.map(v => v.x));
        const minY = Math.min(...vertices.map(v => v.y));
        const maxX = Math.max(...vertices.map(v => v.x));
        const maxY = Math.max(...vertices.map(v => v.y));
        
        bbox = {
          left: minX,
          top: minY,
          right: maxX,
          bottom: maxY
        };
      } else if (detection.boundingPoly.vertices) {
        // Pixel coordinates - convert to normalized
        const vertices = detection.boundingPoly.vertices;
        const minX = Math.min(...vertices.map(v => v.x));
        const minY = Math.min(...vertices.map(v => v.y));
        const maxX = Math.max(...vertices.map(v => v.x));
        const maxY = Math.max(...vertices.map(v => v.y));
        
        bbox = {
          left: minX / videoWidth,
          top: minY / videoHeight,
          right: maxX / videoWidth,
          bottom: maxY / videoHeight
        };
      }
    }

    if (!bbox) return null;

    // Ensure coordinates are within valid range (0-1 for normalized)
    bbox = {
      left: Math.max(0, Math.min(1, bbox.left)),
      top: Math.max(0, Math.min(1, bbox.top)),
      right: Math.max(0, Math.min(1, bbox.right)),
      bottom: Math.max(0, Math.min(1, bbox.bottom))
    };

    // FIXED: Account for video aspect ratio scaling and centering
    // The video has aspect-video class which maintains 16:9 ratio
    // From console log: videoWidth:1280, videoHeight:720, displayWidth:426, displayHeight:240
    const videoAspectRatio = videoWidth / videoHeight; // ~1.78 (16:9)
    const displayAspectRatio = 16 / 9; // 1.78
    
    let adjustedBbox = bbox;
    
    // Since video is object-cover, it might be cropped to fit display area
    // We need to account for the scaling and centering
    if (Math.abs(videoAspectRatio - displayAspectRatio) > 0.01) {
      if (videoAspectRatio > displayAspectRatio) {
        // Video is wider - letterboxed (black bars top/bottom)
        const scale = displayAspectRatio / videoAspectRatio;
        const offset = (1 - scale) / 2;
        adjustedBbox = {
          left: bbox.left,
          top: bbox.top * scale + offset,
          right: bbox.right,
          bottom: bbox.bottom * scale + offset
        };
      } else {
        // Video is taller - pillarboxed (black bars left/right)  
        const scale = videoAspectRatio / displayAspectRatio;
        const offset = (1 - scale) / 2;
        adjustedBbox = {
          left: bbox.left * scale + offset,
          top: bbox.top,
          right: bbox.right * scale + offset,
          bottom: bbox.bottom
        };
      }
    }

    // Convert adjusted coordinates to percentage for CSS positioning
    const left = adjustedBbox.left * 100;
    const top = adjustedBbox.top * 100; 
    const width = (adjustedBbox.right - adjustedBbox.left) * 100;
    const height = (adjustedBbox.bottom - adjustedBbox.top) * 100;

    // Skip invalid bounding boxes
    if (width <= 0 || height <= 0) {
      console.log('Invalid bbox dimensions:', { width, height, bbox });
      return null;
    }

    // Debug logging for alignment troubleshooting
    if (detection.type === 'PERSON_DETECTION' || detection.type === 'FACE_DETECTION') {
      console.log(`${detection.type} alignment debug:`, { 
        originalBbox: detection.bbox,
        normalizedBbox: bbox,
        adjustedBbox,
        cssPercent: { left: left.toFixed(1), top: top.toFixed(1), width: width.toFixed(1), height: height.toFixed(1) },
        videoSize: { videoWidth, videoHeight },
        aspectRatios: { videoAspectRatio: videoAspectRatio.toFixed(3), displayAspectRatio: displayAspectRatio.toFixed(3) }
      });
    }

    const colorClass = getColorForType(detection.type);
    const badgeColor = getBadgeColorForType(detection.type);

    // Special handling for occupancy count display with enhanced density visualization
    if (detection.type === 'OCCUPANCY_COUNT') {
      return (
        <div key={`${detection.type}-${index}`} className="absolute pointer-events-none">
          {/* Enhanced occupancy density display */}
          <div
            className="absolute z-20 font-bold text-white rounded-lg shadow-lg"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              backgroundColor: detection.densityColor || '#22c55e',
              padding: '12px 16px',
              fontSize: '18px',
              border: `3px solid ${detection.densityColor || '#22c55e'}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              minWidth: '250px',
              textAlign: 'center'
            }}
          >
            <div className="flex items-center justify-center space-x-2">
              <span className="text-2xl">👥</span>
              <div>
                <div className="font-extrabold text-xl">
                  {detection.count || 0} PEOPLE
                </div>
                <div className="text-sm opacity-90 font-bold">
                  {detection.density || 'LOW'} DENSITY
                </div>
              </div>
            </div>
            {detection.densityDescription && (
              <div className="text-xs mt-2 opacity-80 bg-black bg-opacity-20 rounded px-2 py-1">
                {detection.densityDescription}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={`${detection.type}-${index}`}
        className={`absolute border-2 ${colorClass} pointer-events-none`}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          transform: 'translate(0, 0)', // Ensure no unexpected transforms
          boxSizing: 'border-box',
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
      style={{ width: '100%', height: '100%' }}
    >
      {detectionsWithBboxes.map((detection, index) => renderBoundingBox(detection, index))}
      
      {/* Detection count indicator */}
      <div className="absolute top-2 right-2 bg-black/60 text-white px-3 py-1 rounded text-sm">
        {detectionsWithBboxes.length} detection{detectionsWithBboxes.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}