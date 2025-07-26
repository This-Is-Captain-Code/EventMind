import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { VisionApiResponse } from '@shared/schema';

interface ResultsPanelProps {
  latestResults: VisionApiResponse | null;
  apiLog: string[];
  onClearLog: () => void;
}

export function ResultsPanel({ latestResults, apiLog, onClearLog }: ResultsPanelProps) {
  const getSafetyBadgeColor = (level: string) => {
    switch (level) {
      case 'SAFE':
        return 'bg-green-500';
      case 'MODERATE':
        return 'bg-yellow-500';
      case 'UNSAFE':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Real-time Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-list-ul mr-2 text-blue-600"></i>
            Live Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96">
            {!latestResults ? (
              <div className="text-center text-gray-500 py-8">
                <i className="fas fa-eye text-3xl mb-2 opacity-50"></i>
                <p>No analysis results yet</p>
                <p className="text-sm">Start camera and enable features to see results</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Text Detection Results */}
                {latestResults.textDetections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <i className="fas fa-font mr-2 text-blue-500"></i>
                      Text Detected
                    </h4>
                    <div className="space-y-2">
                      {latestResults.textDetections.slice(0, 5).map((result, index) => (
                        <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {result.text}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Confidence: {formatConfidence(result.confidence)}
                          </div>
                        </div>
                      ))}
                      {latestResults.textDetections.length > 5 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{latestResults.textDetections.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Object Detection Results */}
                {latestResults.objectDetections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <i className="fas fa-cube mr-2 text-green-500"></i>
                      Objects Detected
                    </h4>
                    <div className="space-y-2">
                      {latestResults.objectDetections.slice(0, 5).map((result, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-gray-900">
                            {result.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Confidence: {formatConfidence(result.confidence)}
                          </div>
                        </div>
                      ))}
                      {latestResults.objectDetections.length > 5 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{latestResults.objectDetections.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Face Detection Results */}
                {latestResults.faceDetections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <i className="fas fa-user mr-2 text-purple-500"></i>
                      Faces Detected
                    </h4>
                    <div className="space-y-2">
                      {latestResults.faceDetections.map((result, index) => {
                        const dominantEmotion = result.emotions ? 
                          Object.entries(result.emotions).find(([, likelihood]) => 
                            likelihood && ['LIKELY', 'VERY_LIKELY'].includes(likelihood)
                          )?.[0] || 'neutral' : 'neutral';
                        
                        return (
                          <div key={index} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <div className="text-sm font-medium text-gray-900">
                              Face #{index + 1}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Confidence: {formatConfidence(result.confidence)} | 
                              Emotion: {dominantEmotion}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Logo Detection Results */}
                {latestResults.logoDetections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <i className="fas fa-copyright mr-2 text-yellow-500"></i>
                      Logos Detected
                    </h4>
                    <div className="space-y-2">
                      {latestResults.logoDetections.map((result, index) => (
                        <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-gray-900">
                            {result.description}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Confidence: {formatConfidence(result.confidence)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Safe Search Results */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <i className="fas fa-shield-alt mr-2 text-red-500"></i>
                    Content Safety
                  </h4>
                  <div className={`${
                    latestResults.safeSearchAnnotation.overall === 'SAFE' 
                      ? 'bg-green-50 border-green-200' 
                      : latestResults.safeSearchAnnotation.overall === 'MODERATE'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-red-50 border-red-200'
                  } border rounded-lg p-3`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {latestResults.safeSearchAnnotation.overall === 'SAFE' ? 'Safe Content' : 
                         latestResults.safeSearchAnnotation.overall === 'MODERATE' ? 'Moderate Content' : 
                         'Unsafe Content'}
                      </span>
                      <Badge className={`text-white ${getSafetyBadgeColor(latestResults.safeSearchAnnotation.overall)}`}>
                        {latestResults.safeSearchAnnotation.overall}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Adult: {latestResults.safeSearchAnnotation.adult} | 
                      Violence: {latestResults.safeSearchAnnotation.violence}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* API Response Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-terminal mr-2 text-blue-600"></i>
            API Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-green-400 text-xs font-mono p-3 rounded-lg max-h-48 overflow-y-auto">
            {apiLog.length === 0 ? (
              <div className="text-gray-500">No API calls yet...</div>
            ) : (
              apiLog.map((log, index) => (
                <div key={index}>{log}</div>
              ))
            )}
          </div>
          <Button
            onClick={onClearLog}
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            disabled={apiLog.length === 0}
          >
            Clear Log
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
