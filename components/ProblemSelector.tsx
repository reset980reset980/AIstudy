import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Crop, Move } from 'lucide-react';

interface ProblemSelectorProps {
  imageUrl: string;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

const ProblemSelector: React.FC<ProblemSelectorProps> = ({ imageUrl, onConfirm, onCancel }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);

  // Initialize selection to full image once loaded, or let user draw
  const handleImageLoad = () => {
    if (imgRef.current && containerRef.current) {
        // Optional: Auto-select center or full image initially
    }
  };

  const getRelativeCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    const coords = getRelativeCoords(e);
    setStartPos(coords);
    setSelection({ x: coords.x, y: coords.y, w: 0, h: 0 });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSelecting || !startPos || !containerRef.current) return;
    
    const current = getRelativeCoords(e);
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;

    // Calculate new rect
    let x = Math.min(current.x, startPos.x);
    let y = Math.min(current.y, startPos.y);
    let w = Math.abs(current.x - startPos.x);
    let h = Math.abs(current.y - startPos.y);

    // Boundary checks
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > containerW) w = containerW - x;
    if (y + h > containerH) h = containerH - y;

    setSelection({ x, y, w, h });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setStartPos(null);
  };

  const handleCropAndConfirm = async () => {
    if (!imgRef.current || !selection || selection.w === 0 || selection.h === 0) {
        // If no selection, use full image
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], "full_image.jpg", { type: "image/jpeg" });
        onConfirm(file);
        return;
    }

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.clientWidth;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.clientHeight;

    canvas.width = selection.w * scaleX;
    canvas.height = selection.h * scaleY;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      selection.x * scaleX,
      selection.y * scaleY,
      selection.w * scaleX,
      selection.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "cropped_problem.jpg", { type: "image/jpeg" });
        onConfirm(file);
      }
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] animate-fade-in p-4">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 max-w-4xl w-full">
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
                <Crop className="text-blue-500" />
                문제 선택하기
            </h2>
            <p className="text-slate-500 mt-2">
                사진 속에 여러 문제가 있다면, <br className="md:hidden"/>
                <span className="text-blue-600 font-bold">풀고 싶은 문제만 드래그</span>해서 선택해주세요.
            </p>
        </div>

        <div 
            ref={containerRef}
            className="relative w-full bg-slate-100 rounded-lg overflow-hidden cursor-crosshair touch-none select-none mx-auto border border-slate-300"
            style={{ maxWidth: '600px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
        >
            <img 
                ref={imgRef}
                src={imageUrl} 
                alt="Upload Preview" 
                className="w-full h-auto block pointer-events-none select-none"
                onLoad={handleImageLoad}
            />
            
            {/* Dark Overlay */}
            {selection && (
                <>
                    {/* Top */}
                    <div className="absolute top-0 left-0 right-0 bg-black/50 pointer-events-none" style={{ height: selection.y }} />
                    {/* Bottom */}
                    <div className="absolute left-0 right-0 bottom-0 bg-black/50 pointer-events-none" style={{ top: selection.y + selection.h }} />
                    {/* Left */}
                    <div className="absolute left-0 top-0 bottom-0 bg-black/50 pointer-events-none" style={{ width: selection.x, top: selection.y, bottom: 'auto', height: selection.h }} />
                    {/* Right */}
                    <div className="absolute right-0 top-0 bottom-0 bg-black/50 pointer-events-none" style={{ left: selection.x + selection.w, top: selection.y, bottom: 'auto', height: selection.h }} />
                    
                    {/* Selection Box */}
                    <div 
                        className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(59,130,246,1)] pointer-events-none"
                        style={{
                            left: selection.x,
                            top: selection.y,
                            width: selection.w,
                            height: selection.h
                        }}
                    >
                        {/* Corner Handles for visual cue */}
                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white rounded-full"></div>
                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white rounded-full"></div>
                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white rounded-full"></div>
                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white rounded-full"></div>
                    </div>
                </>
            )}

            {!selection && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                    <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
                        <Move size={16} /> 화면을 드래그하여 문제를 선택하세요
                    </div>
                </div>
            )}
        </div>

        <div className="flex justify-center gap-4 mt-8">
            <button 
                onClick={onCancel}
                className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
                <X size={20} /> 취소
            </button>
            <button 
                onClick={handleCropAndConfirm}
                className="px-8 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
                <Check size={20} /> 
                {(!selection || (selection.w === 0)) ? '전체 선택' : '선택 완료'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProblemSelector;
