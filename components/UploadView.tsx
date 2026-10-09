import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, Camera, BrainCircuit, PenTool, X, SwitchCamera, Aperture } from 'lucide-react';

interface UploadViewProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  statusMessage?: string;
  providerName?: string;
  onOpenSettings?: () => void;
}

const UploadView: React.FC<UploadViewProps> = ({ onFileSelect, isLoading, statusMessage, providerName, onOpenSettings }) => {
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setIsCameraMode(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } }
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
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setTimeout(() => startCamera(nextMode), 100);
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

  // 화면을 떠날 때 카메라 끄기
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

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
      e.target.value = ''; // 같은 파일을 다시 골라도 동작하도록
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
    <div className="max-w-2xl mx-auto mt-6 sm:mt-12 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 dark:text-white mb-4 tracking-tight">
          스마트 스터디 <span className="text-blue-500">AI</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          틀린 문제를 찍어 올리세요. <br className="md:hidden" />
          AI 선생님이 <span className="text-blue-600 dark:text-blue-400 font-bold">단계별 풀이</span>와 <span className="text-blue-600 dark:text-blue-400 font-bold">유사 문제</span>를 알려줄게요!
        </p>
      </div>

      {!isLoading && onOpenSettings && (
        <div className="flex justify-center mb-6">
          <button onClick={onOpenSettings} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${providerName ? 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800' : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'}`}>
            {providerName ? `사용 중인 AI: ${providerName} · 바꾸기` : '⚠️ AI 키가 없어요 · 설정에서 등록하기'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`
              relative border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] sm:min-h-[240px]
              ${isLoading 
                ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 cursor-wait' 
                : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-white dark:hover:bg-slate-800 bg-slate-50 dark:bg-slate-800 cursor-pointer shadow-sm hover:shadow-md'
              }
            `}
          >
            <input
              type="file"
              id="file-upload"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              onChange={handleChange}
              accept="image/*,.pdf,application/pdf"
              disabled={isLoading}
            />
            {isLoading ? (
                <div className="flex flex-col items-center">
                   <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                   <p className="text-blue-600 dark:text-blue-400 font-semibold animate-pulse">{statusMessage || '분석 중...'}</p>
                   <p className="text-xs text-slate-400 mt-2">보통 20~60초 정도 걸려요</p>
                </div>
            ) : (
                <>
                   <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center shadow-sm text-blue-500 dark:text-blue-400 mb-4">
                     <Upload size={28} />
                   </div>
                   <p className="font-bold text-slate-700 dark:text-white text-lg">파일 업로드</p>
                   <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">사진(JPG·PNG) 또는 PDF</p>
                </>
            )}
          </div>

          <button
            onClick={() => startCamera()}
            disabled={isLoading}
            className="border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md rounded-3xl p-8 flex flex-col items-center justify-center min-h-[180px] sm:min-h-[240px] transition-all duration-300 group"
          >
             <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center shadow-sm text-purple-500 dark:text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                <Camera size={28} />
             </div>
             <p className="font-bold text-slate-700 dark:text-white text-lg">카메라 촬영</p>
             <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">시험지, 문제집 바로 찍기</p>
          </button>
      </div>
      
      {!isLoading && (
         <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-100 dark:border-slate-700 shadow-sm">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
               <span className="text-blue-500 text-2xl">💡</span> 사용 방법
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center mb-3">
                     <Aperture size={24} />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-1">1. 문제 선택</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                     사진은 원하는 문제만 잘라내고,<br/>문서는 바로 분석합니다.
                  </p>
               </div>
               <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400 rounded-full flex items-center justify-center mb-3">
                     <BrainCircuit size={24} />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-1">2. AI 분석</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                     AI 선생님이 문제를 인식하고<br/>풀이 과정을 분석해요.
                  </p>
               </div>
               <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 text-green-500 dark:text-green-400 rounded-full flex items-center justify-center mb-3">
                     <PenTool size={24} />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-1">3. 맞춤 학습</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
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