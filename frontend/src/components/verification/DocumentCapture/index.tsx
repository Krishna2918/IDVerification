import React, { useRef, useState, useCallback } from 'react';

interface DocumentCaptureProps {
  side: 'front' | 'back';
  onCapture: (imageData: Blob) => void;
  onError: (error: string) => void;
}

export const DocumentCapture: React.FC<DocumentCaptureProps> = ({
  side,
  onCapture,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCapturing(true);
    } catch (err) {
      onError('Unable to access camera. Please allow camera permissions or upload a file.');
    }
  }, [onError]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
        onError('Invalid file type. Please upload a JPEG, PNG, or PDF file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [onError]);

  const handleConfirm = useCallback(async () => {
    if (capturedImage) {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      onCapture(blob);
    }
  }, [capturedImage, onCapture]);

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        Capture {side === 'front' ? 'Front' : 'Back'} of ID
      </h2>
      <p className="text-gray-600 mb-4">
        {side === 'front'
          ? 'Position the front of your ID document within the frame'
          : 'Position the back of your ID document within the frame'}
      </p>

      {/* Capture Area */}
      <div className="relative aspect-[3/2] bg-gray-900 rounded-2xl overflow-hidden mb-4">
        {!capturedImage && !isCapturing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-lg">Ready to capture</p>
          </div>
        )}

        {isCapturing && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {capturedImage && (
          <img
            src={capturedImage}
            alt="Captured document"
            className="w-full h-full object-contain bg-black"
          />
        )}

        {/* Overlay Guide */}
        {isCapturing && (
          <div className="absolute inset-4 border-2 border-white border-dashed rounded-lg opacity-50" />
        )}
      </div>

      {/* Hidden Elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,application/pdf"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Actions */}
      <div className="flex gap-3">
        {!capturedImage && !isCapturing && (
          <>
            <button className="btn-secondary flex-1" onClick={() => fileInputRef.current?.click()}>
              Upload File
            </button>
            <button className="btn-primary flex-1" onClick={startCamera}>
              Use Camera
            </button>
          </>
        )}

        {isCapturing && (
          <>
            <button className="btn-cancel flex-1" onClick={stopCamera}>
              Cancel
            </button>
            <button className="btn-primary flex-1" onClick={capturePhoto}>
              Capture
            </button>
          </>
        )}

        {capturedImage && (
          <>
            <button className="btn-secondary flex-1" onClick={handleRetake}>
              Retake
            </button>
            <button className="btn-primary flex-1" onClick={handleConfirm}>
              Use This Photo
            </button>
          </>
        )}
      </div>

      {/* Tips */}
      <div className="mt-4 p-3 bg-navy-50 rounded-xl">
        <p className="text-sm text-gray-600">
          <strong>Tips:</strong> Ensure good lighting, avoid glare, and keep the entire
          document visible within the frame.
        </p>
      </div>
    </div>
  );
};

export default DocumentCapture;
