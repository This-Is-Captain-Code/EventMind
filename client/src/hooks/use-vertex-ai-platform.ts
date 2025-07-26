import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Application Management
export function useVisionApplications() {
  return useQuery({
    queryKey: ['/api/vision/applications'],
  });
}

export function useVisionApplication(id: string) {
  return useQuery({
    queryKey: ['/api/vision/applications', id],
    enabled: !!id,
  });
}

export function useCreateVisionApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      displayName: string;
      location?: string;
      models?: string[];
    }) => {
      const response = await fetch('/api/vision/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create application');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vision/applications'] });
    },
  });
}

export function useDeployApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await fetch(`/api/vision/applications/${applicationId}/deploy`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to deploy application');
      return response.json();
    },
    onSuccess: (_, applicationId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vision/applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vision/applications', applicationId] });
    },
  });
}

// Stream Management
export function useCreateVisionStream() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      displayName: string;
      applicationId: string;
      sourceType?: 'WEBCAM' | 'RTMP' | 'FILE';
      sourceUri?: string;
    }) => {
      const response = await fetch('/api/vision/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create stream');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vision/applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vision/applications', variables.applicationId] });
    },
  });
}

export function useVisionStream(id: string) {
  return useQuery({
    queryKey: ['/api/vision/streams', id],
    enabled: !!id,
  });
}

// Frame Processing
export function useProcessFrame() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      applicationId: string;
      streamId: string;
      frameData: string;
      models: string[];
    }) => {
      const response = await fetch('/api/vision/process-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to process frame');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vision/analyses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vision/streams', variables.streamId] });
    },
  });
}

// Analysis History
export function useVisionAnalyses(limit: number = 20) {
  return useQuery({
    queryKey: ['/api/vision/analyses', { limit }],
    queryFn: async () => {
      const response = await fetch(`/api/vision/analyses?limit=${limit}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch analyses');
      return response.json();
    },
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}

export function useVisionAnalysis(id: string) {
  return useQuery({
    queryKey: ['/api/vision/analyses', id],
    enabled: !!id,
  });
}

// Platform Health
export function usePlatformHealth() {
  return useQuery({
    queryKey: ['/api/health'],
    queryFn: async () => {
      const response = await fetch('/api/health', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch health status');
      return response.json();
    },
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: 30000, // Check every 30 seconds
  });
}