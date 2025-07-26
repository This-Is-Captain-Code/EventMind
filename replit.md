# Vision AI Demo Application

## Overview

This is a full-stack web application that demonstrates real-time computer vision capabilities using Google Cloud Vision API. The application captures video from a user's camera and performs various AI-powered image analysis tasks in real-time, including text detection (OCR), object detection, face detection, logo detection, and safe search filtering.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Components**: Shadcn/ui component library with Radix UI primitives for consistent, accessible components
- **Styling**: TailwindCSS with CSS variables for theming and responsive design
- **State Management**: React hooks with custom hooks for camera and AI functionality
- **Data Fetching**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with structured error handling and request validation
- **Data Validation**: Zod schemas for runtime type checking and validation
- **Storage**: In-memory storage with interfaces for future database integration

### Database & Data Storage
- **Current**: In-memory storage using JavaScript Maps for development
- **Configured for**: PostgreSQL with Drizzle ORM for production readiness
- **Schema**: Defined database tables for users and vision analysis results
- **Migrations**: Drizzle Kit configured for database schema management

## Key Components

### Camera System
- **Video Capture**: WebRTC MediaDevices API for camera access
- **Device Management**: Enumeration and switching between available cameras
- **Frame Processing**: Canvas-based image capture for AI analysis
- **Real-time Display**: Live video feed with overlay visualization of detection results

### Vision AI Integration
- **Service Provider**: Google Gemini AI via @google/genai client (switched from Google Cloud Vision API for better compatibility)
- **Features**: 
  - Text Detection (OCR)
  - Object Detection and Localization
  - Face Detection with emotion analysis
  - Logo Detection
  - Safe Search content filtering
- **Performance Tracking**: API call metrics, response times, and success rates
- **Error Handling**: Comprehensive error management with user feedback

### User Interface
- **Control Panel**: Toggle camera, switch devices, configure AI features, adjust processing intervals
- **Live Feed**: Real-time camera view with detection overlays
- **Results Panel**: Display of analysis results with confidence scores and bounding boxes
- **Performance Dashboard**: API statistics and system performance metrics

## Data Flow

1. **Camera Initialization**: User grants camera permissions and selects device
2. **Video Stream**: Continuous video feed displayed in browser
3. **Frame Capture**: Periodic capture of video frames at configurable intervals
4. **Image Processing**: Base64 encoding of captured frames
5. **API Request**: Structured request to backend with selected AI features
6. **Vision Analysis**: Google Cloud Vision API processes image and returns results
7. **Data Storage**: Analysis results stored with metadata
8. **Real-time Display**: Results overlaid on video feed and displayed in results panel
9. **Performance Tracking**: Metrics updated and displayed to user

## External Dependencies

### Google Cloud Services  
- **Vertex AI Vision API**: Complete enterprise vision platform with applications, streams, and models
- **Authentication**: Service account credentials with proper JWT authentication (project ID: agenticai-466913)
- **Configuration**: Full Google Cloud integration with real-time processing capabilities

### Third-party Libraries
- **UI Framework**: Radix UI primitives for accessible components
- **Styling**: TailwindCSS for utility-first styling
- **Validation**: Zod for runtime type checking
- **Database**: Drizzle ORM with PostgreSQL adapter
- **Build Tools**: Vite for development server and build process

### Development Tools
- **TypeScript**: Type safety across the entire stack
- **ESLint/Prettier**: Code quality and formatting
- **Replit Integration**: Development environment optimizations

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with hot module replacement
- **Environment Variables**: Google Cloud credentials and database connection
- **File Structure**: Monorepo with shared schemas between client and server

### Production Considerations
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Static Assets**: Frontend built to dist/public directory
- **Server Bundle**: Backend compiled to single ES module
- **Database**: Configured for PostgreSQL with connection pooling
- **Environment**: Production environment variables for API keys and database

### Security & Performance
- **API Rate Limiting**: Built-in performance tracking and monitoring
- **Error Boundaries**: Comprehensive error handling on both client and server
- **Memory Management**: Efficient image processing and cleanup
- **CORS Configuration**: Proper cross-origin resource sharing setup

## Recent Changes: Latest modifications with dates

### July 26, 2025 - Advanced Safety Analysis & Real-Time Monitoring Implementation
- **Implemented Advanced Safety Analyzer** - Multi-frame analysis system for density surge detection and falling/lying person detection
- **Real-time person tracking** - Sophisticated tracking system that follows individuals across multiple frames using position correlation
- **Density surge detection** - 8x8 grid-based density analysis that detects crowd surges with configurable thresholds and severity levels
- **Falling person detection** - Motion analysis that identifies rapid downward movement patterns indicating falling individuals
- **Lying person detection** - Aspect ratio analysis to identify persons in horizontal positions that may indicate medical emergencies
- **Multi-frame processing** - Maintains 30-frame history buffer (~5 seconds) for temporal analysis and behavior detection
- **Safety status classification** - Real-time SAFE/WARNING/CRITICAL status based on detected safety events
- **Enhanced API integration** - Safety analysis results now included in all frame processing responses with detailed statistics
- **Safety monitoring endpoints** - New /api/safety/stats endpoint for real-time safety dashboard integration
- **Performance optimization** - Efficient memory management with automatic cleanup of old tracking data
- **Production-ready safety features** - Configurable thresholds for density (15%), surge detection (50% increase), and falling velocity
- **Fixed bounding box alignment** - Proper aspect ratio correction for accurate overlay positioning on video feeds
- **Complete safety event tracking** - Comprehensive logging and analysis of all safety-critical events with timestamps and severity levels

### Previous Updates - Complete Vertex AI Vision Platform Implementation
- **Completely redesigned frontend interface** with modern professional UI
- **Fixed all React key warnings** and SelectItem validation errors
- **Increased Express server payload limits** to 50MB for large image frame processing
- **Implemented live camera controls** with device selection and real-time video feed
- **Added auto-processing capabilities** with configurable intervals (1s, 2s, 5s, 10s)
- **Built performance dashboard** with real-time stats and success rate tracking
- **Enhanced error handling** with user-friendly error messages and visual feedback
- **Optimized image compression** (reduced JPEG quality to 0.5 for faster processing)
- **Implemented TRUE Vertex AI Vision Platform** - Full enterprise architecture with applications, streams, and specialized models
- **Authentication established** - Service account working with comprehensive scopes for Vertex AI Platform and Vision AI
- **Complete vision capabilities** - Object detection, face detection, text detection (OCR), logo detection, occupancy analytics, PPE detection with precise bounding boxes
- **Enhanced visual interface** - Professional BoundingBoxOverlay component with color-coded detections, confidence scores, and real-time overlays
- **Advanced model selection** - Interactive UI for choosing detection models with descriptions and visual feedback
- **Real API connectivity confirmed** - Successfully connecting to visionai.googleapis.com and vision.googleapis.com endpoints with proper coordinate handling
- **Production-ready bounding boxes** - Normalized coordinate system supporting both pixel and relative coordinates with proper scaling