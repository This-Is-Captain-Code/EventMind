# Vision AI Demo Application

An advanced AI-powered public safety platform leveraging Google's Vertex AI and generative AI technologies for intelligent real-time event monitoring and incident analysis.

## 🚀 Features

### Core Vision AI Capabilities
- **Real-time Object Detection** - Identifies and tracks objects in live video feeds
- **Person Detection & Tracking** - Advanced person detection with occupancy analytics
- **Face Detection** - Emotion analysis and face recognition capabilities
- **Fire & Smoke Detection** - Safety-critical detection of flames, fires, and smoke with alert levels
- **Text Recognition (OCR)** - Extracts text from video feeds in real-time
- **Logo Detection** - Brand and logo identification
- **PPE Detection** - Personal protective equipment compliance monitoring

### Safety Monitoring System
- **Density Analysis** - Real-time crowd density monitoring with configurable thresholds
- **Falling Person Detection** - Motion analysis to identify falling individuals
- **Lying Person Detection** - Identifies persons in horizontal positions indicating emergencies
- **Safety Status Classification** - SAFE/WARNING/CRITICAL status based on detected events
- **Multi-frame Analysis** - Maintains 30-frame history for temporal behavior analysis

### RTMP Multi-Device Streaming
- **Professional RTMP Server** - Supports unlimited simultaneous mobile streams
- **Mobile Client Interface** - Complete mobile web app for streaming configuration
- **Device Registration** - Dynamic RTMP URL and stream key generation
- **Cross-platform Support** - Works with Larix Broadcaster, RTMP Camera, OBS Mobile

### AI-Powered Incident Analysis
- **Gemini AI Integration** - Intelligent incident analysis with function calling
- **Pattern Recognition** - Identifies safety trends and anomalies
- **Natural Language Queries** - Ask questions about safety data and incidents
- **Comprehensive Reporting** - Detailed safety event tracking and visualization

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript and Vite
- **Shadcn/ui** component library with Radix UI primitives
- **TailwindCSS** for responsive design and theming
- **TanStack Query** for server state management
- **Wouter** for lightweight client-side routing

### Backend
- **Node.js** with Express.js server
- **TypeScript** with ES modules
- **Drizzle ORM** with PostgreSQL
- **Zod** for runtime type validation
- **Node Media Server** for RTMP streaming

### AI & Cloud Services
- **Google Cloud Vision API** - Primary vision analysis engine
- **Vertex AI Platform** - Enterprise-grade vision applications
- **Gemini AI** - Advanced incident analysis and insights
- **Google Cloud Authentication** - Service account with comprehensive scopes

## 📋 Prerequisites

- Node.js 18+ and npm
- Google Cloud Project with enabled APIs:
  - Cloud Vision API
  - Vertex AI API
  - AI Platform API
- Google API key for Gemini AI
- PostgreSQL database (configured automatically on Replit)

## ⚙️ Setup Instructions

### 1. Environment Configuration

Create the following environment variables:

```bash
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_API_KEY=your-gemini-api-key

# Database (auto-configured on Replit)
DATABASE_URL=your-postgresql-url
```

### 2. Google Cloud Credentials

Place your service account credentials in `google-credentials.json` with the following structure:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "...",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

Required service account permissions:
- `roles/aiplatform.user`
- `roles/ml.developer`
- `roles/storage.objectViewer`
- `roles/bigquery.dataEditor`

### 3. Installation

