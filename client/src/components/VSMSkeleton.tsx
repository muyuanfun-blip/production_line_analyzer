import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export const VSMSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* 主要 KPI 骨架屏 */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="h-3 bg-slate-700 rounded w-20 animate-pulse" />
                <div className="h-7 bg-slate-700 rounded w-24 animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 瓶頸分析骨架屏 */}
      <Card className="bg-slate-800 border-slate-700 border-red-900">
        <div className="p-4 space-y-3">
          <div className="h-4 bg-slate-700 rounded w-32 animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 bg-slate-700 rounded w-16 animate-pulse" />
            <div className="h-5 bg-slate-700 rounded w-40 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-700 rounded w-16 animate-pulse" />
            <div className="h-5 bg-slate-700 rounded w-24 animate-pulse" />
          </div>
        </div>
      </Card>

      {/* 人力配置骨架屏 */}
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-4 space-y-3">
          <div className="h-4 bg-slate-700 rounded w-32 animate-pulse" />
          <div className="flex items-center justify-between">
            <div className="h-3 bg-slate-700 rounded w-20 animate-pulse" />
            <div className="h-6 bg-slate-700 rounded w-16 animate-pulse" />
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 animate-pulse" />
          <div className="h-3 bg-slate-700 rounded w-32 animate-pulse" />
        </div>
      </Card>

      {/* 流線分析骨架屏 */}
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-4 space-y-3">
          <div className="h-4 bg-slate-700 rounded w-32 animate-pulse" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <div className="h-3 bg-slate-700 rounded w-12 mx-auto animate-pulse" />
                <div className="h-6 bg-slate-700 rounded w-8 mx-auto animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 改善建議骨架屏 */}
      <Card className="bg-slate-800 border-slate-700 border-blue-900">
        <div className="p-4 space-y-2">
          <div className="h-4 bg-slate-700 rounded w-32 animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-700 rounded w-full animate-pulse" />
          ))}
        </div>
      </Card>
    </div>
  );
};
