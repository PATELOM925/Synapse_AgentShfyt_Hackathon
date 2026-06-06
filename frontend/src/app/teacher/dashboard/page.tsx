"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { teacherApi, studentApi } from "@/lib/synapseApi";
import {
  BookOpenText, Check, ChevronDown, ChevronUp, Copy, FileText, GraduationCap,
  Layers, Mic, Network, Paperclip, Sparkles, TrendingUp, Users, Volume2, X, Zap,
  BarChart2, Clock, Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_STUDENTS, MOCK_CLASS, MOCK_CLASS_STATS, type MockStudent } from "@/lib/mockData";

const STUDY_MODES = [
  { id: "notes", icon: FileText, label: "Notes", desc: "Structured AI-written notes" },
  { id: "flashcards", icon: Layers, label: "Flashcards", desc: "Spaced repetition deck" },
  { id: "podcast", icon: Volume2, label: "Audio", desc: "Narrated audio summary" },
  { id: "visual", icon: Network, label: "Mind Map", desc: "Interactive knowledge graph" },
] as const;

function StudentRow({ student }: { student: MockStudent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#1d1d1f]/8 bg-white/60 backdrop-blur-sm transition-all duration-300">
      {/* Row header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/40"
      >
        {/* Avatar */}
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
          style={{ backgroundColor: student.color }}
        >
          {student.initials}
        </div>

        {/* Name + last active */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[#1d1d1f]">{student.name}</p>
          <p className="text-[12px] text-[#86868b]">Active {student.lastActive}</p>
        </div>

        {/* Progress bar */}
        <div className="hidden w-32 sm:block">
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="text-[#6e6e73]">Progress</span>
            <span className="font-semibold text-[#1d1d1f]">{student.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1d1d1f]/8">
            <div
              className="h-full rounded-full bg-[#0066cc] transition-all duration-700"
              style={{ width: `${student.progress}%` }}
            />
          </div>
        </div>

        {/* Quiz score badge */}
        <div className="hidden items-center gap-1.5 md:flex">
          <div className="rounded-full border border-[#1d1d1f]/10 bg-white/70 px-3 py-1 text-[12px] font-medium text-[#424245]">
            {student.quizAttempts === 0
              ? "No attempts"
              : `${student.bestScore}/${student.totalQuestions} best`}
          </div>
        </div>

        {/* Expand icon */}
        <div className="text-[#86868b]">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-[#1d1d1f]/6 px-5 pb-5 pt-4">
          {/* AI Summary */}
          <div className="mb-4 rounded-[16px] border border-[#0066cc]/12 bg-[#0066cc]/4 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Brain className="size-3.5 text-[#0066cc]" strokeWidth={1.8} />
              <span className="text-[12px] font-semibold text-[#0066cc]">AI Progress Summary</span>
            </div>
            <p className="text-[14px] leading-6 text-[#424245]">{student.aiSummary}</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[14px] border border-[#1d1d1f]/8 bg-white/50 p-3 text-center">
              <Clock className="mx-auto mb-1 size-4 text-[#6e6e73]" strokeWidth={1.8} />
              <p className="text-[14px] font-semibold">{student.timeSpent}</p>
              <p className="text-[11px] text-[#86868b]">time spent</p>
            </div>
            <div className="rounded-[14px] border border-[#1d1d1f]/8 bg-white/50 p-3 text-center">
              <TrendingUp className="mx-auto mb-1 size-4 text-[#6e6e73]" strokeWidth={1.8} />
              <p className="text-[14px] font-semibold">{student.quizAttempts}</p>
              <p className="text-[11px] text-[#86868b]">quiz attempts</p>
            </div>
            <div className="rounded-[14px] border border-[#1d1d1f]/8 bg-white/50 p-3 text-center">
              <BarChart2 className="mx-auto mb-1 size-4 text-[#6e6e73]" strokeWidth={1.8} />
              <p className="text-[14px] font-semibold">{student.progress}%</p>
              <p className="text-[11px] text-[#86868b]">completion</p>
            </div>
            <div className="rounded-[14px] border border-[#1d1d1f]/8 bg-white/50 p-3 text-center">
              <Layers className="mx-auto mb-1 size-4 text-[#6e6e73]" strokeWidth={1.8} />
              <p className="text-[14px] font-semibold">{student.mostUsedMode}</p>
              <p className="text-[11px] text-[#86868b]">top mode</p>
            </div>
          </div>

          {/* Weak/Strong topics */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] border border-[#1d1d1f]/8 bg-white/50 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#10b981]">Strong topics</p>
              {student.strongTopics.length === 0 ? (
                <p className="text-[13px] text-[#86868b]">None identified yet</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {student.strongTopics.map((t) => (
                    <span key={t} className="rounded-full border border-[#10b981]/20 bg-[#10b981]/8 px-2.5 py-0.5 text-[12px] text-[#065f46]">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-[14px] border border-[#1d1d1f]/8 bg-white/50 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#ef4444]">Weak topics</p>
              <div className="flex flex-wrap gap-1.5">
                {student.weakTopics.map((t) => (
                  <span key={t} className="rounded-full border border-[#ef4444]/20 bg-[#ef4444]/8 px-2.5 py-0.5 text-[12px] text-[#991b1b]">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState<"classroom" | "students">("classroom");
  const [enabledModes, setEnabledModes] = useState<string[]>(["notes", "flashcards", "podcast", "visual"]);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; type: string }[]>([
    { name: "Ch12_Photosynthesis.pdf", type: "application/pdf" },
    { name: "LectureNotes_Week5.pdf", type: "application/pdf" },
    { name: "BiologyLecture.mp3", type: "audio/mpeg" },
  ]);
  const [isDragging, setIsDragging] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [published, setPublished] = useState(true);
  const [topic, setTopic] = useState("Photosynthesis & the Light-Dependent Reactions");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Automatically provision the demo class in the backend so students can join it
    teacherApi.createClass("teacher-001", MOCK_CLASS.name, MOCK_CLASS.subject, [topic], MOCK_CLASS.code).catch(() => {});
  }, [topic]);

  const handlePublish = async () => {
    setPublished((v) => !v);
    if (!published) {
      // Trigger material generation (flashcards, notes, podcast) for the student!
      studentApi.generateMaterials("demo-student-001", [topic]).catch(console.error);
    }
  };

  const toggleMode = (id: string) => {
    setEnabledModes((prev) =>
      prev.includes(id) && prev.length > 1 ? prev.filter((m) => m !== id) : prev.includes(id) ? prev : [...prev, id]
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    setAttachedFiles((prev) => [...prev, ...files.map((f) => ({ name: f.name, type: f.type }))]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setAttachedFiles((prev) => [...prev, ...files.map((f) => ({ name: f.name, type: f.type }))]);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(MOCK_CLASS.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  };

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
      onDrop={handleDrop}
    >
      <div className="pointer-events-none absolute inset-0 liquid-canvas" />

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f5f5f7]/80 p-6 backdrop-blur-2xl">
          <div className="liquid-panel flex w-full max-w-md flex-col items-center px-8 py-10 text-center">
            <div className="mb-6 flex size-14 items-center justify-center rounded-[18px] border border-white/80 bg-white/70 text-[#0066cc]">
              <Paperclip className="size-6" strokeWidth={1.8} />
            </div>
            <h2 className="text-[28px] font-semibold">Drop files here</h2>
            <p className="mt-3 text-[15px] text-[#6e6e73]">PDFs, audio, video, or images</p>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />

      {/* ── Top nav ───────────────────────────────────────────── */}
      <header className="relative z-10 border-b border-[#1d1d1f]/8 bg-white/60 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full border border-[#0066cc]/18 bg-[#0066cc]/8 text-[#0066cc]">
              <Zap className="size-3.5" strokeWidth={2} />
            </div>
            <span className="text-[17px] font-semibold tracking-[-0.025em]">Synapse</span>
          </Link>

          <nav className="flex items-center gap-1">
            {(["classroom", "students"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium capitalize transition-all duration-150",
                  activeTab === tab
                    ? "bg-[#1d1d1f] text-white"
                    : "text-[#6e6e73] hover:text-[#1d1d1f]"
                )}
              >
                {tab === "classroom" ? <BookOpenText className="size-3.5" strokeWidth={1.8} /> : <Users className="size-3.5" strokeWidth={1.8} />}
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Class code pill */}
            <button
              onClick={copyCode}
              className="flex items-center gap-2 rounded-full border border-[#1d1d1f]/10 bg-white/70 px-3 py-1.5 text-[13px] font-medium text-[#424245] transition hover:bg-white active:scale-[0.97]"
            >
              <span className="font-mono text-[#0066cc]">{MOCK_CLASS.code}</span>
              {codeCopied ? <Check className="size-3.5 text-[#10b981]" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
            </button>
            <div className="flex size-8 items-center justify-center rounded-full border border-[#0066cc]/20 bg-[#0066cc]/10 text-[13px] font-semibold text-[#0066cc]">
              SC
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto max-w-[1440px] px-4 py-8 sm:px-6">

        {/* ── CLASSROOM TAB ────────────────────────────────── */}
        {activeTab === "classroom" && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Left — info */}
            <div className="space-y-5">
              <div className="px-2">
                <p className="text-[13px] font-medium text-[#6e6e73]">{MOCK_CLASS.subject}</p>
                <h1 className="mt-1 text-[36px] font-semibold leading-[1.05] tracking-[-0.025em]">{MOCK_CLASS.name}</h1>
                <p className="mt-2 text-[17px] text-[#6e6e73]">Dr. Sarah Chen</p>
              </div>

              {/* Class stats */}
              <div className="grid grid-cols-3 divide-x divide-[#1d1d1f]/10 overflow-hidden rounded-[22px] border border-white/70 bg-white/45 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
                <div className="px-4 py-4">
                  <div className="text-2xl font-semibold">{MOCK_STUDENTS.length}</div>
                  <div className="mt-1 text-xs text-[#6e6e73]">students</div>
                </div>
                <div className="px-4 py-4">
                  <div className="text-2xl font-semibold">{MOCK_CLASS_STATS.avgProgress}%</div>
                  <div className="mt-1 text-xs text-[#6e6e73]">avg progress</div>
                </div>
                <div className="px-4 py-4">
                  <div className="text-2xl font-semibold">{MOCK_CLASS_STATS.activeToday}</div>
                  <div className="mt-1 text-xs text-[#6e6e73]">active today</div>
                </div>
              </div>

              {/* Study modes */}
              <div className="rounded-[24px] border border-white/70 bg-white/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold">Study modes for students</h3>
                  <span className="text-[12px] text-[#86868b]">{enabledModes.length} enabled</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STUDY_MODES.map((mode) => {
                    const on = enabledModes.includes(mode.id);
                    return (
                      <button
                        key={mode.id}
                        onClick={() => toggleMode(mode.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-[16px] border px-3 py-3 text-left transition-all duration-150 active:scale-[0.97]",
                          on
                            ? "border-[#0066cc]/30 bg-[#0066cc]/8 text-[#1d1d1f]"
                            : "border-[#1d1d1f]/10 bg-white/50 text-[#6e6e73]"
                        )}
                      >
                        <mode.icon className={cn("size-4 shrink-0", on ? "text-[#0066cc]" : "text-[#86868b]")} strokeWidth={1.8} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-tight">{mode.label}</p>
                          <p className="text-[11px] text-[#86868b] leading-tight">{mode.desc}</p>
                        </div>
                        <div className={cn("ml-auto size-4 shrink-0 rounded-full border-2 transition-colors", on ? "border-[#0066cc] bg-[#0066cc]" : "border-[#1d1d1f]/20 bg-transparent")}>
                          {on && <Check className="size-3 text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[12px] text-[#86868b]">
                  The quiz is always available to students separately — it's not a study mode.
                </p>
              </div>
            </div>

            {/* Right — upload widget (mirrors original hero) */}
            <div className="liquid-shell relative overflow-hidden rounded-[34px] p-3 sm:p-4">
              <div className="rounded-[26px] border border-white/70 bg-[#fbfbfd]/76 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-2xl">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-[#6e6e73]">Classroom materials</p>
                    <h2 className="mt-1 text-[26px] font-semibold leading-none">Upload content</h2>
                  </div>
                  <div className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                    published ? "border-[#10b981]/30 bg-[#10b981]/8 text-[#065f46]" : "border-[#1d1d1f]/10 bg-white/70 text-[#424245]"
                  )}>
                    {published ? "Published" : "Draft"}
                  </div>
                </div>

                {/* Topic input */}
                <div className="mb-4 rounded-[18px] border border-[#1d1d1f]/10 bg-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,1)] transition focus-within:border-[#0066cc]/45 focus-within:ring-4 focus-within:ring-[#0066cc]/10">
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="What is this class about?"
                    className="h-12 w-full bg-transparent px-4 text-[17px] text-[#1d1d1f] outline-none placeholder:text-[#86868b]"
                  />
                </div>

                {/* Files list */}
                <div className="mb-4 space-y-2">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 rounded-[14px] border border-[#1d1d1f]/8 bg-white/70 px-3 py-2.5">
                      <FileText className="size-3.5 shrink-0 text-[#0066cc]" strokeWidth={1.8} />
                      <span className="flex-1 truncate text-[13px] text-[#424245]">{file.name}</span>
                      <button
                        onClick={() => setAttachedFiles((p) => p.filter((_, i) => i !== idx))}
                        className="rounded-full p-0.5 text-[#86868b] transition hover:text-[#1d1d1f]"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Bottom bar */}
                <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#1d1d1f]/10 bg-white/56 p-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex size-10 items-center justify-center rounded-[14px] text-[#6e6e73] transition hover:bg-white hover:text-[#0066cc]"
                      title="Attach PDF or doc"
                    >
                      <Paperclip className="size-4" strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex size-10 items-center justify-center rounded-[14px] text-[#6e6e73] transition hover:bg-white hover:text-[#0066cc]"
                      title="Add audio"
                    >
                      <Mic className="size-4" strokeWidth={1.8} />
                    </button>
                  </div>
                  <button
                    onClick={handlePublish}
                    className="flex h-10 items-center gap-2 rounded-full bg-[#0066cc] px-5 text-[14px] font-medium text-white transition-all duration-150 hover:bg-[#0071e3] active:scale-[0.97]"
                  >
                    <Sparkles className="size-3.5" strokeWidth={1.8} />
                    {published ? "Republish" : "Publish to students"}
                  </button>
                </div>

                {/* Class code display */}
                <div className="mt-4 flex items-center justify-between rounded-[16px] border border-[#1d1d1f]/8 bg-white/50 px-4 py-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">Student class code</p>
                    <p className="mt-0.5 font-mono text-[22px] font-semibold tracking-wider text-[#0066cc]">{MOCK_CLASS.code}</p>
                  </div>
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1.5 rounded-full border border-[#1d1d1f]/10 bg-white/70 px-3 py-1.5 text-[13px] font-medium text-[#424245] transition hover:bg-white active:scale-[0.97]"
                  >
                    {codeCopied ? <Check className="size-3.5 text-[#10b981]" /> : <Copy className="size-3.5" />}
                    {codeCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STUDENTS TAB ─────────────────────────────────── */}
        {activeTab === "students" && (
          <div>
            {/* Class-level stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Avg progress", value: `${MOCK_CLASS_STATS.avgProgress}%`, icon: BarChart2 },
                { label: "Avg quiz score", value: `${MOCK_CLASS_STATS.avgQuizScore}/10`, icon: TrendingUp },
                { label: "Most used mode", value: MOCK_CLASS_STATS.mostUsedMode, icon: Layers },
                { label: "Active today", value: `${MOCK_CLASS_STATS.activeToday} / ${MOCK_STUDENTS.length}`, icon: Users },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[20px] border border-white/70 bg-white/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
                  <stat.icon className="mb-2 size-4 text-[#0066cc]" strokeWidth={1.8} />
                  <p className="text-[22px] font-semibold">{stat.value}</p>
                  <p className="text-[12px] text-[#6e6e73]">{stat.label}</p>
                </div>
              ))}
            </div>

            <h2 className="mb-4 text-[20px] font-semibold tracking-[-0.015em]">
              {MOCK_CLASS.name} · {MOCK_STUDENTS.length} students
            </h2>

            <div className="space-y-3">
              {MOCK_STUDENTS.map((s, i) => (
                <div
                  key={s.id}
                  className="synapse-stagger"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <StudentRow student={s} />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
