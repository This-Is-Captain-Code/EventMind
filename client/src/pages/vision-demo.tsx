import { useState, useEffect, useRef } from 'react';
import { useCamera } from '@/hooks/use-camera';
import { useVertexAI } from '@/hooks/use-vertex-ai';
import { CameraFeed } from '@/components/camera-feed';
import { ControlPanel } from '@/components/control-panel';
import { ResultsPanel } from '@/components/results-panel';
import { useToast } from '@/hooks/use-toast';

export default function VisionDemo() {
  const { toast } = useToast();
  const [processingInterval, setProcessingInterval] = useState(2000);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isActive,
    isLoading,
    stream,
    devices,
    selectedDeviceId,
    error: cameraError,
    videoRef,
    startCamera,
    stopCamera,
    captureFrame,
    switchDevice,
  } = useCamera();

  const {
    features,
    updateFeature,
    isProcessing,
    latestResults,
    performanceStats,
    apiLog,
    analyzeImage,
    clearApiLog,
    error: aiError,
  } = useVertexAI();

  // Handle camera errors
  useEffect(() => {
    if (cameraError) {
      toast({
        title: "Camera Error",
        description: cameraError,
        variant: "destructive",
      });
    }
  }, [cameraError, toast]);

  // Handle AI errors
  useEffect(() => {
    if (aiError) {
      toast({
        title: "AI Processing Error",
        description: aiError instanceof Error ? aiError.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  }, [aiError, toast]);

  // Start/stop processing based on camera state and enabled features
  useEffect(() => {
    if (isActive && Object.values(features).some(Boolean)) {
      // Start processing interval
      intervalRef.current = setInterval(() => {
        const frameData = captureFrame();
        if (frameData && !isProcessing) {
          analyzeImage(frameData);
        }
      }, processingInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Stop processing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isActive, features, processingInterval, captureFrame, analyzeImage, isProcessing]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleToggleCamera = async () => {
    if (isActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  const handleSetProcessingInterval = (interval: number) => {
    setProcessingInterval(interval);
    
    // Restart interval with new timing if currently active
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        const frameData = captureFrame();
        if (frameData && !isProcessing) {
          analyzeImage(frameData);
        }
      }, interval);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <i className="fas fa-eye text-white text-sm"></i>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Vertex AI Vision</h1>
                <p className="text-xs text-gray-500">Live Demo Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <ControlPanel
              isActive={isActive}
              isLoading={isLoading}
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              onToggleCamera={handleToggleCamera}
              onSwitchDevice={switchDevice}
              features={features}
              onUpdateFeature={updateFeature}
              performanceStats={performanceStats}
              processingInterval={processingInterval}
              onSetProcessingInterval={handleSetProcessingInterval}
            />
          </div>

          {/* Video Feed */}
          <div className="lg:col-span-2">
            <CameraFeed
              videoRef={videoRef}
              isActive={isActive}
              isProcessing={isProcessing}
              latestResults={latestResults}
            />
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-1">
            <ResultsPanel
              latestResults={latestResults}
              apiLog={apiLog}
              onClearLog={clearApiLog}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
