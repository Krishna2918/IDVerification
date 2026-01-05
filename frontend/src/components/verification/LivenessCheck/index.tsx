import React, { useState, useRef, useCallback } from 'react';

interface LivenessCheckProps {
  sessionId: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

export const LivenessCheck: React.FC<LivenessCheckProps> = ({
  sessionId,
  onComplete,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [instruction, setInstruction] = useState('Position your face in the circle');
  const [progress, setProgress] = useState(0);

  const startLiveness = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsRecording(true);

      // Simulate liveness check sequence
      const instructions = [
        { text: 'Hold still...', duration: 2000 },
        { text: 'Turn your head slowly to the left', duration: 2000 },
        { text: 'Turn your head slowly to the right', duration: 2000 },
        { text: 'Look straight at the camera', duration: 1500 },
        { text: 'Verifying...', duration: 1500 },
      ];

      let currentProgress = 0;
      for (const step of instructions) {
        setInstruction(step.text);
        await new Promise((resolve) => setTimeout(resolve, step.duration));
        currentProgress += 100 / instructions.length;
        setProgress(currentProgress);
      }

      // Stop camera and complete
      mediaStream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsRecording(false);
      onComplete();
    } catch (err) {
      onError('Unable to access camera for liveness check.');
    }
  }, [onComplete, onError]);

  const cancelLiveness = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsRecording(false);
    setProgress(0);
    setInstruction('Position your face in the circle');
  }, [stream]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Liveness Check</h2>
      <p className="text-gray-600 mb-4">
        We need to verify you are a real person. Follow the instructions on screen.
      </p>

      {/* Camera View */}
      <div className="relative aspect-square max-w-sm mx-auto bg-gray-900 rounded-2xl overflow-hidden mb-4">
        {!isRecording && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <div className="text-6xl mb-4">👤</div>
            <p className="text-lg">Ready for liveness check</p>
          </div>
        )}

        {isRecording && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {/* Face Guide Circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-64 h-64 rounded-full border-4 border-white"
                style={{
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Instruction */}
      <div className="text-center mb-4">
        <p className="text-lg font-medium text-navy-700">{instruction}</p>
      </div>

      {/* Progress Bar */}
      {isRecording && (
        <div className="mb-4">
          <div className="w-full bg-navy-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-navy-700 to-navy-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!isRecording ? (
          <button className="btn-primary w-full" onClick={startLiveness}>
            Start Liveness Check
          </button>
        ) : (
          <button className="btn-cancel w-full" onClick={cancelLiveness}>
            Cancel
          </button>
        )}
      </div>

      {/* Tips */}
      <div className="mt-4 p-3 bg-navy-50 rounded-xl">
        <p className="text-sm text-gray-600">
          <strong>Tips:</strong> Find good lighting, remove glasses/hats, and look directly
          at the camera.
        </p>
      </div>
    </div>
  );
};

export default LivenessCheck;
