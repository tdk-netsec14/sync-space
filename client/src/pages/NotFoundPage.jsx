/**
 * client/src/pages/NotFoundPage.jsx
 *
 * Friendly 404 page shown for all unmatched routes.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F8F5] px-6 font-sans">
      {/* Subtle dot grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, #11111115 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }}
      />

      <div className="relative z-10 w-full max-w-lg text-center">
        {/* 404 Display */}
        <p className="text-[9rem] font-black leading-none tracking-tighter text-[#111111]/8 select-none">
          404
        </p>

        <div className="mx-auto -mt-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#111111]/10 bg-white shadow-lg">
          <Compass className="h-8 w-8 text-[#8B5CF6]" />
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-tight text-[#111111]">Page not found</h1>
        <p className="mt-2 text-sm text-[#111111]/50 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#111111]/15 bg-white px-5 py-2.5 text-xs font-bold text-[#111111] hover:bg-[#F8F8F5] transition shadow-sm cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go back
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#111111] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#333] transition cursor-pointer"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
