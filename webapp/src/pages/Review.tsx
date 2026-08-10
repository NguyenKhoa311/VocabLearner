import { useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Loader2, Volume2, AlertTriangle, Lightbulb, Clock, Folder, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWords, type WordData } from '../context/WordContext';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

type StudyMode = 'idle' | 'srs' | 'cram';

export default function Review() {
  const { words: allWords, loading } = useWords();
  const [studyList, setStudyList] = useState<WordData[]>([]);
  const [mode, setMode] = useState<StudyMode>('idle');
  const { width, height } = useWindowSize();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [previewTopic, setPreviewTopic] = useState<string | null>(null);
  const [isWrongShake, setIsWrongShake] = useState(false);



  const startSrsMode = () => {
    const now = Date.now();
    const due = allWords.filter(w => !w.nextReviewDate || w.nextReviewDate <= now);
    setStudyList(due);
    setMode('srs');
    setCurrentIndex(0);
    setSessionComplete(false);
    setIsRevealed(false);
    setInputValue('');
    setHintLevel(0);
  };

  const startCramMode = (topic: string) => {
    const topicWords = allWords.filter(w => (w.topic || 'Uncategorized') === topic);
    setStudyList(topicWords);
    setMode('cram');
    setCurrentIndex(0);
    setSessionComplete(false);
    setIsRevealed(false);
    setInputValue('');
    setHintLevel(0);
    setPreviewTopic(null);
  };

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const handleCheckAnswer = () => {
    const currentWord = studyList[currentIndex].word.toLowerCase();
    if (inputValue.toLowerCase().trim() === currentWord) {
      setIsRevealed(true);
      playAudio(studyList[currentIndex].word);
    } else {
      setIsWrongShake(true);
      setTimeout(() => setIsWrongShake(false), 400);
    }
  };

  const handleDontKnow = () => {
    setInputValue('');
    setIsRevealed(true);
  };

  const handleRate = async (quality: number) => {
    const currentWord = studyList[currentIndex];
    
    // Only update Firebase if we are in SRS mode
    if (mode === 'srs') {
      let interval = currentWord.interval || 0;
      let repetition = currentWord.repetition || 0;
      let easeFactor = currentWord.easeFactor || 2.5;

      if (quality < 3) {
        repetition = 0;
        interval = 1;
      } else {
        if (repetition === 0) {
          interval = 1;
        } else if (repetition === 1) {
          interval = 6;
        } else {
          interval = Math.round(interval * easeFactor);
        }
        repetition += 1;
      }

      easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (easeFactor < 1.3) easeFactor = 1.3;

      const nextReviewDate = Date.now() + interval * 24 * 60 * 60 * 1000;
      const srsLevel = repetition;

      try {
        const wordRef = doc(db, 'words', currentWord.id);
        await updateDoc(wordRef, {
          interval,
          repetition,
          easeFactor,
          nextReviewDate,
          srsLevel
        });
      } catch (error) {
        console.error("Error updating SRS data:", error);
      }
    }

    // Move to next word
    setIsRevealed(false);
    setInputValue('');
    setHintLevel(0);
    
    if (currentIndex + 1 < studyList.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSessionComplete(true);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-slate-400">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (mode === 'idle') {
    const now = Date.now();
    const dueWordsCount = allWords.filter(w => !w.nextReviewDate || w.nextReviewDate <= now).length;
    
    let nextReviewText = "";
    if (allWords.length > 0) {
      const futureWords = allWords.filter(w => w.nextReviewDate && w.nextReviewDate > now);
      if (futureWords.length > 0) {
        const nextTime = Math.min(...futureWords.map(w => w.nextReviewDate!));
        const diffHours = (nextTime - now) / (1000 * 60 * 60);
        if (diffHours < 1) {
          nextReviewText = `Next review in ${Math.ceil(diffHours * 60)} minutes`;
        } else if (diffHours < 24) {
          nextReviewText = `Next review in ${Math.round(diffHours)} hours`;
        } else {
          nextReviewText = `Next review in ${Math.round(diffHours / 24)} days`;
        }
      }
    }
    
    const groupedTopics = allWords.reduce((acc, word) => {
      const t = word.topic || 'Uncategorized';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="max-w-5xl mx-auto py-8">
        <div className="mb-12">
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">Study Modes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Choose how you want to practice your vocabulary today.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* SRS Mode Card */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group h-full flex flex-col">
              <div className="absolute top-0 right-0 w-64 opacity-50 group-hover:scale-105 transition-transform translate-x-12 -translate-y-4">
                <img src="/review_lobby.png" alt="Rocket" className="w-full h-full object-contain mix-blend-screen" />
              </div>
              <div className="relative z-10 flex-1">
                <h2 className="text-2xl font-bold mb-2">Daily Review</h2>
                <p className="text-blue-100 mb-8 leading-relaxed">Spaced Repetition System. Only practice words that are due for review to optimize your memory retention.</p>
                
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 inline-flex flex-col items-center justify-center min-w-[120px]">
                  <span className="text-4xl font-bold">{dueWordsCount}</span>
                  <span className="text-blue-100 text-sm font-medium mt-1">Cards Due</span>
                </div>
                
                {nextReviewText && (
                  <div className="mt-4 text-blue-200 text-sm font-medium">
                    <Clock size={14} className="inline mr-1 mb-0.5" />
                    {nextReviewText}
                  </div>
                )}
              </div>
              
              <button 
                onClick={startSrsMode}
                disabled={dueWordsCount === 0}
                className="w-full mt-8 bg-white text-blue-600 font-bold py-4 rounded-xl shadow-sm hover:shadow-md hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed z-10"
              >
                {dueWordsCount > 0 ? 'Start Review' : 'All Caught Up!'}
              </button>
            </div>
          </div>

          {/* Topics Cram Mode */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-[#1e2235] border border-slate-200 dark:border-[#2d3248] rounded-[2.5rem] p-8 shadow-sm h-full">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Practice by Topic</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Freestyle practice (Cram mode). Reviewing here won't affect your Spaced Repetition schedule.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(groupedTopics).map(([topic, count]) => (
                  <button
                    key={topic}
                    onClick={() => setPreviewTopic(topic)}
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-[#2d3248] hover:border-blue-200 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all group text-left shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#151822] text-slate-400 dark:text-slate-500 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex items-center justify-center transition-colors">
                        <Folder size={18} />
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{topic}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#151822] px-3 py-1 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Topic Preview Modal */}
        {previewTopic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewTopic(null)}>
            <div 
              className="bg-white dark:bg-[#1e2235] rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 dark:border-[#2d3248] flex justify-between items-center bg-slate-50 dark:bg-[#151822]">
                <div>
                  <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <Folder className="text-blue-500" /> {previewTopic}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Review {allWords.filter(w => (w.topic || 'Uncategorized') === previewTopic).length} words</p>
                </div>
                <button onClick={() => setPreviewTopic(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-white dark:bg-[#1e2235] rounded-full transition-colors border border-slate-200 dark:border-[#2d3248]">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-[#1e2235]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allWords.filter(w => (w.topic || 'Uncategorized') === previewTopic).map(w => (
                    <div key={w.id} className="p-3 border border-slate-100 dark:border-[#2d3248] rounded-xl bg-slate-50 dark:bg-[#151822] flex flex-col justify-center">
                      <span className="font-bold text-slate-800 dark:text-white">{w.word}</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400 line-clamp-1">{w.short_meaning_vi}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-[#2d3248] bg-white dark:bg-[#1e2235]">
                <button 
                  onClick={() => startCramMode(previewTopic)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-sm transition-all"
                >
                  Start Practice
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // --- REVIEW COMPLETE SCREEN ---
  if (sessionComplete || studyList.length === 0) {
    return (
      <div className="max-w-4xl mx-auto h-[80vh] flex flex-col items-center justify-center text-center">
        <Confetti width={width} height={height} recycle={false} numberOfPieces={400} gravity={0.15} />
        <div className="bg-white dark:bg-[#1e2235] p-12 rounded-[3rem] border border-slate-200 dark:border-[#2d3248] shadow-sm max-w-md w-full relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent dark:from-green-500/10 pointer-events-none"></div>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
          >
            <div className="w-24 h-24 bg-green-50 dark:bg-green-500/10 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-green-100 dark:border-green-500/20">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight relative z-10">Hoàn thành xuất sắc!</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg mb-8 font-medium relative z-10">Bạn đã ôn tập xong bộ thẻ này.</p>
          </motion.div>
          <button 
            onClick={() => setMode('idle')}
            className="w-full bg-slate-800 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors relative z-10"
          >
            Quay lại Sảnh chờ
          </button>
        </div>
      </div>
    );
  }

  // --- QUIZ SCREEN (DARK MODE) ---
  const word = studyList[currentIndex];
  const defEn = word.definition_en || word.definition;
  const defVi = word.definition_vi;
  const regex = new RegExp(word.word, 'gi');
  const maskedExample = word.example ? word.example.replace(regex, '*'.repeat(word.word.length)) : '';

  const maxLetterHints = Math.max(1, Math.floor(word.word.length / 2));
  
  const handleHint = () => {
    if (hintLevel <= maxLetterHints) {
      setHintLevel(prev => prev + 1);
    }
  };

  const getHintDisplay = () => {
    const w = word.word;
    const lettersToShow = Math.min(hintLevel, maxLetterHints);
    
    let revealed = new Set<number>();
    if (lettersToShow >= 1) revealed.add(0);
    if (lettersToShow >= 2 && w.length > 1) revealed.add(w.length - 1);
    
    let added = 2;
    let idx = 1;
    while (added < lettersToShow && idx < w.length - 1) {
      revealed.add(idx);
      added++;
      idx++;
    }
    
    return w.split('').map((c, i) => revealed.has(i) ? c : '*').join('');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#11131f] text-slate-200 p-8 font-sans -m-8 rounded-[2.5rem] border border-[#2d3248]/50 shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setMode('idle')} className="text-slate-400 hover:text-white transition-colors">
            ← Quay lại
          </button>
          <h1 className="text-2xl font-bold text-white tracking-wide">Ôn Tập {mode === 'srs' ? 'Tổng Hợp' : `Theo Chủ Đề: ${word.topic || 'Uncategorized'}`}</h1>
        </div>
        <div className="flex gap-2 text-sm text-blue-400 font-medium">
          <span>TIẾN ĐỘ</span>
          <span className="text-white">{currentIndex} / {studyList.length} THẺ</span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto h-2 bg-[#1f2336] rounded-full mb-8 overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${(currentIndex / studyList.length) * 100}%` }}
        />
      </div>

      {/* Main Card with AnimatePresence for transitions */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={word.id + isRevealed} // Force re-render/animation on word change OR reveal state change
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto bg-white/95 dark:bg-[#1e2235]/95 backdrop-blur-xl border border-slate-200 dark:border-[#2d3248] rounded-3xl p-8 relative shadow-2xl"
        >
          {mode === 'srs' && (
          <div className="absolute top-6 right-6 bg-[#dbeafe] text-blue-700 px-3 py-1 rounded-md text-sm font-bold">
            Đã ôn {word.repetition || 0} lần
          </div>
        )}
        <div className="absolute top-6 left-6 text-blue-400">
          <AlertTriangle size={20} />
        </div>

        <div className="text-center mt-4">
          <div className="flex flex-col items-center justify-center gap-3 mb-2">
            <h2 className={`font-bold text-blue-600 dark:text-blue-400 text-center ${word.type === 'sentence' ? 'text-2xl leading-relaxed' : 'text-4xl'}`}>
              {word.short_meaning_vi || word.word}
            </h2>
            <span className="bg-slate-100 dark:bg-[#2d3248] text-slate-600 dark:text-slate-300 px-3 py-1 rounded-lg text-sm border border-slate-200 dark:border-[#3e445b] font-medium">
              {word.type === 'sentence' ? 'Sentence' : word.type === 'collocation' ? 'Collocation' : (word.part_of_speech || "Từ vựng")}
            </span>
          </div>

          {isRevealed && word.phonetic && (
            <div className="flex items-center justify-center gap-4 text-slate-500 dark:text-[#8b92a5] mb-4">
              <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => playAudio(word.word)}>
                US: {word.phonetic} <Volume2 size={16} />
              </span>
            </div>
          )}

          <div className="mt-8 space-y-4">
            <div>
              <p className="text-slate-500 dark:text-[#5c739e] text-sm mb-1">Định nghĩa Tiếng Anh:</p>
              <p className="text-blue-600 dark:text-[#60a5fa] text-lg">{defEn}</p>
            </div>
            
            {defVi && (
              <div>
                <p className="text-slate-500 dark:text-[#5c739e] text-sm mb-1">Định nghĩa:</p>
                <p className="text-blue-600 dark:text-[#60a5fa] text-lg">{defVi}</p>
              </div>
            )}

            {word.example && (
              <div className="mt-6">
                <p className="text-slate-500 dark:text-[#5c739e] text-sm mb-2">Ví dụ:</p>
                {isRevealed ? (
                  <p className="text-slate-800 dark:text-white text-lg font-medium italic" dangerouslySetInnerHTML={{ __html: word.example.replace(regex, `<span class="text-green-600 dark:text-green-500 font-bold">${word.word}</span>`) }} />
                ) : (
                  <p className="text-slate-800 dark:text-white text-lg font-medium italic">
                    {maskedExample}
                  </p>
                )}
                {word.example_translation_vi && (
                  <p className="text-slate-500 dark:text-[#8b92a5] text-base mt-2 font-medium">
                    {word.example_translation_vi}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center">
          {!isRevealed ? (
            <div className="w-full max-w-lg flex flex-col items-center">
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="border border-dashed border-slate-300 dark:border-[#3e445b] bg-slate-50 dark:bg-[#1a1d2d] rounded-lg px-8 py-3 text-2xl tracking-widest text-slate-800 dark:text-white font-mono shadow-inner min-w-[120px] text-center">
                    {getHintDisplay()}
                  </div>
                  <button 
                    onClick={handleHint}
                    disabled={hintLevel > maxLetterHints}
                    className="flex items-center gap-2 border border-[#92400e] text-[#f59e0b] px-4 py-2 rounded-full hover:bg-[#92400e]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lightbulb size={18} /> Gợi ý
                  </button>
                </div>
                
                {/* Final Hint: Phonetic and Audio */}
                {hintLevel > maxLetterHints && word.phonetic && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-slate-50 dark:bg-[#1f2336] px-5 py-3 rounded-xl border border-slate-200 dark:border-[#2d3248]"
                  >
                    <span className="font-medium text-blue-600 dark:text-blue-300 tracking-wide">{word.phonetic}</span>
                    <button 
                      onClick={() => playAudio(word.word)}
                      className="text-white bg-blue-500 hover:bg-blue-600 p-2 rounded-full transition-colors flex items-center justify-center shadow-sm"
                      title="Nghe phát âm"
                    >
                      <Volume2 size={18} />
                    </button>
                  </motion.div>
                )}
              </div>

              <motion.input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckAnswer()}
                placeholder="Nhập từ tiếng Anh..."
                className={`w-full bg-slate-50 dark:bg-[#11131f] border rounded-xl px-4 py-4 text-center text-xl text-slate-800 dark:text-white outline-none transition-colors mb-6 shadow-sm focus:shadow-md ${isWrongShake ? 'border-red-500' : 'border-slate-300 dark:border-[#3e445b] focus:border-blue-500'}`}
                animate={isWrongShake ? { x: [-10, 10, -10, 10, 0] } : {}}
                transition={{ duration: 0.4 }}
                autoFocus
              />

              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button 
                  onClick={handleDontKnow}
                  className="flex-1 bg-[#ef4444] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
                >
                  KHÔNG BIẾT
                </button>
                <button 
                  onClick={handleCheckAnswer}
                  className="flex-1 bg-[#22c55e] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                >
                  KIỂM TRA ĐÁP ÁN
                </button>
              </div>
            </div>
          ) : (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="w-full max-w-lg flex flex-col items-center"
            >
              <div className="w-full border border-green-500 bg-green-500/10 rounded-xl px-4 py-4 text-center text-2xl text-green-500 font-bold mb-8 shadow-sm">
                {word.word}
              </div>
            </motion.div>
          )}
        </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer Stats */}
      <div className="max-w-lg mx-auto flex items-center justify-center gap-12 mt-8 mb-6">
        <div className="text-center">
          <p className="text-orange-500 font-bold text-xl">{studyList.length - currentIndex}</p>
          <p className="text-[#5c739e] text-sm">Còn lại</p>
        </div>
        <div className="text-center">
          <p className="text-green-500 font-bold text-xl">{currentIndex}</p>
          <p className="text-[#5c739e] text-sm">Đã Hoàn thành</p>
        </div>
        <div className="text-center">
          <p className="text-blue-400 font-bold text-xl">{studyList.length}</p>
          <p className="text-[#5c739e] text-sm">Tổng cộng</p>
        </div>
      </div>

      {/* Rating Buttons */}
      <AnimatePresence>
        {isRevealed && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <button onClick={() => handleRate(0)} className="py-4 px-2 rounded-xl bg-[#1f161c] text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/20 transition-all font-bold flex flex-col items-center">
              <span>HỌC LẠI</span>
              {mode === 'srs' && <span className="text-[12px] opacity-70 mt-1 font-normal text-[#8b92a5]">&lt; 1 phút</span>}
            </button>
            <button onClick={() => handleRate(2)} className="py-4 px-2 rounded-xl bg-[#2a1c18] text-[#f59e0b] border border-[#f59e0b]/30 hover:bg-[#f59e0b]/20 transition-all font-bold flex flex-col items-center">
              <span>KHÓ</span>
              {mode === 'srs' && <span className="text-[12px] opacity-70 mt-1 font-normal text-[#8b92a5]">1 ngày</span>}
            </button>
            <button onClick={() => handleRate(4)} className="py-4 px-2 rounded-xl bg-[#14231b] text-[#22c55e] border border-[#22c55e]/30 hover:bg-[#22c55e]/20 transition-all font-bold flex flex-col items-center">
              <span>TỐT</span>
              {mode === 'srs' && <span className="text-[12px] opacity-70 mt-1 font-normal text-[#8b92a5]">~ Vài ngày</span>}
            </button>
            <button onClick={() => handleRate(5)} className="py-4 px-2 rounded-xl bg-[#171d33] text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6]/20 transition-all font-bold flex flex-col items-center">
              <span>DỄ</span>
              {mode === 'srs' && <span className="text-[12px] opacity-70 mt-1 font-normal text-[#8b92a5]">~ Vài tuần</span>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
