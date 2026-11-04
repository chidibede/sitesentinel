import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient, SITE_ID } from '../api';
import type { Issue } from '../types';

const GlassesView = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captureInterval, setCaptureInterval] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentIssues, setCurrentIssues] = useState<Issue[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [verifyMode, setVerifyMode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Ready');

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        console.error('Camera access denied:', error);
        setStatus('Camera access denied');
      }
    }

    void startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  // Capture frame from video
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Downscale to <=1280px on the long edge to keep the request body small.
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise<string>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        }
      }, 'image/jpeg', 0.7);
    });
  }, []);

  // Inspect frame
  const inspectFrame = useCallback(async () => {
    try {
      setStatus('Detecting hazards...');
      const imageData = await captureFrame();
      if (!imageData) return;

      const response = await apiClient.inspect({
        image: imageData,
        rulePackId: 'construction',
        zone: 'site-main',
        siteId: SITE_ID,
        returnOverlay: false,
      });

      setCurrentIssues(response.issues);
      drawOverlays(response.issues);

      if (response.issues.length > 0) {
        const topIssue = response.issues[0] ?? null;
        setStatus(`${response.issues.length} hazard(s) detected`);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (topIssue) {
          speakAlert(topIssue.voiceAlert ?? `${topIssue.riskBand} risk: ${topIssue.title}`);
        }
      } else {
        setStatus('No hazards detected');
      }
    } catch (error) {
      console.error('Inspection failed:', error);
      setStatus('Inspection failed');
    }
  }, [captureFrame]);

  // Draw overlays on canvas
  const drawOverlays = useCallback((issues: Issue[]) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const frameArea = canvas.width * canvas.height;
    const usedPositions: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    issues.forEach((issue) => {
      const riskColor = issue.riskBand === 'critical' || issue.riskBand === 'high'
        ? '#ef4444'
        : issue.riskBand === 'medium'
        ? '#f59e0b'
        : '#10b981';
      
      issue.evidenceBoxes.forEach((box) => {
        const boxArea = box.width * box.height;
        const coveragePercent = (boxArea / frameArea) * 100;
        
        // Drop boxes covering >80% of frame
        if (coveragePercent > 80) return;
        
        // Draw box
        ctx.strokeStyle = riskColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        // Draw label - one per box
        const label = issue.title;
        const labelPadding = 6;
        const fontSize = 16;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width + labelPadding * 2;
        const textHeight = fontSize + labelPadding * 2;
        
        // Calculate label position - above box or offset if collision
        const labelX = box.x;
        let labelY = box.y - textHeight - 4;
        
        // Check for collision with previous labels
        const hasCollision = usedPositions.some(pos => 
          labelX < pos.x + pos.width &&
          labelX + textWidth > pos.x &&
          labelY < pos.y + pos.height &&
          labelY + textHeight > pos.y
        );
        
        if (hasCollision || labelY < 0) {
          // Offset label inside box at top
          labelY = box.y + 4;
        }
        
        // Draw label background
        ctx.fillStyle = riskColor;
        ctx.fillRect(labelX, labelY, textWidth, textHeight);
        
        // Draw label text
        ctx.fillStyle = 'white';
        ctx.fillText(label, labelX + labelPadding, labelY + fontSize + labelPadding / 2);
        
        // Track used position
        usedPositions.push({ x: labelX, y: labelY, width: textWidth, height: textHeight });
      });
    });
  }, []);

  // Speak alert using browser TTS
  const speakAlert = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Toggle auto-capture
  const toggleAutoCapture = () => {
    if (isCapturing) {
      if (captureInterval) {
        clearInterval(captureInterval);
        setCaptureInterval(null);
      }
      setIsCapturing(false);
      setStatus('Auto-capture stopped');
    } else {
      const interval = window.setInterval(() => {
        void inspectFrame();
      }, 10000);
      setCaptureInterval(interval);
      setIsCapturing(true);
      setStatus('Auto-capture every 10s');
    }
  };

  // Manual capture
  const handleManualCapture = () => {
    void inspectFrame();
  };

  // Push-to-talk voice report
  const startVoiceReport = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(audioStream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          void (async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            if (base64Audio) {
              try {
                setStatus('Transcribing...');
                const response = await apiClient.transcribeVoice({
                  audio: base64Audio,
                  siteId: SITE_ID,
                  zone: 'site-main',
                });
                setStatus(`Transcribed: ${response.transcription}`);
              } catch (error) {
                console.error('Transcription failed:', error);
                setStatus('Transcription failed');
              }
            }
          })();
        };
        reader.readAsDataURL(blob);
        audioStream.getTracks().forEach((track) => {
          track.stop();
        });
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setStatus('Recording voice report...');
    } catch (error) {
      console.error('Voice recording failed:', error);
      setStatus('Voice recording failed');
    }
  };

  const stopVoiceReport = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  };

  // Verify fix mode
  const startVerifyMode = (issueId: string) => {
    setVerifyMode(issueId);
    setStatus(`Verify mode: ${issueId.slice(0, 8)}`);
  };

  const pollVerification = async (issueId: string): Promise<boolean | null> => {
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const { issues } = await apiClient.listIssues({ siteId: SITE_ID });
        const issue = issues.find((i) => i.id === issueId);
        if (issue?.status === 'resolved' || issue?.status === 'closed') return true;
        if (issue?.status === 'reopened') return false;
      } catch {
        // keep polling
      }
    }
    return null;
  };

  const captureVerification = async () => {
    if (!verifyMode) return;

    try {
      setStatus('Verifying fix...');
      const imageData = await captureFrame();
      if (!imageData) return;

      const issueId = verifyMode;
      let resolved: boolean | null = null;
      try {
        const response = await apiClient.verifyFix(issueId, {
          afterImage: imageData,
          provider: 'meta',
        });
        resolved = response.resolved;
      } catch (error) {
        // The request may time out/drop while the backend still finishes.
        // Fall back to polling the issue status until it reaches a terminal state.
        console.warn('Verify request failed, polling issue status:', error);
        setStatus('Verifying fix... (checking status)');
        resolved = await pollVerification(issueId);
      }

      setVerifyMode(null);
      if (resolved === null) {
        setStatus('Verification still pending - check Dashboard');
        return;
      }
      setStatus(resolved ? 'Fix verified ✓' : 'Issue persists ✗ (reopened)');
      speakAlert(resolved ? 'Fix verified' : 'Issue persists');
      setCurrentIssues((prev) => prev.filter((i) => !(resolved && i.id === issueId)));
    } catch (error) {
      console.error('Verification failed:', error);
      setVerifyMode(null);
      setStatus('Verification failed');
    }
  };

  return (
    <div className="relative h-screen bg-black">
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay canvas for detection boxes */}
      <canvas 
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top bar */}
        <div className="flex justify-between items-start p-4">
          <div className="bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg text-sm font-mono">
            {status}
          </div>
          <div className="bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg text-xs">
            {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Center crosshair */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <svg width="40" height="40" className="text-white opacity-30">
            <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="20" y1="5" x2="20" y2="15" stroke="currentColor" strokeWidth="2" />
            <line x1="20" y1="25" x2="20" y2="35" stroke="currentColor" strokeWidth="2" />
            <line x1="5" y1="20" x2="15" y2="20" stroke="currentColor" strokeWidth="2" />
            <line x1="25" y1="20" x2="35" y2="20" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        {/* Issue list on right side */}
        {currentIssues.length > 0 && (
          <div className="absolute right-4 top-20 max-w-xs space-y-2">
            {currentIssues.map((issue) => (
              <div
                key={issue.id}
                className={`bg-black bg-opacity-70 text-white p-3 rounded-lg text-sm border-l-4 ${
                  issue.riskBand === 'critical' || issue.riskBand === 'high'
                    ? 'border-red-500'
                    : issue.riskBand === 'medium'
                    ? 'border-yellow-500'
                    : 'border-green-500'
                } pointer-events-auto cursor-pointer hover:bg-opacity-80`}
                onClick={() => {
                  startVerifyMode(issue.id);
                }}
              >
                <div className="font-bold uppercase text-xs mb-1">{issue.riskBand} RISK</div>
                <div className="font-semibold">{issue.title}</div>
                <div className="text-xs text-gray-300 mt-1">{issue.category}</div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom notice */}
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 text-center">
          <div className="bg-blue-900 bg-opacity-80 text-white px-4 py-2 rounded-lg text-sm max-w-md">
            Built for Meta Ray-Ban glasses. Phone camera stands in during demo.
          </div>
        </div>
      </div>

      {/* Control buttons */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center space-x-4 pointer-events-auto px-4">
        {verifyMode ? (
          <>
            <button
              onClick={() => {
                setVerifyMode(null);
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-full font-semibold shadow-lg"
            >
              Cancel Verify
            </button>
            <button
              onClick={() => {
                void captureVerification();
              }}
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg"
            >
              Capture Verification
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleAutoCapture}
              className={`${
                isCapturing ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
              } text-white px-6 py-3 rounded-full font-semibold shadow-lg`}
            >
              {isCapturing ? 'Stop Auto' : 'Auto 10s'}
            </button>

            <button
              onClick={handleManualCapture}
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-bold shadow-lg text-lg"
            >
              Inspect
            </button>

            <button
              onMouseDown={() => {
                void startVoiceReport();
              }}
              onMouseUp={stopVoiceReport}
              onTouchStart={() => {
                void startVoiceReport();
              }}
              onTouchEnd={stopVoiceReport}
              className={`${
                isRecording ? 'bg-red-600' : 'bg-purple-600 hover:bg-purple-500'
              } text-white px-6 py-3 rounded-full font-semibold shadow-lg`}
            >
              {isRecording ? 'Recording...' : 'Push to Talk'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GlassesView;