```bash
# Install dependencies
npm install

# Set up database schema
npm run db:push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

## 🎯 Usage Guide

### Basic Operation

1. **Camera Setup**
   - Grant camera permissions when prompted
   - Select your preferred camera device
   - Configure processing interval (1s, 2s, 5s, or 10s)

2. **Model Selection**
   - Choose detection models from the control panel:
     - Person Detection
     - Fire Detection (red bounding boxes)
     - Smoke Detection (gray bounding boxes)
     - Face Detection
     - Text Recognition
     - Logo Detection

3. **Real-time Analysis**
   - Live video feed with detection overlays
   - Confidence scores and bounding boxes
   - Safety alerts and density monitoring
   - Performance metrics dashboard

### RTMP Streaming Setup

1. **Mobile Device Registration**
   - Navigate to `/mobile` on your mobile device
   - Register your device to get unique RTMP credentials
   - Copy the generated RTMP URL and stream key

2. **Streaming App Configuration**
   - Install a professional RTMP app (Larix Broadcaster, RTMP Camera, OBS Mobile)
   - Configure with your RTMP URL and stream key
   - Start streaming to the platform

3. **Multi-Device Monitoring**
   - View all connected streams on the main dashboard
   - Real-time analysis across multiple camera feeds
   - Centralized safety monitoring and alerts

### AI Incident Analysis

1. **Query Interface**
   - Use the incident analysis panel for natural language queries
   - Examples:
     - "Show me safety trends from the last hour"
     - "Analyze crowd density patterns"
     - "Summarize any safety incidents detected"

2. **Safety Reports**
   - Automatic generation of safety summaries
   - Trend analysis and pattern recognition
   - Configurable alert thresholds

## 🔧 API Endpoints

### Vision Analysis
- `GET /api/vision/applications` - List available vision applications
- `POST /api/vision/process` - Process video frame for analysis
- `GET /api/vision/analyses` - Retrieve analysis history

### Safety Monitoring
- `GET /api/safety/stats` - Real-time safety statistics
- `POST /api/incidents/analyze` - AI-powered incident analysis

### Streaming
- `POST /api/streams` - Create new RTMP stream
- `GET /api/streams/:id` - Get stream status and analytics

### Health Monitoring
- `GET /api/health` - System health and service status

## 🎨 Detection Models & Visualization

### Fire Detection
- **Models**: OBJECT_LOCALIZATION
- **Detects**: Flames, fires, candles, torches
- **Visualization**: Red bounding boxes
- **Alert Levels**: High (>80%), Medium (50-80%), Low (<50%)

### Smoke Detection
- **Models**: OBJECT_LOCALIZATION
- **Detects**: Smoke, vapor, steam
- **Visualization**: Gray bounding boxes
- **Alert Levels**: High (>70%), Medium (40-70%), Low (<40%)

### Person Detection
- **Models**: person-detection@1, OCCUPANCY_COUNTING_PROCESSOR
- **Features**: Tracking, density analysis, falling detection
- **Visualization**: Blue bounding boxes with person IDs
- **Density Levels**: HIGH (>10 people), MEDIUM (5-10), LOW (<5)

## 🔒 Security & Performance

### Authentication
- Google Cloud service account authentication
- JWT token-based API access
- Secure credential management

### Performance Optimization
- Efficient image processing and cleanup
- Configurable processing intervals
- Memory management with automatic cleanup
- API rate limiting and monitoring

### Data Privacy
- No persistent storage of video data
- In-memory processing only
- Secure API communication with HTTPS

## 🐛 Troubleshooting

### Common Issues

1. **Camera Access Denied**
   - Ensure browser permissions are granted
   - Check HTTPS requirement for camera access
   - Try refreshing the page and granting permissions again

2. **API Errors**
   - Verify Google Cloud credentials are valid
   - Check service account permissions
   - Ensure APIs are enabled in Google Cloud Console

3. **RTMP Streaming Issues**
   - Verify RTMP URL format is correct
   - Check mobile app RTMP settings
   - Ensure stable network connection

4. **Performance Issues**
   - Adjust processing interval to reduce CPU load
   - Close unnecessary browser tabs
   - Check network bandwidth for RTMP streams

### Debug Information

Enable debug logging by setting:
```bash
NODE_ENV=development
```

Check browser console and server logs for detailed error information.

## 📈 Performance Metrics

The application tracks comprehensive performance metrics:

- **API Response Times** - Average processing time per request
- **Success Rates** - Percentage of successful API calls
- **Detection Accuracy** - Confidence scores and detection rates
- **System Resources** - CPU and memory usage monitoring
- **Stream Quality** - RTMP connection stability and bandwidth

## 🔄 Recent Updates

### Latest Features (July 2025)
- ✅ Fire and smoke detection with color-coded bounding boxes
- ✅ Enhanced safety analyzer with multi-frame processing
- ✅ RTMP multi-device streaming architecture
- ✅ Gemini AI integration for incident analysis
- ✅ Real-time occupancy density visualization
- ✅ Professional mobile streaming support

## 📞 Support

For technical support or questions:

1. Check the troubleshooting section above
2. Review browser console and server logs
3. Verify Google Cloud setup and permissions
4. Ensure all required environment variables are set

## 📜 License

This project is built for demonstration purposes using Google Cloud Vision AI and Vertex AI Platform services.

---

**Built with ❤️ using React, TypeScript, and Google Cloud AI**