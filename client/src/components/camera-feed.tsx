import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { VisionApiResponse } from '@shared/schema';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  isProcessing: boolean;
  latestResults: VisionApiResponse | null;
  className?: string;
}

export function CameraFeed({ 
  videoRef, 
  isActive, 
  isProcessing, 
  latestResults, 
  className 
}: CameraFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoResolution, setVideoResolution] = useState('0x0');
  const [videoFps, setVideoFps] = useState(0);

  // Update video stats
  useEffect(() => {
    if (!videoRef.current || !isActive) return;

    const video = videoRef.current;
    
    const updateStats = () => {
      setVideoResolution(`${video.videoWidth}x${video.videoHeight}`);
    };

    const handleLoadedMetadata = () => {
      updateStats();
      // Estimate FPS (simplified)
      setVideoFps(30);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoRef, isActive]);

  // Draw detection overlays
  useEffect(() => {
    if (!latestResults || !canvasRef.current || !videoRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw text detections
    ctx.strokeStyle = '#3B82F6';
    ctx.fillStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.font = '14px Inter, sans-serif';

    latestResults.textDetections.forEach((detection, index) => {
      if (detection.boundingBox) {
        const { x, y, width, height } = detection.boundingBox;
        
        // Draw bounding box
        ctx.strokeRect(x, y, width, height);
        
        // Draw text label with background
        const label = `${detection.text} (${Math.round(detection.confidence * 100)}%)`;
        const textMetrics = ctx.measureText(label);
        const textHeight = 16;
        
        ctx.fillStyle = '#3B82F6';
        ctx.fillRect(x, y - textHeight - 4, textMetrics.width + 8, textHeight + 4);
        
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 4, y - 6);
        ctx.fillStyle = '#3B82F6';
      }
    });

    // Draw object detections
    ctx.strokeStyle = '#10B981';
    ctx.fillStyle = '#10B981';

    latestResults.objectDetections.forEach((detection) => {
      if (detection.boundingBox) {
        const { x, y, width, height } = detection.boundingBox;
        const scaledX = x * canvas.width;
        const scaledY = y * canvas.height;
        const scaledWidth = width * canvas.width;
        const scaledHeight = height * canvas.height;
        
        // Draw bounding box
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
        
        // Draw label
        const label = `${detection.name} (${Math.round(detection.confidence * 100)}%)`;
        const textMetrics = ctx.measureText(label);
        const textHeight = 16;
        
        ctx.fillStyle = '#10B981';
        ctx.fillRect(scaledX, scaledY - textHeight - 4, textMetrics.width + 8, textHeight + 4);
        
        ctx.fillStyle = 'white';
        ctx.fillText(label, scaledX + 4, scaledY - 6);
        ctx.fillStyle = '#10B981';
      }
    });

    // Draw face detections
    ctx.strokeStyle = '#8B5CF6';
    ctx.fillStyle = '#8B5CF6';

    latestResults.faceDetections.forEach((detection, index) => {
      if (detection.boundingBox) {
        const { x, y, width, height } = detection.boundingBox;
        
        // Draw bounding box
        ctx.strokeRect(x, y, width, height);
        
        // Draw label with emotions
        const dominantEmotion = detection.emotions ? 
          Object.entries(detection.emotions).reduce((max, [emotion, likelihood]) => 
            likelihood && ['LIKELY', 'VERY_LIKELY'].includes(likelihood) ? emotion : max, 
            'neutral'
          ) : 'neutral';
        
        const label = `Face ${index + 1} (${dominantEmotion})`;
        const textMetrics = ctx.measureText(label);
        const textHeight = 16;
        
        ctx.fillStyle = '#8B5CF6';
        ctx.fillRect(x, y - textHeight - 4, textMetrics.width + 8, textHeight + 4);
        
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 4, y - 6);
        ctx.fillStyle = '#8B5CF6';
      }
    });

    // Draw logo detections
    ctx.strokeStyle = '#F59E0B';
    ctx.fillStyle = '#F59E0B';

    latestResults.logoDetections.forEach((detection) => {
      if (detection.boundingBox) {
        const { x, y, width, height } = detection.boundingBox;
        
        // Draw bounding box
        ctx.strokeRect(x, y, width, height);
        
        // Draw label
        const label = `${detection.description} (${Math.round(detection.confidence * 100)}%)`;
        const textMetrics = ctx.measureText(label);
        const textHeight = 16;
        
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(x, y - textHeight - 4, textMetrics.width + 8, textHeight + 4);
        
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 4, y - 6);
        ctx.fillStyle = '#F59E0B';
      }
    });

  }, [latestResults, videoRef]);

  const toggleFullscreen = () => {
    if (!videoRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen().catch(console.error);
    }
  };

  return (
    <div className={cn("bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden", className)}>
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <i className="fas fa-camera mr-2 text-blue-600"></i>
          Live Video Feed
          {isProcessing && (
            <span className="ml-auto text-xs bg-green-500 text-white px-2 py-1 rounded-full">
              Processing
            </span>
          )}
        </h3>
      </div>
      
      <div className="relative bg-gray-900 aspect-video">
        {/* Video Element */}
        <video 
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />
        
        {/* Overlay Canvas for AI Results */}
        <canvas 
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
        
        {/* Status Overlay */}
        {isActive && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>LIVE</span>
            </div>
          </div>
        )}
        
        {/* Processing Indicator */}
        {isProcessing && (
          <div className="absolute top-4 right-4 bg-blue-600 bg-opacity-90 text-white px-3 py-2 rounded-lg text-sm flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Processing...</span>
          </div>
        )}
        
        {/* Camera Permission Prompt */}
        {!isActive && (
          <div className="absolute inset-0 bg-gray-800 bg-opacity-90 flex items-center justify-center text-white">
            <div className="text-center">
              <i className="fas fa-camera text-4xl mb-4 text-gray-400"></i>
              <h4 className="text-lg font-semibold mb-2">Camera Access Required</h4>
              <p className="text-gray-300 mb-4">Click "Start Camera" to begin live vision analysis</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Video Controls */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Resolution: <span className="font-medium">{videoResolution}</span>
            </div>
            <div className="text-sm text-gray-600">
              FPS: <span className="font-medium">{videoFps}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              onClick={toggleFullscreen}
              disabled={!isActive}
            >
              <i className="fas fa-expand"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
