import React, { useCallback, useState, useRef } from 'react';
import { Upload, Camera, BrainCircuit, PenTool, X, SwitchCamera, Aperture } from 'lucide-react';

interface UploadViewProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const UploadView: React.FC<UploadViewProps> = ({ onFileSelect, isLoading }) => {
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const startCamera = async () => {
    setIsCameraMode(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setCameraError("카메라를 실행할 수 없습니다. 권한을 확인해주세요.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraMode(false);
  };

  const switchCamera = () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setTimeout(() => startCamera(), 100); 
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
            stopCamera();
            onFileSelect(file);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (isLoading) return;
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onFileSelect(e.dataTransfer.files[0]);
      }
    },
    [onFileSelect, isLoading]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  if (isCameraMode) {
    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover md:object-contain" 
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4 text-center">
                        <p>{cameraError}</p>
                        <button onClick={stopCamera} className="mt-4 px-4 py-2 bg-white text-black rounded-lg">닫기</button>
                    </div>
                )}

                <button 
                    onClick={stopCamera} 
                    className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full z-10"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="h-32 bg-slate-900 flex items-center justify-around px-8">
                <div className="w-12"></div>
                <button 
                    onClick={capturePhoto} 
                    className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 flex items-center justify-center hover:scale-105 transition-transform"
                >
                    <div className="w-14 h-14 rounded-full border-2 border-slate-900"></div>
                </button>
                <button 
                    onClick={switchCamera} 
                    className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center"
                >
                    <SwitchCamera size={24} />
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 p-4 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">
          스마트 스터디 <span className="text-blue-500">AI</span>
        </h1>
        <p className="text-slate-500 text-lg">
          틀린 문제를 찍어 올리세요. <br className="md:hidden" />
          AI 선생님이 <span className="text-blue-600 font-bold">단계별 풀이</span>와 <span className="text-blue-600 font-bold">유사 문제</span>를 알려줄게요!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`
              relative border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 flex flex-col items-center justify-center min-h-[240px]
              ${isLoading 
                ? 'border-blue-300 bg-blue-50 cursor-wait' 
                : 'border-slate-300 hover:border-blue-400 hover:bg-white bg-slate-50 cursor-pointer shadow-sm hover:shadow-md'
              }
            `}
          >
            <input
              type="file"
              id="file-upload"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              onChange={handleChange}
              accept="image/*, .pdf, .hwp, .pptx, .ppt"
              disabled={isLoading}
            />
            {isLoading ? (
                <div className="flex flex-col items-center">
                   <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                   <p className="text-blue-600 font-semibold animate-pulse">분석 중...</p>
                </div>
            ) : (
                <>
                   <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500 mb-4">
                     <Upload size={28} />
                   </div>
                   <p className="font-bold text-slate-700 text-lg">파일 업로드</p>
                   <p className="text-slate-400 text-sm mt-1">이미지, PDF, 문서 지원</p>
                </>
            )}
          </div>

          <button
            onClick={startCamera}
            disabled={isLoading}
            className="border-2 border-slate-300 bg-slate-50 hover:bg-white hover:border-blue-400 hover:shadow-md rounded-3xl p-8 flex flex-col items-center justify-center min-h-[240px] transition-all duration-300 group"
          >
             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-purple-500 mb-4 group-hover:scale-110 transition-transform">
                <Camera size={28} />
             </div>
             <p className="font-bold text-slate-700 text-lg">카메라 촬영</p>
             <p className="text-slate-400 text-sm mt-1">시험지, 문제집 바로 찍기</p>
          </button>
      </div>
      
      {!isLoading && (
         <div className="mt-8 bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
               <span className="text-blue-500 text-2xl">💡</span> 사용 방법
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3">
                     <Aperture size={24} />
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1">1. 문제 선택</h4>
                  <p className="text-sm text-slate-500 leading-snug">
                     사진은 원하는 문제만 잘라내고,<br/>문서는 바로 분석합니다.
                  </p>
               </div>
               <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center mb-3">
                     <BrainCircuit size={24} />
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1">2. AI 분석</h4>
                  <p className="text-sm text-slate-500 leading-snug">
                     AI 선생님이 문제를 인식하고<br/>풀이 과정을 분석해요.
                  </p>
               </div>
               <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3">
                     <PenTool size={24} />
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1">3. 맞춤 학습</h4>
                  <p className="text-sm text-slate-500 leading-snug">
                     단계별 풀이를 익히고<br/>유사 문제로 복습해요.
                  </p>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default UploadView;