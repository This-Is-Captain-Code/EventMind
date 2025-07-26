import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { VertexAIFeatures, PerformanceStats } from '@/hooks/use-vertex-ai';
import type { CameraDevice } from '@/hooks/use-camera';

interface ControlPanelProps {
  // Camera controls
  isActive: boolean;
  isLoading: boolean;
  devices: CameraDevice[];
  selectedDeviceId: string | null;
  onToggleCamera: () => void;
  onSwitchDevice: (deviceId: string) => void;
  
  // AI features
  features: VertexAIFeatures;
  onUpdateFeature: (feature: keyof VertexAIFeatures, enabled: boolean) => void;
  
  // Performance stats
  performanceStats: PerformanceStats;
  
  // Processing interval
  processingInterval: number;
  onSetProcessingInterval: (interval: number) => void;
}

export function ControlPanel({
  isActive,
  isLoading,
  devices,
  selectedDeviceId,
  onToggleCamera,
  onSwitchDevice,
  features,
  onUpdateFeature,
  performanceStats,
  processingInterval,
  onSetProcessingInterval,
}: ControlPanelProps) {
  const [connectionStatus] = useState('Connected');

  const featureConfig = [
    { key: 'textDetection' as const, label: 'Text Detection (OCR)', icon: 'fas fa-font', color: 'text-blue-500' },
    { key: 'objectDetection' as const, label: 'Object Detection', icon: 'fas fa-cube', color: 'text-green-500' },
    { key: 'faceDetection' as const, label: 'Face Detection', icon: 'fas fa-user', color: 'text-purple-500' },
    { key: 'logoDetection' as const, label: 'Logo Detection', icon: 'fas fa-copyright', color: 'text-yellow-500' },
    { key: 'safeSearch' as const, label: 'Safe Search', icon: 'fas fa-shield-alt', color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Camera Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-video mr-2 text-blue-600"></i>
            Camera Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={onToggleCamera}
            disabled={isLoading}
            className={`w-full font-medium ${
              isActive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Loading...
              </>
            ) : (
              <>
                <i className={`fas ${isActive ? 'fa-stop' : 'fa-play'} mr-2`}></i>
                {isActive ? 'Stop Camera' : 'Start Camera'}
              </>
            )}
          </Button>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Camera Source</Label>
            <Select value={selectedDeviceId || undefined} onValueChange={onSwitchDevice}>
              <SelectTrigger>
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {devices.length > 0 ? (
                  devices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-devices" disabled>
                    No cameras found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Processing Interval</Label>
            <Select value={processingInterval.toString()} onValueChange={(value) => onSetProcessingInterval(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1 second</SelectItem>
                <SelectItem value="2000">2 seconds</SelectItem>
                <SelectItem value="5000">5 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI Features Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-brain mr-2 text-blue-600"></i>
            AI Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {featureConfig.map((feature) => (
            <div key={feature.key} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <i className={`${feature.icon} ${feature.color}`}></i>
                <span className="text-sm font-medium text-gray-700">{feature.label}</span>
              </div>
              <Switch
                checked={features[feature.key]}
                onCheckedChange={(checked) => onUpdateFeature(feature.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-chart-line mr-2 text-blue-600"></i>
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">API Calls/min</span>
            <span className="text-sm font-semibold text-gray-900">
              {performanceStats.apiCallsPerMinute}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Avg Response</span>
            <span className="text-sm font-semibold text-gray-900">
              {performanceStats.avgResponseTime}ms
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Success Rate</span>
            <span className="text-sm font-semibold text-green-500">
              {performanceStats.successRate}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Connection</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">{connectionStatus}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
