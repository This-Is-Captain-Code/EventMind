import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCamera } from '@/hooks/use-camera';
import { Smartphone, Wifi, WifiOff, Camera, CameraOff } from 'lucide-react';

export default function MobileClient() {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [streamingInterval, setStreamingInterval] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const {
    isStreaming: cameraActive,
    startCamera,
    stopCamera,
    videoRef,
    error: cameraError,
    devices,
    selectedDevice,
    selectDevice,
  } = useCamera();

  // Connect to dashboard WebSocket
  const connectToDashboard = () => {
    setConnectionStatus('connecting');
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/mobile`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('Connected to dashboard');
    };
    
    wsRef.current.onclose = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      console.log('Disconnected from dashboard');
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
  };

  // Disconnect from dashboard
  const disconnectFromDashboard = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  // Capture and send frame to dashboard
  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isConnected || !wsRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 and send to dashboard
    const frameData = canvas.toDataURL('image/jpeg', 0.7);
    
    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'video_frame',
        data: frameData,
        timestamp: Date.now(),
        deviceId: selectedDevice,
        clientInfo: {
          userAgent: navigator.userAgent,
          screenSize: { width: window.screen.width, height: window.screen.height }
        }
      }));
    }
  };

  // Start streaming frames to dashboard
  const startStreaming = () => {
    if (!cameraActive || !isConnected) return;
    
    setIsStreaming(true);
    const interval = setInterval(captureAndSendFrame, 1000); // Send frame every second
    setStreamingInterval(interval);
  };

  // Stop streaming frames
  const stopStreaming = () => {
    setIsStreaming(false);
    if (streamingInterval) {
      clearInterval(streamingInterval);
      setStreamingInterval(null);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamingInterval) clearInterval(streamingInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [streamingInterval]);

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-600';
      case 'connecting': return 'bg-yellow-600';
      case 'disconnected': return 'bg-red-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Smartphone className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Mobile Client
            </h1>
          </div>
          <Badge className={`${getConnectionColor()} text-white`}>
            {connectionStatus.toUpperCase()}
          </Badge>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Stream video from your mobile device to the safety monitoring dashboard
        </p>
      </div>

      {/* Connection Controls */}
      <Card className="p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          {isConnected ? <Wifi className="h-5 w-5 mr-2 text-green-600" /> : <WifiOff className="h-5 w-5 mr-2 text-red-600" />}
          Dashboard Connection
        </h2>
        <div className="space-y-4">
          {!isConnected ? (
            <Button 
              onClick={connectToDashboard} 
              disabled={connectionStatus === 'connecting'}
              className="w-full"
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect to Dashboard'}
            </Button>
          ) : (
            <Button 
              onClick={disconnectFromDashboard} 
              variant="destructive"
              className="w-full"
            >
              Disconnect from Dashboard
            </Button>
          )}
        </div>
      </Card>

      {/* Camera Controls */}
      <Card className="p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          {cameraActive ? <Camera className="h-5 w-5 mr-2 text-green-600" /> : <CameraOff className="h-5 w-5 mr-2 text-gray-600" />}
          Camera Controls
        </h2>
        
        {cameraError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
            Camera Error: {cameraError}
          </div>
        )}

        <div className="space-y-4">
          {/* Camera Device Selection */}
          {devices.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-2">Select Camera:</label>
              <select 
                value={selectedDevice || ''} 
                onChange={(e) => selectDevice(e.target.value)}
                className="w-full p-2 border rounded"
              >
                {devices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!cameraActive ? (
            <Button onClick={startCamera} className="w-full">
              Start Camera
            </Button>
          ) : (
            <Button onClick={stopCamera} variant="destructive" className="w-full">
              Stop Camera
            </Button>
          )}
        </div>
      </Card>

      {/* Video Preview */}
      {cameraActive && (
        <Card className="p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">Video Preview</h2>
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg bg-black"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </Card>
      )}

      {/* Streaming Controls */}
      {cameraActive && isConnected && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Stream to Dashboard</h2>
          <div className="space-y-4">
            {!isStreaming ? (
              <Button onClick={startStreaming} className="w-full bg-green-600 hover:bg-green-700">
                Start Streaming to Dashboard
              </Button>
            ) : (
              <Button onClick={stopStreaming} variant="destructive" className="w-full">
                Stop Streaming
              </Button>
            )}
            
            {isStreaming && (
              <div className="text-center">
                <Badge className="bg-green-600 text-white animate-pulse">
                  STREAMING LIVE
                </Badge>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Sending frames to dashboard for AI analysis
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-4 mt-6 bg-blue-50 dark:bg-blue-900/20">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">How to Use:</h3>
        <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
          <li>Make sure your dashboard is open on another device</li>
          <li>Connect to the dashboard using the button above</li>
          <li>Start your camera and select the appropriate device</li>
          <li>Begin streaming to send video frames for AI analysis</li>
          <li>View results and analysis on the dashboard in real-time</li>
        </ol>
      </Card>
    </div>
  );
}