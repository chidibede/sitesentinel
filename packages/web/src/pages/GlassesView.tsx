import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '../api';
import type { Issue } from '../types';

const GlassesView = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captureInterval, setCaptureInterval] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentIssues, setCurrentIssues] = useState<Issue[]>([]);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
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
        stream.getTracks().forEach((track) => track.stop());
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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise<string>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        }
      }, 'image/jpeg', 0.8);
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
        siteId: 'demo-site',
        returnOverlay: true,
      });

      setCurrentIssues(response.issues);
      setOverlayUrl(response.overlayUrl ?? null);

      if (response.issues.length > 0) {
        const topIssue = response.issues[0];
        if (topIssue) {
          setStatus(`${response.issues.length} hazard(s) detected`);
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

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          if (base64Audio) {
            try {
              setStatus('Transcribing...');
              const response = await apiClient.transcribeVoice({
                audio: base64Audio,
                siteId: 'demo-site',
                zone: 'site-main',
              });
              setStatus(`Transcribed: ${response.transcription}`);
            } catch (error) {
              console.error('Transcription failed:', error);
              setStatus('Transcription failed');
            }
          }
        };
        reader.readAsDataURL(blob);
        audioStream.getTracks().forEach((track) => track.stop());
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

  const captureVerification = async () => {
    if (!verifyMode) return;

    try {
      setStatus('Verifying fix...');
      const imageData = await captureFrame();
      if (!imageData) return;

      const response = await apiClient.verifyFix(verifyMode, {
        afterImage: imageData,
        provider: 'meta',
      });

      setStatus(response.resolved ? 'Fix verified ✓' : 'Issue persists ✗');
      speakAlert(response.resolved ? 'Fix verified' : 'Issue persists');
      setVerifyMode(null);

      // Refresh issues
      void inspectFrame();
    } catch (error) {
      console.error('Verification failed:', error);
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

      {/* Overlay image */}
      {overlayUrl && (
        <img
          src={overlayUrl}
          alt="Detection overlay"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-90"
        />
      )}

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
                  issue.riskBand === 'very-high' || issue.riskBand === 'high'
                    ? 'border-red-500'
                    : issue.riskBand === 'medium'
                    ? 'border-yellow-500'
                    : 'border-green-500'
                } pointer-events-auto cursor-pointer hover:bg-opacity-80`}
                onClick={() => startVerifyMode(issue.id)}
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
              onClick={() => setVerifyMode(null)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-full font-semibold shadow-lg"
            >
              Cancel Verify
            </button>
            <button
              onClick={() => void captureVerification()}
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
              onMouseDown={() => void startVoiceReport()}
              onMouseUp={stopVoiceReport}
              onTouchStart={() => void startVoiceReport()}
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
