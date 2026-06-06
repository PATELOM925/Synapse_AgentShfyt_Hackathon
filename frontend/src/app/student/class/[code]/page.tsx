"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpenText, ChevronRight, FileText, Layers,
  Network, Volume2, Zap, CheckSquare, RotateCcw, Send, Trophy, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { studentApi, type SmartNotes, type Flashcard, type LearningProfile } from "@/lib/synapseApi";

const DEMO_STUDENT_ID = "demo-student-001";
const getStudentId = () =>
  (typeof window !== "undefined" && localStorage.getItem("synapse_student_id")) || DEMO_STUDENT_ID;

type Mode = "notes" | "flashcards" | "podcast" | "visual";

const MODES: { id: Mode; icon: typeof FileText; label: string; color: string }[] = [
  { id: "notes",      icon: FileText,  label: "Smart Notes",  color: "#0066cc" },
  { id: "flashcards", icon: Layers,    label: "Flashcards",   color: "#8b5cf6" },
  { id: "podcast",    icon: Volume2,   label: "Audio",        color: "#10b981" },
  { id: "visual",     icon: Network,   label: "Mind Map",     color: "#f59e0b" },
];

// ── Markdown notes renderer ──────────────────────────────────────────────────
function NotesView({ notes }: { notes: SmartNotes | null; loading: boolean }) {
  if (!notes) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-3 size-10 animate-spin rounded-full border-2 border-[#0066cc]/20 border-t-[#0066cc]" />
      <p className="text-[14px] text-[#6e6e73]">Generating smart notes…</p>
    </div>
  );
  return (
    <div className="prose prose-sm max-w-none text-[#1d1d1f]">
      {notes.summary && <p className="text-[15px] leading-7 text-[#424245] mb-4 italic">{notes.summary}</p>}
      {notes.sections.map((sec, i) => (
        <div key={i}>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] mt-6 mb-3">{sec.heading}</h2>
          {sec.content.split("\n").map((line, j) => {
            if (line.startsWith("- ")) return <li key={j} className="ml-4 text-[15px] leading-7 text-[#424245] list-disc">{line.slice(2)}</li>;
            if (!line.trim()) return <div key={j} className="h-2" />;
            return <p key={j} className="text-[15px] leading-7 text-[#424245]">{line}</p>;
          })}
        </div>
      ))}
      {notes.key_concepts.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {notes.key_concepts.map((c, i) => (
            <span key={i} className="rounded-full border border-[#0066cc]/20 bg-[#0066cc]/6 px-3 py-1 text-[12px] text-[#0066cc]">{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Flashcards view ──────────────────────────────────────────────────────────
function FlashcardsView({ cards, loading }: { cards: Flashcard[]; loading: boolean }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setFlipped(p => { const s = new Set(p); s.has(i) ? s.delete(i) : s.add(i); return s; });

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-3 size-10 animate-spin rounded-full border-2 border-[#8b5cf6]/20 border-t-[#8b5cf6]" />
      <p className="text-[14px] text-[#6e6e73]">Generating flashcards…</p>
    </div>
  );
  if (!cards.length) return <p className="text-[15px] text-[#6e6e73] py-12 text-center">No flashcards yet. Chat with Synapse to generate them.</p>;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((card, i) => (
        <button
          key={i}
          onClick={() => toggle(i)}
          className="group relative h-44 w-full cursor-pointer [perspective:1000px] text-left"
        >
          <div className={cn(
            "absolute inset-0 w-full h-full transition-transform duration-500 [transform-style:preserve-3d]",
            flipped.has(i) ? "[transform:rotateY(180deg)]" : ""
          )}>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[20px] border border-[#1d1d1f]/10 bg-white p-5 text-center [backface-visibility:hidden]">
              <p className="font-medium text-[15px] text-[#1d1d1f] leading-6">{card.front}</p>
              <span className="absolute bottom-3 right-4 text-[11px] text-[#86868b]">tap to reveal</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center rounded-[20px] border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 p-5 text-center [transform:rotateY(180deg)] [backface-visibility:hidden]">
              <p className="text-[14px] font-medium text-[#1d1d1f] leading-6">{card.back}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Comprehension check popup ────────────────────────────────────────────────
function CheckPopup({ check, onDismiss }: { check: { question: string; hint: string }; onDismiss: () => void }) {
  return (
    <div className="my-3 rounded-[16px] border border-[#f59e0b]/30 bg-[#f59e0b]/8 p-4">
      <p className="text-[13px] font-semibold text-[#92400e] mb-1">Quick Check</p>
      <p className="text-[14px] text-[#1d1d1f] leading-6">{check.question}</p>
      {check.hint && <p className="mt-1 text-[12px] text-[#6e6e73]">Hint: {check.hint}</p>}
      <button onClick={onDismiss} className="mt-2 text-[12px] text-[#0066cc] hover:underline">Got it</button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function StudentClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const studentId = useRef(getStudentId());

  const [activeMode, setActiveMode] = useState<Mode>("notes");
  const [chatInput, setChatInput] = useState("");
  const [studyStarted, setStudyStarted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentTopic, setCurrentTopic] = useState("");
  const [classInfo, setClassInfo] = useState<{ name: string; topics: string[] } | null>(null);
  const [learningProfile] = useState<LearningProfile>({ modality: "text", pace: "methodical" });

  // Content state
  const [notes, setNotes] = useState<SmartNotes | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string; check?: { question: string; hint: string } }[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load class info on mount
  useEffect(() => {
    studentApi.getTopics(code)
      .then(r => setClassInfo({ name: code, topics: r.topics }))
      .catch(() => setClassInfo({ name: code, topics: [] }));
  }, [code]);

  // Auto-scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, generating]);

  // Generate materials in parallel via scatter pipeline
  const triggerMaterialGeneration = useCallback(async (topic: string) => {
    setNotesLoading(true);
    setFlashcardsLoading(true);

    // Fire scatter pipeline (notes + flashcards in parallel via ScatterAgent)
    studentApi.generateMaterials(studentId.current, [topic]).catch(console.error);

    // Also fetch individually so we get typed responses for display
    studentApi.generateNotes(studentId.current, topic)
      .then(n => { setNotes(n); setNotesLoading(false); })
      .catch(() => setNotesLoading(false));

    studentApi.generateFlashcards(studentId.current, topic)
      .then(r => { setFlashcards(r.flashcards); setFlashcardsLoading(false); })
      .catch(() => setFlashcardsLoading(false));
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? chatInput).trim();
    if (!msg || generating) return;
    setChatInput("");

    const topic = currentTopic || msg;
    if (!currentTopic) setCurrentTopic(topic);

    setChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setGenerating(true);

    // Abort previous stream
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let fullText = "";
    try {
      for await (const event of studentApi.tutorStreamFetch(
        studentId.current, topic, msg, learningProfile, ctrl.signal
      )) {
        if (event.type === "start") {
          if (!studyStarted) {
            setStudyStarted(true);
            // Kick off parallel material generation
            triggerMaterialGeneration(topic);
          }
        } else if (event.type === "content") {
          fullText += event.content as string;
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "ai" && !last.check) {
              return [...prev.slice(0, -1), { role: "ai", text: last.text + (event.content as string) }];
            }
            return [...prev, { role: "ai", text: event.content as string }];
          });
        } else if (event.type === "check") {
          const check = event.data as { question: string; hint: string };
          setChatMessages(prev => [...prev, { role: "ai", text: "", check }]);
        } else if (event.type === "done") {
          break;
        } else if (event.type === "error") {
          setChatMessages(prev => [...prev, { role: "ai", text: `⚠️ ${event.error}` }]);
          break;
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setChatMessages(prev => [...prev, { role: "ai", text: "Could not reach Synapse API. Is the backend running on port 8000?" }]);
      }
    } finally {
      setGenerating(false);
    }
  }, [chatInput, currentTopic, generating, learningProfile, studyStarted, triggerMaterialGeneration]);

  const suggestions = classInfo?.topics.slice(0, 4).map(t => `Explain ${t}`) ?? [
    "Give me a full overview",
    "Start from the basics",
    "Focus on the key concepts",
    "Quiz me after explaining",
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#1d1d1f]/8 bg-white/60 backdrop-blur-2xl">
        <div className="border-b border-[#1d1d1f]/8 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <div className="flex size-7 items-center justify-center rounded-full border border-[#0066cc]/18 bg-[#0066cc]/8 text-[#0066cc]">
              <Zap className="size-3" strokeWidth={2} />
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Synapse</span>
          </Link>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">{classInfo?.name ?? code}</p>
          <p className="text-[14px] font-semibold text-[#1d1d1f] mt-0.5">{currentTopic || "Choose a topic"}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {studyStarted && (
            <>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Study</p>
              <nav className="space-y-1">
                {MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setActiveMode(mode.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[14px] font-medium transition-all duration-150 active:scale-[0.98]",
                      activeMode === mode.id
                        ? "bg-[#0066cc]/10 text-[#0066cc]"
                        : "text-[#424245] hover:bg-[#1d1d1f]/5"
                    )}
                  >
                    <mode.icon
                      className="size-4 shrink-0"
                      style={{ color: activeMode === mode.id ? mode.color : "#86868b" }}
                      strokeWidth={1.8}
                    />
                    {mode.label}
                    {activeMode === mode.id && <ChevronRight className="ml-auto size-3.5 text-[#0066cc]" />}
                  </button>
                ))}
              </nav>

              <div className="mt-4 border-t border-[#1d1d1f]/8 pt-4">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Assessment</p>
                <Link
                  href={`/student/class/${code}/quiz?topic=${encodeURIComponent(currentTopic)}&student=${studentId.current}`}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-[#f59e0b]/20 bg-[#f59e0b]/6 px-3 py-2.5 text-left text-[14px] font-medium text-[#92400e] transition-all duration-150 hover:bg-[#f59e0b]/12 active:scale-[0.98]"
                >
                  <Trophy className="size-4 shrink-0 text-[#f59e0b]" strokeWidth={1.8} />
                  Take the quiz
                  <ChevronRight className="ml-auto size-3.5" />
                </Link>
              </div>
            </>
          )}

          {classInfo?.topics && classInfo.topics.length > 0 && (
            <div className="mt-4 border-t border-[#1d1d1f]/8 pt-4">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Topics</p>
              {classInfo.topics.map((t) => (
                <button
                  key={t}
                  onClick={() => handleSend(`Teach me about: ${t}`)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13px] transition-all hover:bg-[#1d1d1f]/5",
                    currentTopic === t ? "font-semibold text-[#0066cc]" : "text-[#424245]"
                  )}
                >
                  <BookOpenText className="size-3.5 shrink-0 text-[#86868b]" strokeWidth={1.8} />
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-14 items-center justify-between border-b border-[#1d1d1f]/8 bg-white/50 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold">
              {studyStarted ? MODES.find(m => m.id === activeMode)?.label : "Chat with Synapse"}
            </span>
            <span className="rounded-full border border-[#1d1d1f]/10 bg-[#f5f5f7] px-2 py-0.5 text-[12px] text-[#6e6e73]">{code}</span>
          </div>
          <Link href="/student" className="flex items-center gap-1.5 rounded-full border border-[#1d1d1f]/10 bg-white/60 px-3 py-1.5 text-[12px] text-[#6e6e73] transition hover:text-[#1d1d1f]">
            <X className="size-3" strokeWidth={2} />
            Leave
          </Link>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {!studyStarted ? (
            /* Pre-study: full chat */
            <div className="flex flex-1 flex-col">
              <div ref={chatRef} className="flex-1 overflow-y-auto px-6 py-8">
                <div className="mx-auto max-w-xl">
                  <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-[#0066cc]/20 bg-[#0066cc]/8">
                      <Zap className="size-6 text-[#0066cc]" strokeWidth={2} />
                    </div>
                    <h2 className="text-[26px] font-semibold tracking-[-0.025em]">What do you want to learn?</h2>
                    <p className="mt-2 text-[15px] text-[#6e6e73]">Tell me what to focus on and I&apos;ll build your study guide from your course materials.</p>
                  </div>

                  <div className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => handleSend(s)} className="rounded-[16px] border border-[#1d1d1f]/10 bg-white/70 px-4 py-3 text-left text-[14px] text-[#424245] backdrop-blur-sm transition-all duration-150 hover:border-[#0066cc]/25 hover:bg-white hover:text-[#1d1d1f] active:scale-[0.98]">
                        {s}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 mb-4">
                    {chatMessages.map((m, i) => (
                      <div key={i} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                        {m.role === "ai" && !m.check && (
                          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0066cc]/10">
                            <Zap className="size-3.5 text-[#0066cc]" strokeWidth={2} />
                          </div>
                        )}
                        {m.check ? (
                          <CheckPopup check={m.check} onDismiss={() => setChatMessages(prev => prev.filter((_, j) => j !== i))} />
                        ) : (
                          <div className={cn("max-w-[80%] rounded-[16px] px-4 py-3 text-[14px] leading-6", m.role === "ai" ? "rounded-tl-sm bg-white border border-[#1d1d1f]/8 text-[#424245]" : "rounded-tr-sm bg-[#0066cc] text-white")}>
                            {m.text}
                          </div>
                        )}
                      </div>
                    ))}
                    {generating && (
                      <div className="flex gap-3">
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0066cc]/10"><Zap className="size-3.5 text-[#0066cc]" strokeWidth={2} /></div>
                        <div className="flex items-center gap-1.5 rounded-[16px] rounded-tl-sm border border-[#1d1d1f]/8 bg-white px-4 py-3">
                          {[0,1,2].map(j => <div key={j} className="size-1.5 animate-bounce rounded-full bg-[#0066cc]/40" style={{ animationDelay: `${j*120}ms` }} />)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-[#1d1d1f]/8 bg-white/60 p-4 backdrop-blur-xl">
                <div className="mx-auto flex max-w-xl items-center gap-2 rounded-[20px] border border-[#1d1d1f]/10 bg-white/90 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,1)] transition focus-within:border-[#0066cc]/40 focus-within:ring-4 focus-within:ring-[#0066cc]/8">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Ask Synapse anything…" className="flex-1 bg-transparent px-3 text-[15px] text-[#1d1d1f] outline-none placeholder:text-[#86868b]" />
                  <button onClick={() => handleSend()} disabled={!chatInput.trim() || generating} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0066cc] text-white transition-all duration-150 hover:bg-[#0071e3] active:scale-[0.97] disabled:opacity-40">
                    <Send className="size-4" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Post-study: content + chat strip */
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="mx-auto max-w-3xl">
                  {activeMode === "notes" && <NotesView notes={notes} loading={notesLoading} />}
                  {activeMode === "flashcards" && <FlashcardsView cards={flashcards} loading={flashcardsLoading} />}
                  {activeMode === "podcast" && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-6 flex size-20 items-center justify-center rounded-full border border-[#10b981]/20 bg-[#10b981]/8">
                        <Volume2 className="size-9 text-[#10b981]" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Audio Summary</h3>
                      <p className="mt-2 mb-6 max-w-[32ch] text-[15px] text-[#6e6e73]">Listen to the AI-generated podcast summary.</p>
                      <audio 
                        controls 
                        src={`/audio/${currentTopic.replace(/ /g, '_').toLowerCase()}.mp3`}
                        className="w-full max-w-md"
                      >
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                  {activeMode === "visual" && (
                    <div>
                      <h3 className="mb-4 text-[20px] font-semibold tracking-[-0.02em]">Knowledge Map</h3>
                      <p className="text-[14px] text-[#6e6e73]">Visual knowledge map for {currentTopic}.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Compact chat strip */}
              <div className="flex w-72 shrink-0 flex-col border-l border-[#1d1d1f]/8 bg-white/50 backdrop-blur-xl">
                <div className="border-b border-[#1d1d1f]/8 px-4 py-3">
                  <p className="text-[13px] font-semibold">Ask Synapse</p>
                  <p className="text-[11px] text-[#86868b]">Refine your study guide</p>
                </div>
                <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={cn("flex gap-2", m.role === "user" && "justify-end")}>
                      {m.role === "ai" && !m.check && (
                        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0066cc]/10">
                          <Zap className="size-2.5 text-[#0066cc]" strokeWidth={2} />
                        </div>
                      )}
                      {m.check ? (
                        <CheckPopup check={m.check} onDismiss={() => setChatMessages(prev => prev.filter((_, j) => j !== i))} />
                      ) : (
                        <p className={cn("max-w-[85%] rounded-[12px] px-3 py-2 text-[12px] leading-5", m.role === "ai" ? "rounded-tl-sm bg-white border border-[#1d1d1f]/8 text-[#424245]" : "rounded-tr-sm bg-[#0066cc] text-white")}>
                          {m.text}
                        </p>
                      )}
                    </div>
                  ))}
                  {generating && (
                    <div className="flex gap-2">
                      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0066cc]/10"><Zap className="size-2.5 text-[#0066cc]" strokeWidth={2} /></div>
                      <div className="flex items-center gap-1 rounded-[12px] rounded-tl-sm border border-[#1d1d1f]/8 bg-white px-3 py-2">
                        {[0,1,2].map(j => <div key={j} className="size-1 animate-bounce rounded-full bg-[#0066cc]/40" style={{ animationDelay: `${j*120}ms` }} />)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-[#1d1d1f]/8 p-2">
                  <div className="flex items-center gap-2 rounded-[14px] border border-[#1d1d1f]/10 bg-white/90 p-1.5">
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Follow-up…" className="flex-1 bg-transparent px-2 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#86868b]" />
                    <button onClick={() => handleSend()} disabled={!chatInput.trim() || generating} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0066cc] text-white disabled:opacity-40">
                      <Send className="size-3" strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
