import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

/** AI가 만든 SVG에서 스크립트·이벤트·외부 링크를 제거하고 표시합니다. */
const SafeSvg: React.FC<{ svg: string; className?: string }> = ({ svg, className = '' }) => {
  const html = useMemo(() => {
    if (!svg || !svg.includes('<svg')) return '';
    return DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['foreignObject', 'script', 'a', 'image', 'use'],
      FORBID_ATTR: ['href', 'xlink:href'],
    });
  }, [svg]);
  if (!html) return null;
  return (
    <div
      className={`w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default SafeSvg;
