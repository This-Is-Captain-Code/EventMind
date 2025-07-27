import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, Database, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AnalysisResult {
  prompt: string;
  functionCalls: Array<{
    functionName: string;
    args: any;
    result: any;
  }>;
  analysis: string;
  timestamp: string;
}

export function IncidentAnalysisPrompt() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const analyzeIncidents = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt to analyze incidents",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('POST', '/api/incidents/analyze', { prompt: prompt.trim() });
      const result = await response.json();

      setResult(result);
      toast({
        title: "Analysis Complete",
        description: "AI has successfully analyzed the incident data",
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze incidents",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFunctionResult = (functionCall: any) => {
    const { functionName, args, result } = functionCall;
    
    if (functionName === 'getIncidentTypeStats') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {result.totalIncidents}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Incidents</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {result.incidentTypes?.length || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Incident Types</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Incident Breakdown:</h4>
            {result.incidentTypes?.map((type: any, index: number) => (
              <div key={index} className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{type.type}</span>
                  <Badge variant="secondary">{type.count} incidents ({type.percentage}%)</Badge>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>Avg Confidence: {type.avgConfidence}</div>
                  <div>Severity: HIGH: {type.severityBreakdown.HIGH}, MEDIUM: {type.severityBreakdown.MEDIUM}, LOW: {type.severityBreakdown.LOW}</div>
                  {type.latestIncident && (
                    <div>Latest: {new Date(type.latestIncident).toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } else if (functionName === 'getIncidentSummary') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {result.count}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Incidents Found</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {args.timestamp}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Date</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {result.incidentType}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Type Filter</div>
            </div>
          </div>
          
          {result.incidents && result.incidents.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Incident Details:</h4>
              {result.incidents.map((incident: any, index: number) => (
                <div key={index} className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{incident.type}</span>
                    <div className="flex gap-2">
                      <Badge variant={incident.severity === 'HIGH' ? 'destructive' : incident.severity === 'MEDIUM' ? 'default' : 'secondary'}>
                        {incident.severity}
                      </Badge>
                      <Badge variant="outline">{Math.round(incident.confidence * 100)}%</Badge>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>Time: {new Date(incident.timestamp).toLocaleString()}</div>
                    <div>ID: {incident.id}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    return <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Incident Analysis
          </CardTitle>
          <CardDescription>
            Ask questions about safety incidents using natural language. The AI will analyze the database and provide insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-medium">
              Enter your analysis prompt:
            </label>
            <Textarea
              id="prompt"
              placeholder="Examples:
• Show me incident statistics and counts for each type
• What incidents happened on 2025-07-26?
• Give me a summary of density alerts
• Analyze the safety trends and patterns"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={analyzeIncidents} 
              disabled={loading || !prompt.trim()}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Analyze Incidents
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Analysis Results
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Generated at {new Date(result.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Function Call Results */}
            {result.functionCalls && result.functionCalls.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Database Query Results</h3>
                {result.functionCalls.map((functionCall, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">{functionCall.functionName}</Badge>
                      {Object.keys(functionCall.args).length > 0 && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          with args: {JSON.stringify(functionCall.args)}
                        </span>
                      )}
                    </div>
                    {formatFunctionResult(functionCall)}
                  </div>
                ))}
              </div>
            )}
            
            {/* AI Analysis */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Analysis</h3>
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {result.analysis}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}