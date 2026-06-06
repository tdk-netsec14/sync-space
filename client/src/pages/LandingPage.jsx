import React from 'react';
import {
  ArrowRight,
  Sparkles,
  Layers3,
  Users,
  Lock,
  ChevronRight,
  Play,
  CheckCircle2,
  KanbanSquare,
  Lightbulb
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';

const features = [
  {
    icon: Layers3,
    title: 'Shared Grid Canvas',
    text: 'Create pristine workspaces designed for high-performance product execution.',
    color: '#DCC7FF'
  },
  {
    icon: Users,
    title: 'Operator Channels',
    text: 'Unify your team with fast, real-time board channels and role-aware boundaries.',
    color: '#F4C318'
  },
  {
    icon: Lock,
    title: 'Obsidian Auth',
    text: 'Enterprise-grade JWT authorization and secure multi-tenant isolation out of the box.',
    color: '#8B5CF6'
  }
];

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }
    }
  };

  return (
    <div className="relative min-h-screen bg-brand-offwhite text-brand-black overflow-x-hidden font-sans">
      {/* Decorative Editorial Elements */}
      <div className="absolute inset-0 dot-grid -z-10 opacity-70" />
      <div className="absolute top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-brand-lavender/10 blur-[130px]" />
      <div className="absolute top-[20%] left-[-100px] -z-10 h-[400px] w-[400px] rounded-full bg-brand-yellow/10 blur-[100px]" />

      <Navbar />

      {/* 1. Hero Section */}
      <main className="mx-auto max-w-6xl px-6 pt-32 pb-24 md:pt-40 md:pb-32">
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
        >
          {/* Hero Left Content */}
          <div className="flex flex-col items-start text-left">
            <motion.div
              variants={itemVariants}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-black bg-brand-beige px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-black shadow-editorial-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-purple" />
              <span>Editorial SaaS System</span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="font-editorial text-5xl font-extrabold tracking-tight text-brand-black sm:text-6xl lg:text-7xl leading-[1.05]"
            >
              Where teams <br />
              <span className="font-serif-editorial italic font-normal text-brand-purple text-6xl sm:text-7xl lg:text-8xl">
                collaborate
              </span>{' '}
              <br />
              without gravity.
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-8 max-w-lg text-lg leading-relaxed text-brand-black/70 font-sans-editorial font-medium"
            >
              SyncSpace combines agile Kanban sprints, instant socket updates, and AI intelligence
              inside a gorgeous, modular editorial console designed for elite developers.
            </motion.p>

            <motion.div variants={itemVariants} className="mt-10 flex flex-wrap gap-4">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-7 py-4 font-editorial font-bold text-brand-yellow shadow-editorial hover:bg-brand-black/90 transition-all border-editorial"
                >
                  Start Grid for Free <ArrowRight className="h-4.5 w-4.5 text-brand-yellow" />
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-black/10 px-7 py-4 font-editorial font-bold text-brand-black shadow-sm hover:border-brand-black transition-all"
                >
                  Launch Console <Play className="h-4 w-4 fill-brand-black text-brand-black" />
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* Hero Right - Collaborative Mockup Preview */}
          <motion.div variants={itemVariants} className="relative lg:ml-4">
            {/* Geometric shadow backplane */}
            <div className="absolute inset-0 bg-brand-lavender border-editorial rounded-3xl -z-10 translate-x-4 translate-y-4" />

            {/* The Main Container representing a Kanban board */}
            <div className="relative border-editorial rounded-3xl bg-white p-6 shadow-editorial overflow-hidden">
              <div className="flex items-center justify-between border-b border-brand-black/10 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#FF5F56]" />
                  <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                  <span className="h-3 w-3 rounded-full bg-[#27C93F]" />
                </div>
                <div className="rounded-full bg-brand-beige border border-brand-black/10 px-3 py-1 text-[10px] font-bold text-brand-black uppercase tracking-wider">
                  Live Canvas Sync
                </div>
              </div>

              {/* Collaborative Cursor Overlays */}
              <motion.div
                animate={{
                  x: [40, 180, 100, 40],
                  y: [120, 40, 160, 120]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 8,
                  ease: 'easeInOut'
                }}
                className="absolute z-30 flex items-center gap-1.5 pointer-events-none animate-pulse"
              >
                <div className="h-3.5 w-3.5 bg-brand-purple border border-white rounded-tl-none rounded-tr-full rounded-b-full shadow-md animate-bounce" />
                <span className="rounded bg-brand-purple px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm border border-brand-purple/20">
                  Alex (owner)
                </span>
              </motion.div>

              <motion.div
                animate={{
                  x: [240, 100, 200, 240],
                  y: [60, 180, 100, 60]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 6,
                  ease: 'easeInOut',
                  delay: 1
                }}
                className="absolute z-30 flex items-center gap-1.5 pointer-events-none"
              >
                <div className="h-3.5 w-3.5 bg-brand-yellow border border-white rounded-tl-none rounded-tr-full rounded-b-full shadow-md" />
                <span className="rounded bg-brand-yellow px-1.5 py-0.5 text-[9px] font-bold text-brand-black shadow-sm border border-brand-yellow/20">
                  Sara
                </span>
              </motion.div>

              {/* Grid Columns */}
              <div className="grid grid-cols-2 gap-4">
                {/* Column 1 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-brand-black/5 pb-2">
                    <span className="text-xs font-bold text-brand-black font-editorial uppercase">
                      Sprint Progress
                    </span>
                    <span className="rounded-full bg-brand-beige border border-brand-black/5 px-2 py-0.5 text-[9px] font-bold text-brand-black">
                      2
                    </span>
                  </div>

                  <motion.div
                    whileHover={{ y: -3 }}
                    className="border-editorial p-4 rounded-2xl bg-white shadow-editorial-sm space-y-3 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-brand-lavender border border-brand-black/10 px-2.5 py-0.5 text-[9px] font-bold text-brand-black uppercase">
                        SaaS Overhaul
                      </span>
                    </div>
                    <h3 className="font-bold text-xs leading-snug group-hover:text-brand-purple transition-colors">
                      Redesign Core Workspace Dashboard UI
                    </h3>
                    <div className="flex justify-between items-center pt-2 border-t border-brand-black/5">
                      <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">
                        Urgent
                      </span>
                      <div className="h-6 w-6 rounded-full bg-brand-purple flex items-center justify-center text-[8px] font-bold text-white border border-brand-black/10">
                        JD
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={{ y: -3 }}
                    className="border border-brand-black/10 p-4 rounded-2xl bg-brand-offwhite space-y-2"
                  >
                    <h3 className="font-bold text-xs leading-snug">
                      Compile Sprint Analytics & Charts
                    </h3>
                    <div className="flex justify-between items-center pt-2 border-t border-brand-black/5">
                      <span className="text-[9px] font-bold text-brand-black/40 uppercase">
                        Low
                      </span>
                      <div className="h-6 w-6 rounded-full bg-brand-yellow flex items-center justify-center text-[8px] font-bold text-brand-black border border-brand-black/10">
                        MK
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Column 2 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-brand-black/5 pb-2">
                    <span className="text-xs font-bold text-brand-black font-editorial uppercase">
                      Sprint Done
                    </span>
                    <span className="rounded-full bg-brand-lavender/40 border border-brand-black/5 px-2 py-0.5 text-[9px] font-bold text-brand-black">
                      1
                    </span>
                  </div>

                  <motion.div
                    whileHover={{ y: -3 }}
                    className="border border-brand-black/10 p-4 rounded-2xl bg-white shadow-sm space-y-3 opacity-90"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-green-100 border border-green-300 px-2.5 py-0.5 text-[9px] font-bold text-green-700 uppercase">
                        AI Engine
                      </span>
                    </div>
                    <h3 className="font-bold text-xs leading-snug text-brand-black/60 line-through">
                      Setup Standup Generator fallbacks
                    </h3>
                    <div className="flex justify-between items-center pt-2 border-t border-brand-black/5">
                      <span className="text-[9px] font-bold text-green-600 uppercase">
                        Resolved
                      </span>
                      <div className="h-6 w-6 rounded-full bg-brand-purple flex items-center justify-center text-[8px] font-bold text-white border border-brand-black/10">
                        SS
                      </div>
                    </div>
                  </motion.div>

                  {/* AI Insight Popup overlaying Column 2 */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ delay: 1, duration: 0.5 }}
                    className="border-editorial p-3.5 rounded-2xl bg-brand-beige shadow-editorial-sm space-y-2 border-brand-purple"
                  >
                    <div className="flex items-center gap-1.5 text-brand-purple">
                      <Lightbulb className="h-4 w-4 animate-bounce" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        AI Suggestion
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-brand-black/80 font-medium">
                      Sara is optimal for "Setup Standup Generator fallbacks" due to active canvas
                      involvement.
                    </p>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.section>
      </main>

      {/* 2. Bold Yellow Asymmetrical Value Section */}
      <section className="bg-brand-yellow border-t-2 border-b-2 border-brand-black py-20 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
        <div className="mx-auto max-w-6xl px-6 grid gap-12 lg:grid-cols-[0.8fr_1.2fr] items-center">
          <div>
            <h2 className="font-editorial text-4xl font-black text-brand-black sm:text-5xl leading-none uppercase">
              Designed <br />
              for modern <br />
              <span className="font-serif-editorial italic font-normal text-white lowercase">
                workspace
              </span>{' '}
              <br />
              intelligence.
            </h2>
            <p className="mt-6 text-brand-black/80 text-sm font-sans-editorial font-bold leading-relaxed">
              We ditched generic enterprise admin layouts in favor of curated editorial spaces, high
              performance typography, and smooth layouts that elevate your focus.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="border-editorial rounded-3xl bg-brand-offwhite p-6 shadow-editorial">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-purple text-white border-editorial border-brand-black shadow-editorial-sm mb-4">
                <KanbanSquare className="h-5 w-5" />
              </span>
              <h3 className="font-editorial text-lg font-bold text-brand-black">
                Agile Grid Canvas
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-brand-black/60 font-medium">
                Sleek, fluid drag-and-drop mechanics with instant socket board updates. See
                collaborative edits live.
              </p>
            </div>

            <div className="border-editorial rounded-3xl bg-brand-beige p-6 shadow-editorial">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-black text-brand-yellow border-editorial border-brand-black shadow-editorial-sm mb-4">
                <Sparkles className="h-5 w-5" />
              </span>
              <h3 className="font-editorial text-lg font-bold text-brand-black">
                AI Sprint Reports
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-brand-black/60 font-medium">
                Auto-generate highly structured summaries and individual standups directly from
                workspace activity cards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Detail Section (Deep Black Background) */}
      <section className="bg-brand-black text-brand-offwhite py-24 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid-dark opacity-10 pointer-events-none" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="rounded-full bg-brand-purple px-4 py-1 text-xs font-bold uppercase tracking-wider text-white border border-brand-purple/20">
              Technical Architecture
            </span>
            <h2 className="font-editorial text-4xl font-extrabold text-white mt-5 sm:text-5xl leading-none">
              Rigid security. <br />
              <span className="font-serif-editorial italic font-normal text-brand-lavender text-4xl sm:text-5xl">
                Highly interactive UI.
              </span>
            </h2>
            <p className="mt-6 text-brand-offwhite/50 text-sm font-sans-editorial">
              Built on React 18 and Tailwind CSS, SyncSpace establishes clean multi-tenant
              workspaces with enterprise-grade JWT borders.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  whileHover={{ y: -5 }}
                  className="border border-brand-offwhite/10 rounded-3xl bg-[#1a1a1a] p-8 shadow-sm flex flex-col items-start text-left"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-black shadow-sm mb-6 text-brand-black"
                    style={{ backgroundColor: feature.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>

                  <h3 className="font-editorial text-xl font-bold text-white mb-3">
                    {feature.title}
                  </h3>

                  <p className="text-xs leading-relaxed text-brand-offwhite/60 font-medium">
                    {feature.text}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Elegant Editorial Call to Action */}
      <section className="bg-brand-beige py-24 border-t-2 border-brand-black text-center relative">
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-editorial text-5xl font-black text-brand-black sm:text-6xl leading-[0.95] uppercase">
            Upgrade <br />
            your team's <br />
            <span className="font-serif-editorial italic font-normal text-brand-purple lowercase">
              sprint pace
            </span>
            .
          </h2>
          <p className="mt-8 text-sm leading-relaxed text-brand-black/70 max-w-lg mx-auto font-sans-editorial font-semibold">
            Deploy beautiful visual spaces, organize agile columns, invite unlimited operators, and
            automate standups. Secure, fast, real-time.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-brand-black border-editorial px-8 py-4 text-sm font-editorial font-bold text-brand-yellow shadow-editorial hover:bg-brand-black/90 transition-all"
              >
                Create Account <ChevronRight className="h-4.5 w-4.5 text-brand-yellow" />
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-black/10 px-8 py-4 text-sm font-editorial font-bold text-brand-black shadow-sm hover:border-brand-black transition-all"
              >
                Operator Login
              </Link>
            </motion.div>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-brand-black/50 font-bold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-brand-purple" /> Real-Time Sync
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-brand-purple" /> Custom Design System
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-brand-purple" /> AI Assist Suite
            </span>
          </div>
        </div>
      </section>

      {/* 5. Minimalistic footer */}
      <footer className="bg-brand-black border-t border-brand-offwhite/5 py-8 text-center text-xs text-brand-offwhite/40 font-bold font-sans-editorial">
        <p>© 2026 SyncSpace Inc. All rights reserved. Powered by SyncSpace AI Infrastructure.</p>
      </footer>
    </div>
  );
}
