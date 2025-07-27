import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { VisionApiRequest, VisionApiResponse } from '@shared/schema';

export interface VertexAIFeatures {
  textDetection: boolean;
  objectDetection: boolean;
  faceDetection: boolean;
  logoDetection: boolean;
  safeSearch: boolean;
}

export interface PerformanceStats {
  apiCallsPerMinute: number;
  avgResponseTime: number;
  successRate: number;
  totalCalls: number;
  failedCalls: number;
}

export function useVertexAI() {
  const [features, setFeatures] = useState<VertexAIFeatures>({
    textDetection: true,
    objectDetection: true,
    faceDetection: false,
    logoDetection: false,
    safeSearch: true,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [latestResults, setLatestResults] = useState<VisionApiResponse | null>(null);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    apiCallsPerMinute: 0,
    avgResponseTime: 0,
    successRate: 100,
    totalCalls: 0,
    failedCalls: 0,
  });
  const [apiLog, setApiLog] = useState<string[]>([]);

  const callTimestamps = useRef<number[]>([]);
  const responseTimes = useRef<number[]>([]);

  const analyzeImageMutation = useMutation({
    mutationFn: async (request: VisionApiRequest) => {
      const response = await apiRequest('POST', '/api/vision/analyze', request);
      return await response.json() as VisionApiResponse;
    },
    onSuccess: (data, variables) => {
      setLatestResults(data);
      updatePerformanceStats(data.processingTime, true);
      addToApiLog(`POST /api/vision/analyze - 200 OK (${data.processingTime}ms)`);
    },
    onError: (error) => {
      updatePerformanceStats(0, false);
      addToApiLog(`POST /api/vision/analyze - ERROR (${error instanceof Error ? error.message : 'Unknown error'})`);
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  const updatePerformanceStats = useCallback((responseTime: number, success: boolean) => {
    const now = Date.now();
    callTimestamps.current.push(now);
    
    if (success) {
      responseTimes.current.push(responseTime);
    }

    // Keep only last minute of calls
    const oneMinuteAgo = now - 60000;
    callTimestamps.current = callTimestamps.current.filter(timestamp => timestamp > oneMinuteAgo);
    
    // Keep last 100 response times for average calculation
    if (responseTimes.current.length > 100) {
      responseTimes.current = responseTimes.current.slice(-100);
    }

    setPerformanceStats(prev => {
      const totalCalls = prev.totalCalls + 1;
      const failedCalls = success ? prev.failedCalls : prev.failedCalls + 1;
      const successRate = ((totalCalls - failedCalls) / totalCalls) * 100;
      const avgResponseTime = responseTimes.current.length > 0 
        ? responseTimes.current.reduce((sum, time) => sum + time, 0) / responseTimes.current.length
        : 0;

      return {
        apiCallsPerMinute: callTimestamps.current.length,
        avgResponseTime: Math.round(avgResponseTime),
        successRate: Math.round(successRate * 10) / 10,
        totalCalls,
        failedCalls,
      };
    });
  }, []);

  const addToApiLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    setApiLog(prev => [logEntry, ...prev.slice(0, 49)]); // Keep last 50 entries
  }, []);

  const analyzeImage = useCallback(async (imageData: string) => {
    if (isProcessing) {
      return;
    }

    // Check if any features are enabled
    const hasEnabledFeatures = Object.values(features).some(Boolean);
    if (!hasEnabledFeatures) {
      addToApiLog('ERROR - No features enabled for analysis');
      return;
    }

    setIsProcessing(true);
    
    const request: VisionApiRequest = {
      imageData,
      features,
    };

    analyzeImageMutation.mutate(request);
  }, [features, isProcessing, analyzeImageMutation, addToApiLog]);

  const updateFeature = useCallback((feature: keyof VertexAIFeatures, enabled: boolean) => {
    setFeatures(prev => ({
      ...prev,
      [feature]: enabled,
    }));
  }, []);

  const clearApiLog = useCallback(() => {
    setApiLog([]);
  }, []);

  const resetStats = useCallback(() => {
    callTimestamps.current = [];
    responseTimes.current = [];
    setPerformanceStats({
      apiCallsPerMinute: 0,
      avgResponseTime: 0,
      successRate: 100,
      totalCalls: 0,
      failedCalls: 0,
    });
  }, []);

  return {
    features,
    updateFeature,
    isProcessing,
    latestResults,
    performanceStats,
    apiLog,
    analyzeImage,
    clearApiLog,
    resetStats,
    isAnalyzing: analyzeImageMutation.isPending,
    error: analyzeImageMutation.error,
  };
}
