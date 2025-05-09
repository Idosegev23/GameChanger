'use client';

import { useState, useEffect } from 'react';
import { CallAnalysis } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Play, Pause, AlertTriangle, AlertCircle, LockIcon } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

const analysisTypeLabels: Record<string, string> = {
  sales: 'שיחת מכירה',
  service: 'שיחת שירות',
  appointment_setting: 'תיאום פגישה',
  sales_followup: 'פולו-אפ מכירה',
  appointment_followup: 'פולו-אפ תיאום פגישה',
};

interface AnalysisReportProps {
  analysis: CallAnalysis;
}

export function AnalysisReport({ analysis }: AnalysisReportProps) {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // בדיקת הרשאות בטעינה
  useEffect(() => {
    async function checkPermission() {
      setIsLoading(true);
      try {
        if (!user) {
          setHasPermission(false);
          return;
        }

        // אם המשתמש עצמו יצר את הניתוח - יש לו הרשאות
        if (analysis.user_id === user.id) {
          setHasPermission(true);
          return;
        }

        // בדיקה עם שרת ה-API האם למשתמש יש הרשאות (לחברה שלו)
        const { supabase } = await import('@/lib/supabase');
        const { data: companyData } = await supabase
          .from('companies')
          .select('id')
          .eq('id', analysis.company_id)
          .eq('user_id', user.id)
          .single();

        setHasPermission(!!companyData);
      } catch (error) {
        console.error('שגיאה בבדיקת הרשאות:', error);
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkPermission();
  }, [user, analysis.user_id, analysis.company_id]);

  // Format date to dd/mm/yyyy hh:mm
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Initialize audio player on first play
  const initAudio = () => {
    if (!audioElement && analysis.recording_url) {
      const audio = new Audio(analysis.recording_url);
      audio.addEventListener('ended', () => {
        setAudioPlaying(false);
      });
      setAudioElement(audio);
      return audio;
    }
    return audioElement;
  };

  // Toggle play/pause
  const togglePlay = () => {
    const audio = initAudio();
    if (!audio) return;

    if (audioPlaying) {
      audio.pause();
      setAudioPlaying(false);
    } else {
      audio.play();
      setAudioPlaying(true);
    }
  };

  // Render status badge
  const renderStatusBadge = () => {
    const statusMap: Record<string, { label: string, className: string }> = {
      pending: { label: 'ממתין', className: 'bg-yellow-500 text-yellow-900 border-yellow-600' },
      processing: { label: 'מעבד', className: 'bg-blue-500 text-blue-900 border-blue-600' },
      done: { label: 'הושלם', className: 'bg-green-500 text-green-900 border-green-600' },
      error: { label: 'שגיאה', className: 'bg-red-500 text-red-900 border-red-600' },
    };

    const status = statusMap[analysis.status] || { label: analysis.status, className: 'bg-gray-500 text-gray-900 border-gray-600' };
    
    return (
      <Badge className={`${status.className} border px-2 py-1 text-xs font-semibold`}>
        {status.label}
      </Badge>
    );
  };

  // Render content based on analysis status
  const renderContent = () => {
    if (analysis.status === 'pending' || analysis.status === 'processing') {
      return (
        <Card className="overflow-hidden bg-gray-900 border border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">הניתוח בתהליך...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            <p className="text-center text-gray-400">התוצאות יופיעו כאן בהקדם</p>
            <Progress value={analysis.status === 'processing' ? 70 : 30} className="w-full h-2 bg-gray-700 [&>*]:bg-orange-500" />
          </CardContent>
        </Card>
      );
    }

    if (analysis.status === 'error') {
      return (
        <Alert variant="destructive" className="bg-red-900/30 border-red-700 text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            אירעה שגיאה בתהליך הניתוח: {analysis.report_data?.error || 'שגיאה לא ידועה'}
          </AlertDescription>
        </Alert>
      );
    }

    if (analysis.status === 'done') {
      return (
        <Tabs defaultValue="summary" className="mt-6">
          <TabsList className="grid grid-cols-4 w-full max-w-md bg-gray-800 border border-gray-700 mb-6">
            <TabsTrigger value="summary" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">סיכום</TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">פרטים</TabsTrigger>
            <TabsTrigger value="transcript" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">תמלול</TabsTrigger>
            <TabsTrigger value="ai-debug" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">AI דיבוג</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="overflow-hidden bg-gray-900 border border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">ציון כולל</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <div className="text-6xl font-bold text-center text-orange-500">
                      {analysis.report_data?.summary?.totalScore 
                        ? Math.round((analysis.report_data.summary.totalScore / (7 * (analysis.report_data?.analysis?.length || 28))) * 100) 
                        : 0}
                      <span className="text-2xl text-gray-400">/100</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden bg-gray-900 border border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">פרמטרים שזוהו</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    {analysis.report_data?.analysis && analysis.report_data.analysis.length > 0 ? (
                      analysis.report_data.analysis.map((item: {parameter: string, text: string, score: number}, index: number) => (
                        <li key={index}>{item.parameter}</li>
                      ))
                    ) : (
                      <li className="text-gray-500">לא זוהו פרמטרים</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="overflow-hidden bg-gray-900 border border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">חוזקות</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    {analysis.report_data?.summary?.strengths && analysis.report_data.summary.strengths.length > 0 ? (
                      analysis.report_data.summary.strengths.map((strength: string, index: number) => (
                        <li key={index}>{strength}</li>
                      ))
                    ) : (
                      <li className="text-gray-500">לא זוהו חוזקות</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden bg-gray-900 border border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">נקודות לשיפור</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    {analysis.report_data?.summary?.improvements && analysis.report_data.summary?.improvements.length > 0 ? (
                      analysis.report_data.summary.improvements.map((improvement: string, index: number) => (
                        <li key={index}>{improvement}</li>
                      ))
                    ) : (
                      <li className="text-gray-500">לא זוהו נקודות לשיפור</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="details" className="space-y-6">
            <Card className="overflow-hidden bg-gray-900 border border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">ניתוח מפורט</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none rtl text-gray-300 prose-headings:text-white prose-strong:text-white">
                  {Array.isArray(analysis.report_data?.analysis) ? (
                    <div className="space-y-4">
                      {analysis.report_data.analysis.map((item, index) => (
                        <div key={index} className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                          <h3 className="text-orange-500 font-medium mb-2">{item.parameter}</h3>
                          <p>{item.text}</p>
                          <div className="mt-2 flex items-center">
                            <span className="text-sm text-gray-400 mr-2">ציון:</span>
                            <span className="font-bold">{item.score}/100</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500">אין ניתוח מפורט זמין</span>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="overflow-hidden bg-gray-900 border border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">המלצות</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                  {analysis.report_data?.summary?.recommendations && analysis.report_data.summary.recommendations.length > 0 ? (
                    analysis.report_data.summary.recommendations.map((recommendation: string, index: number) => (
                      <li key={index}>{recommendation}</li>
                    ))
                  ) : (
                    <li className="text-gray-500">אין המלצות זמינות</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="transcript">
            <Card className="overflow-hidden bg-gray-900 border border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">תמלול השיחה</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-800 p-4 rounded-md overflow-auto max-h-[500px] border border-gray-700">
                  <div className="whitespace-pre-line text-sm text-gray-300">
                    {analysis.transcription || 
                     <span className="text-gray-500">אין תמלול זמין</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="ai-debug" className="space-y-6">
            <Card className="overflow-hidden bg-gray-900 border border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">פרטי ניתוח AI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none rtl text-gray-300 prose-headings:text-white prose-strong:text-white">
                  <h3 className="text-white">מודל: GPT-4-turbo</h3>
                  <p>המערכת משתמשת ב-OpenAI לניתוח תמלול השיחה שנוצר באמצעות מודל Whisper.</p>
                  <div className="bg-gray-800 p-3 rounded-md my-3">
                    <strong className="text-orange-500">סוג ניתוח:</strong> {analysis.analysis_type}
                  </div>
                  <h3 className="text-white mt-6">תמלול (Whisper)</h3>
                  <div className="bg-gray-800 p-3 rounded-md my-3 max-h-40 overflow-y-auto">
                    <pre className="text-gray-300 whitespace-pre-wrap">{analysis.transcription || 'אין תמלול זמין'}</pre>
                  </div>
                  <h3 className="text-white mt-6">תוצאת תשובת AI (JSON)</h3>
                  <div className="bg-gray-800 p-3 rounded-md my-3 max-h-80 overflow-y-auto">
                    <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(analysis.report_data, null, 2) || 'אין נתונים זמינים'}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      );
    }
    
    return (
      <Alert variant="destructive" className="bg-yellow-900/30 border-yellow-700 text-yellow-300">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>סטטוס הניתוח אינו ידוע או שאין מידע זמין.</AlertDescription>
      </Alert>
    );
  };

  // אם בבדיקת ההרשאות התגלה שאין הרשאות - מציג הודעת שגיאה
  if (isLoading) {
    return (
      <Card className="overflow-hidden bg-gray-900 border border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">טוען...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="w-16 h-16 border-t-4 border-orange-500 rounded-full animate-spin"></div>
        </CardContent>
      </Card>
    );
  }

  if (hasPermission === false) {
    return (
      <Card className="overflow-hidden bg-gray-900 border border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">אין הרשאות גישה</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-red-900/30 border-red-700 text-red-300">
            <LockIcon className="h-4 w-4" />
            <AlertDescription>
              אין לך הרשאות לצפות בניתוח זה. ניתוחים זמינים רק למשתמש שיצר אותם או לחברה שאליה הם שייכים.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-gray-900 border border-gray-800">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <CardTitle className="text-xl text-white">
                {analysisTypeLabels[analysis.analysis_type] || analysis.analysis_type}
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                נוצר ב-{formatDate(analysis.created_at)} | {renderStatusBadge()}
              </CardDescription>
            </div>
            
            {analysis.recording_url && (
              <Button 
                onClick={togglePlay} 
                className="bg-orange-500 hover:bg-orange-600 text-white"
                size="sm"
                aria-label={audioPlaying ? 'השהה שמע' : 'נגן שמע'}
              >
                {audioPlaying ? (
                  <span className="flex items-center gap-2">
                    <Pause className="h-4 w-4" />
                    השהה
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    נגן הקלטה
                  </span>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
} 