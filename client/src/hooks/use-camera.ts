import { useState, useRef, useCallback, useEffect } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface CameraState {
  isActive: boolean;
  stream: MediaStream | null;
  devices: CameraDevice[];
  selectedDeviceId: string | null;
  error: string | null;
  isLoading: boolean;
}

export function useCamera() {
  const [state, setState] = useState<CameraState>({
    isActive: false,
    stream: null,
    devices: [],
    selectedDeviceId: null,
    error: null,
    isLoading: false,
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  // Get available camera devices
  const getDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        }));
      
      setState(prev => ({ 
        ...prev, 
        devices: videoDevices,
        selectedDeviceId: prev.selectedDeviceId || videoDevices[0]?.deviceId || null,
      }));
    } catch (error) {
      console.error('Error getting devices:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to get camera devices',
      }));
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async (deviceId?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Stop existing stream
      if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId || state.selectedDeviceId || undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setState(prev => ({
        ...prev,
        isActive: true,
        stream,
        isLoading: false,
        selectedDeviceId: deviceId || prev.selectedDeviceId,
      }));

    } catch (error) {
      console.error('Error starting camera:', error);
      let errorMessage = 'Failed to start camera';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please allow camera permissions.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
        }
      }

      setState(prev => ({
        ...prev,
        isActive: false,
        stream: null,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [state.stream, state.selectedDeviceId]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState(prev => ({
      ...prev,
      isActive: false,
      stream: null,
    }));
  }, [state.stream]);

  // Capture frame from video
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !state.isActive) {
      return null;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.8);
  }, [state.isActive]);

  // Change camera device
  const switchDevice = useCallback(async (deviceId: string) => {
    setState(prev => ({ ...prev, selectedDeviceId: deviceId }));
    
    if (state.isActive) {
      await startCamera(deviceId);
    }
  }, [state.isActive, startCamera]);

  // Initialize devices on mount
  useEffect(() => {
    getDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, [getDevices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [state.stream]);

  return {
    ...state,
    videoRef,
    startCamera,
    stopCamera,
    captureFrame,
    switchDevice,
    refreshDevices: getDevices,
  };
}
