import NodeMediaServer from 'node-media-server';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export interface StreamInfo {
  streamKey: string;
  clientId: string;
  deviceInfo?: any;
  startTime: number;
  isActive: boolean;
  lastFrameTime?: number;
}

export class RTMPStreamingServer extends EventEmitter {
  private mediaServer: NodeMediaServer;
  private activeStreams: Map<string, StreamInfo> = new Map();
  private frameExtractionInterval: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    super();
    
    // Configure RTMP server
    const config = {
      rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
      },
      http: {
        port: 8000,
        allow_origin: '*',
        mediaroot: './media'
      },
      relay: {
        ffmpeg: '/usr/bin/ffmpeg', // Will be configured for Replit
        tasks: []
      }
    };

    this.mediaServer = new NodeMediaServer(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.mediaServer.on('preConnect', (id: string, args: any) => {
      console.log('[RTMP] Client connecting:', id, args);
    });

    this.mediaServer.on('postConnect', (id: string, args: any) => {
      console.log('[RTMP] Client connected:', id);
    });

    this.mediaServer.on('doneConnect', (id: string, args: any) => {
      console.log('[RTMP] Client disconnected:', id);
      this.handleStreamStop(id);
    });

    this.mediaServer.on('prePublish', (id: string, streamPath: string, args: any) => {
      console.log('[RTMP] Stream starting:', id, streamPath);
      this.handleStreamStart(id, streamPath, args);
    });

    this.mediaServer.on('postPublish', (id: string, streamPath: string, args: any) => {
      console.log('[RTMP] Stream published:', id, streamPath);
    });

    this.mediaServer.on('donePublish', (id: string, streamPath: string, args: any) => {
      console.log('[RTMP] Stream ended:', id, streamPath);
      this.handleStreamStop(id);
    });
  }

  private handleStreamStart(clientId: string, streamPath: string, args: any) {
    // Extract stream key from path (e.g., /live/mobile_device_1)
    const streamKey = streamPath.split('/').pop() || clientId;
    
    const streamInfo: StreamInfo = {
      streamKey,
      clientId,
      deviceInfo: args,
      startTime: Date.now(),
      isActive: true
    };

    this.activeStreams.set(clientId, streamInfo);
    
    // Start frame extraction for AI analysis
    this.startFrameExtraction(clientId, streamKey);
    
    // Emit event for dashboard
    this.emit('streamStarted', streamInfo);
  }

  private handleStreamStop(clientId: string) {
    const streamInfo = this.activeStreams.get(clientId);
    if (streamInfo) {
      streamInfo.isActive = false;
      this.activeStreams.delete(clientId);
      
      // Stop frame extraction
      const interval = this.frameExtractionInterval.get(clientId);
      if (interval) {
        clearInterval(interval);
        this.frameExtractionInterval.delete(clientId);
      }
      
      // Emit event for dashboard
      this.emit('streamStopped', streamInfo);
    }
  }

  private startFrameExtraction(clientId: string, streamKey: string) {
    // Extract frames every 2 seconds for AI analysis
    const interval = setInterval(() => {
      this.extractFrameFromStream(clientId, streamKey);
    }, 2000);
    
    this.frameExtractionInterval.set(clientId, interval);
  }

  private async extractFrameFromStream(clientId: string, streamKey: string) {
    try {
      const streamInfo = this.activeStreams.get(clientId);
      if (!streamInfo || !streamInfo.isActive) return;

      // Use ffmpeg to extract a frame from the live stream
      const outputPath = `./media/frames/frame_${streamKey}_${Date.now()}.jpg`;
      
      // Ensure frames directory exists
      const framesDir = path.dirname(outputPath);
      if (!fs.existsSync(framesDir)) {
        fs.mkdirSync(framesDir, { recursive: true });
      }

      // Extract frame using ffmpeg (this would be the actual implementation)
      // For now, emit a mock frame extraction event
      streamInfo.lastFrameTime = Date.now();
      
      this.emit('frameExtracted', {
        clientId,
        streamKey,
        framePath: outputPath,
        timestamp: streamInfo.lastFrameTime
      });
      
    } catch (error) {
      console.error('Error extracting frame:', error);
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.mediaServer.run();
        console.log('RTMP Media Server started on port 1935');
        console.log('HTTP Media Server started on port 8000');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public stop(): void {
    // Clear all intervals
    for (const interval of this.frameExtractionInterval.values()) {
      clearInterval(interval);
    }
    this.frameExtractionInterval.clear();
    
    // Clear streams
    this.activeStreams.clear();
    
    // Stop media server
    this.mediaServer.stop();
  }

  public getActiveStreams(): StreamInfo[] {
    return Array.from(this.activeStreams.values());
  }

  public getStreamInfo(clientId: string): StreamInfo | undefined {
    return this.activeStreams.get(clientId);
  }

  // Generate stream URLs for mobile clients
  public generateStreamURL(deviceId: string): string {
    const host = process.env.REPLIT_DEV_DOMAIN || 'localhost';
    return `rtmp://${host}:1935/live/${deviceId}`;
  }

  // Generate playback URL for dashboard
  public generatePlaybackURL(deviceId: string): string {
    const host = process.env.REPLIT_DEV_DOMAIN || 'localhost';
    return `http://${host}:8000/live/${deviceId}.flv`;
  }
}