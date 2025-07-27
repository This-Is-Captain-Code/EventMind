import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Wifi, WifiOff, Video, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StreamingConfig {
  deviceId: string;
  streamKey: string;
  rtmpUrl: string;
  playbackUrl: string;
  instructions: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
  recommendedApps: string[];
}

export default function MobileClient() {
  const [deviceId, setDeviceId] = useState(() => 
    `mobile_${Math.random().toString(36).substr(2, 9)}`
  );
  const [streamingConfig, setStreamingConfig] = useState<StreamingConfig | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  // Register device for RTMP streaming
  const registerDevice = async () => {
    try {
      const response = await fetch('/api/streaming/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId,
          deviceInfo: {
            userAgent: navigator.userAgent,
            screenSize: { 
              width: window.screen.width, 
              height: window.screen.height 
            },
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register device');
      }

      const config = await response.json();
      setStreamingConfig(config);
      setIsRegistered(true);
      
      toast({
        title: "Device Registered",
        description: "Your streaming URLs have been generated successfully"
      });
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "Failed to register device",
        variant: "destructive"
      });
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  // Open app store links for recommended apps
  const openAppStore = (appName: string) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const searchQuery = encodeURIComponent(appName);
    
    const url = isIOS 
      ? `https://apps.apple.com/search?term=${searchQuery}`
      : `https://play.google.com/store/search?q=${searchQuery}`;
    
    window.open(url, '_blank');
  };

  // Generate a new device ID
  const generateNewDeviceId = () => {
    const newId = `mobile_${Math.random().toString(36).substr(2, 9)}`;
    setDeviceId(newId);
    setIsRegistered(false);
    setStreamingConfig(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Smartphone className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Mobile RTMP Streaming
            </h1>
          </div>
          <Badge className={`${isRegistered ? 'bg-green-600' : 'bg-gray-600'} text-white`}>
            {isRegistered ? 'READY' : 'NOT REGISTERED'}
          </Badge>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Professional RTMP streaming for multiple mobile devices to the safety monitoring dashboard
        </p>
      </div>

      {/* Device Registration */}
      <Card className="p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Video className="h-5 w-5 mr-2 text-blue-600" />
          Device Registration
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Device ID:</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="flex-1 p-2 border rounded text-sm"
                placeholder="Enter unique device ID"
                disabled={isRegistered}
              />
              <Button
                onClick={generateNewDeviceId}
                variant="outline"
                size="sm"
                disabled={isRegistered}
              >
                Generate
              </Button>
            </div>
          </div>

          {!isRegistered ? (
            <Button 
              onClick={registerDevice} 
              className="w-full"
              disabled={!deviceId.trim()}
            >
              Register Device for Streaming
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button 
                onClick={generateNewDeviceId} 
                variant="outline"
                className="flex-1"
              >
                Reset Device
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Streaming Configuration */}
      {streamingConfig && (
        <Card className="p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
            Streaming Configuration
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">RTMP Stream URL:</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={streamingConfig.rtmpUrl}
                  readOnly
                  className="flex-1 p-2 border rounded text-sm bg-gray-50 font-mono text-xs"
                />
                <Button
                  onClick={() => copyToClipboard(streamingConfig.rtmpUrl, 'RTMP URL')}
                  variant="outline"
                  size="sm"
                >
                  {copied === 'RTMP URL' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Stream Key:</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={streamingConfig.streamKey}
                  readOnly
                  className="flex-1 p-2 border rounded text-sm bg-gray-50 font-mono"
                />
                <Button
                  onClick={() => copyToClipboard(streamingConfig.streamKey, 'Stream Key')}
                  variant="outline"
                  size="sm"
                >
                  {copied === 'Stream Key' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Recommended Apps */}
      {streamingConfig && (
        <Card className="p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">Recommended RTMP Apps</h2>
          <div className="space-y-3">
            {streamingConfig.recommendedApps.map((app, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium">{app}</span>
                <Button
                  onClick={() => openAppStore(app)}
                  variant="outline"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Get App
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Setup Instructions */}
      {streamingConfig && (
        <Card className="p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">Setup Instructions</h2>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <p className="text-sm">{streamingConfig.instructions.step1}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <p className="text-sm">{streamingConfig.instructions.step2}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <p className="text-sm">{streamingConfig.instructions.step3}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
              <p className="text-sm">{streamingConfig.instructions.step4}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Benefits */}
      <Card className="p-4 mt-6 bg-blue-50 dark:bg-blue-900/20">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">RTMP Streaming Benefits:</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li><strong>Multiple Devices:</strong> Support unlimited simultaneous mobile phone streams</li>
          <li><strong>Professional Quality:</strong> Low latency, high-quality video streaming</li>
          <li><strong>Reliable Connection:</strong> Robust RTMP protocol with automatic reconnection</li>
          <li><strong>Cross-Platform:</strong> Works with any RTMP-compatible mobile app</li>
          <li><strong>Centralized Monitoring:</strong> All streams analyzed on single dashboard</li>
        </ul>
      </Card>
    </div>
  );
}