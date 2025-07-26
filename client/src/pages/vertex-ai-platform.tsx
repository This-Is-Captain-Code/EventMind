import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Clock, Camera, Play, Square, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCamera } from '@/hooks/use-camera';
import {
  useVisionApplications,
  useCreateVisionApplication,
  useCreateVisionStream,
  useDeployApplication,
  useProcessFrame,
  useVisionAnalyses,
  usePlatformHealth
} from '@/hooks/use-vertex-ai-platform';

const AVAILABLE_MODELS = [
  'GENERAL_OBJECT_DETECTION',
  'OCCUPANCY_COUNTING',
  'PERSON_BLUR',
  'VERTEX_CUSTOM_MODEL'
];

const AVAILABLE_LOCATIONS = [
  'us-central1',
  'us-east1',
  'us-west1',
  'europe-west4',
  'asia-east1'
];

export default function VertexAIPlatform() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [selectedApplication, setSelectedApplication] = useState<string>('');
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  
  // New application form
  const [newAppName, setNewAppName] = useState('');
  const [newAppDisplayName, setNewAppDisplayName] = useState('');
  const [newAppLocation, setNewAppLocation] = useState('us-central1');
  const [newAppModels, setNewAppModels] = useState<string[]>(['GENERAL_OBJECT_DETECTION']);
  
  // New stream form
  const [newStreamName, setNewStreamName] = useState('');
  const [newStreamDisplayName, setNewStreamDisplayName] = useState('');

  // Camera setup
  const {
    stream,
    videoRef,
    devices,
    error: cameraError,
    startCamera,
    stopCamera,
    captureFrame,
    isLoading: cameraLoading
  } = useCamera();
  
  const isStreaming = !!stream;

  // API hooks
  const { data: applications, isLoading: appsLoading } = useVisionApplications();
  const { data: analyses } = useVisionAnalyses(10);
  const { data: health } = usePlatformHealth();
  const createApplication = useCreateVisionApplication();
  const createStream = useCreateVisionStream();
  const deployApp = useDeployApplication();
  const processFrame = useProcessFrame();

  const switchCamera = async (deviceId: string) => {
    setSelectedDevice(deviceId);
    if (isStreaming) {
      await startCamera(deviceId);
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName || !newAppDisplayName) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      await createApplication.mutateAsync({
        name: newAppName,
        displayName: newAppDisplayName,
        location: newAppLocation,
        models: newAppModels,
      });
      
      toast({ title: "Success", description: "Application created successfully" });
      setNewAppName('');
      setNewAppDisplayName('');
      setNewAppModels(['GENERAL_OBJECT_DETECTION']);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to create application",
        variant: "destructive" 
      });
    }
  };

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplication || !newStreamName || !newStreamDisplayName) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      await createStream.mutateAsync({
        name: newStreamName,
        displayName: newStreamDisplayName,
        applicationId: selectedApplication,
        sourceType: 'WEBCAM',
      });
      
      toast({ title: "Success", description: "Stream created successfully" });
      setNewStreamName('');
      setNewStreamDisplayName('');
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to create stream",
        variant: "destructive" 
      });
    }
  };

  const handleDeployApplication = async () => {
    if (!selectedApplication) return;

    try {
      await deployApp.mutateAsync(selectedApplication);
      toast({ title: "Success", description: "Application deployed successfully" });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to deploy application",
        variant: "destructive" 
      });
    }
  };

  const handleProcessFrame = async () => {
    if (!selectedApplication || !selectedStream || !isStreaming) {
      toast({ title: "Error", description: "Please select application, stream and start camera", variant: "destructive" });
      return;
    }

    try {
      setIsProcessing(true);
      const frameData = captureFrame();
      if (!frameData) throw new Error('Failed to capture frame');

      await processFrame.mutateAsync({
        applicationId: selectedApplication,
        streamId: selectedStream,
        frameData,
        models: newAppModels,
      });
      
      toast({ title: "Success", description: "Frame processed successfully" });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to process frame",
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStateColor = (state: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (state) {
      case 'DEPLOYED': return 'default';
      case 'ACTIVE': return 'default';
      case 'PENDING': return 'secondary';
      case 'ERROR': return 'destructive';
      default: return 'secondary';
    }
  };

  // Type-safe data access
  const applicationsArray = Array.isArray(applications) ? applications : [];
  const analysesArray = Array.isArray(analyses) ? analyses : [];
  const selectedApp = applicationsArray.find((app: any) => app.id === selectedApplication);
  const healthData = health && typeof health === 'object' ? health : null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vertex AI Vision Platform</h1>
          <p className="text-muted-foreground">
            Comprehensive video analysis with Google Cloud Vertex AI Vision
          </p>
        </div>
        <div className="flex items-center gap-2">
          {healthData && (
            <Badge variant={healthData.status === 'healthy' ? 'default' : 'destructive'}>
              {healthData.status === 'healthy' ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
              Platform Status
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="camera">Camera</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Application */}
            <Card>
              <CardHeader>
                <CardTitle>Create Vision Application</CardTitle>
                <CardDescription>
                  Set up a new Vertex AI Vision application with models and streams
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateApplication} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="app-name">Application Name</Label>
                    <Input
                      id="app-name"
                      value={newAppName}
                      onChange={(e) => setNewAppName(e.target.value)}
                      placeholder="my-vision-app"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="app-display-name">Display Name</Label>
                    <Input
                      id="app-display-name"
                      value={newAppDisplayName}
                      onChange={(e) => setNewAppDisplayName(e.target.value)}
                      placeholder="My Vision Application"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="app-location">Location</Label>
                    <Select value={newAppLocation} onValueChange={setNewAppLocation}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_LOCATIONS.map(location => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Models</Label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_MODELS.map(model => (
                        <Badge
                          key={model}
                          variant={newAppModels.includes(model) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            if (newAppModels.includes(model)) {
                              setNewAppModels(prev => prev.filter(m => m !== model));
                            } else {
                              setNewAppModels(prev => [...prev, model]);
                            }
                          }}
                        >
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <Button type="submit" disabled={createApplication.isPending} className="w-full">
                    {createApplication.isPending ? 'Creating...' : 'Create Application'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Applications List */}
            <Card>
              <CardHeader>
                <CardTitle>Applications</CardTitle>
                <CardDescription>
                  Manage your Vertex AI Vision applications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {appsLoading ? (
                    <div>Loading applications...</div>
                  ) : applicationsArray.length ? (
                    applicationsArray.map((app: any) => (
                      <div
                        key={app.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedApplication === app.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedApplication(app.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{app.displayName}</h4>
                            <p className="text-sm text-muted-foreground">{app.name}</p>
                          </div>
                          <Badge variant={getStateColor(app.state)}>
                            {app.state}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {app.location} • Created {new Date(app.createTime).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground">
                      No applications created yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Create Stream */}
          {selectedApplication && (
            <Card>
              <CardHeader>
                <CardTitle>Add Stream</CardTitle>
                <CardDescription>
                  Add a video stream to {selectedApp?.displayName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateStream} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stream-name">Stream Name</Label>
                    <Input
                      id="stream-name"
                      value={newStreamName}
                      onChange={(e) => setNewStreamName(e.target.value)}
                      placeholder="webcam-stream"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="stream-display-name">Display Name</Label>
                    <Input
                      id="stream-display-name"
                      value={newStreamDisplayName}
                      onChange={(e) => setNewStreamDisplayName(e.target.value)}
                      placeholder="Webcam Stream"
                      required
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <Button type="submit" disabled={createStream.isPending} className="w-full">
                      {createStream.isPending ? 'Adding...' : 'Add Stream'}
                    </Button>
                  </div>
                </form>

                {/* Streams List */}
                {selectedApp?.streams && selectedApp.streams.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-medium">Streams</h4>
                    {selectedApp.streams.map((stream: any) => (
                      <div
                        key={stream.id}
                        className={`p-2 border rounded cursor-pointer ${
                          selectedStream === stream.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedStream(stream.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{stream.displayName}</span>
                          <Badge variant={getStateColor(stream.state)}>
                            {stream.state}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Deploy Button */}
                {selectedApp && selectedApp.streams && selectedApp.streams.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      onClick={handleDeployApplication}
                      disabled={deployApp.isPending || selectedApp.state === 'DEPLOYED'}
                      className="w-full"
                      variant={selectedApp.state === 'DEPLOYED' ? 'outline' : 'default'}
                    >
                      {deployApp.isPending ? 'Deploying...' : 
                       selectedApp.state === 'DEPLOYED' ? 'Already Deployed' : 'Deploy Application'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Camera Tab */}
        <TabsContent value="camera" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Camera Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Camera Controls</CardTitle>
                <CardDescription>
                  Manage video input for analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Camera Device</Label>
                  <Select value={selectedDevice} onValueChange={switchCamera}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => startCamera()}
                    disabled={isStreaming}
                    className="flex-1"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </Button>
                  <Button
                    onClick={stopCamera}
                    disabled={!isStreaming}
                    variant="outline"
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                </div>

                {cameraError && (
                  <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {cameraError}
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <Label>Processing</Label>
                  <Button
                    onClick={handleProcessFrame}
                    disabled={!isStreaming || isProcessing || !selectedStream}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Process Frame
                      </>
                    )}
                  </Button>
                </div>

                {!selectedStream && (
                  <div className="text-sm text-muted-foreground">
                    Select an application and stream to enable processing
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Video Feed */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Live Video Feed</CardTitle>
                <CardDescription>
                  Camera input for Vertex AI Vision analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-muted rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full aspect-video object-cover"
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                  {!isStreaming && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <div className="text-center">
                        <Camera className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">Camera not active</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Analysis</CardTitle>
              <CardDescription>
                Current processing status and results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Analysis results will appear here when processing frames
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis History</CardTitle>
              <CardDescription>
                Recent frame analysis results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysesArray.length ? (
                <div className="space-y-4">
                  {analysesArray.map((analysis: any) => (
                    <div key={analysis.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">
                          Analysis {analysis.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(analysis.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Confidence: {(analysis.confidence || 0).toFixed(2)}% • 
                        Processing: {analysis.processingTime}ms
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No analysis history yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}