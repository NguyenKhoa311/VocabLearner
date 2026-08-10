import { useState, useMemo, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Clock, Loader2, Volume2, Folder, ArrowLeft, Edit2, Trash2, CheckSquare, Square, Search, ChevronLeft, ChevronRight, X, Lightbulb } from 'lucide-react';
import { useWords, type WordData } from '../context/WordContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const getSrsBadge = (level: number) => {
    if (!level || level === 0) return { text: "Mới học", color: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#151822] dark:text-slate-400 dark:border-[#2d3248]" };
    if (level === 1 || level === 2) return { text: "Đang học", color: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-500/30" };
    if (level === 3 || level === 4) return { text: "Khá tốt", color: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-500/30" };
    return { text: "Thành thạo", color: "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-500/30" };
  };

  const { words, loading } = useWords();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [viewingWord, setViewingWord] = useState<WordData | null>(null);
  
  // Edit Word State
  const [isEditingWord, setIsEditingWord] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<WordData>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [refreshingAI, setRefreshingAI] = useState(false);

  // Search & Pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  const PREDEFINED_TOPICS = [
    "Technology", "Health & Science", "Business & Economy", "Education", 
    "Environment & Nature", "Daily Life", "Emotions & Psychology", 
    "Entertainment & Art", "Travel & Culture", "Sports", "Uncategorized"
  ];

  const updateWordTopic = async (wordId: string, newTopic: string) => {
    if (updating) return;
    setUpdating(true);
    try {
      const wordRef = doc(db, 'words', wordId);
      await updateDoc(wordRef, { topic: newTopic });
      setEditingTopicId(null);
    } catch (error) {
      console.error("Error updating topic:", error);
    } finally {
      setUpdating(false);
    }
  };

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const toggleWordSelection = (id: string) => {
    setSelectedWords(prev => 
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const toggleSelectAllInTopic = (topicWords: WordData[]) => {
    if (selectedWords.length === topicWords.length) {
      setSelectedWords([]);
    } else {
      setSelectedWords(topicWords.map(w => w.id));
    }
  };

  const handleDeleteSingle = async (wordId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Bạn có chắc chắn muốn xóa từ này không? Hành động này không thể hoàn tác.")) {
      try {
        setDeleting(true);
        await deleteDoc(doc(db, 'words', wordId));
        setSelectedWords(prev => prev.filter(id => id !== wordId));
      } catch (error) {
        console.error("Error deleting word:", error);
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedWords.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedWords.length} từ đã chọn?`)) return;
    
    setDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedWords.forEach(id => {
        batch.delete(doc(db, 'words', id));
      });
      await batch.commit();
      setSelectedWords([]);
    } catch (error) {
      console.error("Error deleting multiple words:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditWord = () => {
    setEditFormData({ ...viewingWord });
    setIsEditingWord(true);
  };

  const handleSaveEdit = async () => {
    if (!viewingWord) return;
    setSavingEdit(true);
    try {
      const wordRef = doc(db, 'words', viewingWord.id);
      await updateDoc(wordRef, editFormData);
      
      const updatedWord = { ...viewingWord, ...editFormData } as WordData;
      setViewingWord(updatedWord);
      setIsEditingWord(false);
    } catch (e) {
      console.error("Lỗi khi lưu thông tin:", e);
      alert("Lỗi khi lưu thông tin chỉnh sửa");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRefreshAI = async () => {
    if (!viewingWord) return;
    setRefreshingAI(true);
    try {
      const GEMINI_API_KEY_STRING = import.meta.env.VITE_GEMINI_API_KEYS || "";
      const GEMINI_API_KEYS = GEMINI_API_KEY_STRING.split(',').map((k: string) => k.trim()).filter((k: string) => k);
      const prompt = `You are a vocabulary helper. Analyze the word/phrase: "${viewingWord.word}". 
Return a JSON object strictly following this structure (do not include markdown wrapping, just the JSON string):
{
  "phonetic": "IPA phonetic transcription if available (e.g. /kæt/)",
  "part_of_speech": "The part of speech in Vietnamese (e.g. Danh từ, Động từ, Tính từ)",
  "short_meaning_vi": "Short Vietnamese translation (1-3 words max, e.g. hạt, cố ý)",
  "definition_vi": "Nghĩa tiếng Việt đầy đủ, chính xác và chuyên sâu hơn.",
  "topic": "Classify the word strictly into ONE of these exactly: Technology, Health & Science, Business & Economy, Education, Environment & Nature, Daily Life, Emotions & Psychology, Entertainment & Art, Travel & Culture, Sports",
  "forms": ["noun: ...", "verb: ...", "adjective: ..."],
  "example": "A realistic example sentence in English.",
  "example_translation_vi": "Bản dịch tiếng Việt của câu ví dụ trên.",
  "collocations": ["collocation 1", "collocation 2"]
}`;
      const GOOGLE_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-2.0-flash-lite-preview-02-05", "gemini-1.5-pro"];
      let res;
      let success = false;
      for (const key of GEMINI_API_KEYS) {
        for (const model of GOOGLE_MODELS) {
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
          if (res.ok) {
            success = true;
            break;
          }
          if (res.status === 429) continue; // Try next model because limit is per-model
        }
        if (success) break;
      }
      
      if (!success || !res || !res.ok) {
        if (res && res.status === 429) throw new Error("429_TOO_MANY_REQUESTS");
        throw new Error("Failed to call Gemini API");
      }
      const data = await res.json();
      let textResult = data.candidates[0].content.parts[0].text;
      
      const jsonMatch = textResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        textResult = jsonMatch[0];
      } else {
        textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      
      const aiData = JSON.parse(textResult);
      
      const updatedFields: Partial<WordData> = {
        phonetic: aiData.phonetic || viewingWord.phonetic,
        part_of_speech: aiData.part_of_speech || viewingWord.part_of_speech,
        short_meaning_vi: aiData.short_meaning_vi || viewingWord.short_meaning_vi,
        definition: `${viewingWord.definition.split(' / ')[0]} / ${aiData.definition_vi}`,
        topic: aiData.topic || viewingWord.topic,
        forms: aiData.forms || viewingWord.forms,
        example: aiData.example || viewingWord.example,
        example_translation_vi: aiData.example_translation_vi || viewingWord.example_translation_vi,
        collocations: aiData.collocations || viewingWord.collocations,
      };

      const wordRef = doc(db, 'words', viewingWord.id);
      await updateDoc(wordRef, updatedFields);
      
      const updatedWord = { ...viewingWord, ...updatedFields } as WordData;
      setViewingWord(updatedWord);
    } catch (e: any) {
      console.error(e);
      if (e.message === "429_TOO_MANY_REQUESTS") {
        alert("Hệ thống AI đang quá tải do giới hạn số lượt truy cập của Google. Bạn vui lòng đợi khoảng 1 phút rồi thử lại nhé!");
      } else {
        alert("Có lỗi xảy ra khi gọi AI. Vui lòng thử lại sau.");
      }
    } finally {
      setRefreshingAI(false);
    }
  };

  const groupedWords = useMemo(() => {
    return words.reduce((acc, word) => {
      const topic = word.topic || 'Uncategorized';
      if (!acc[topic]) acc[topic] = [];
      acc[topic].push(word);
      return acc;
    }, {} as Record<string, WordData[]>);
  }, [words]);

  const rawTopicWords = selectedTopic ? (groupedWords[selectedTopic] || []) : [];
  
  const topicWords = useMemo(() => {
    let filtered = rawTopicWords;
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(w => 
        w.word.toLowerCase().includes(lowerQ) || 
        w.short_meaning_vi?.toLowerCase().includes(lowerQ)
      );
    }
    return filtered;
  }, [rawTopicWords, searchQuery]);

  const totalPages = Math.ceil(topicWords.length / ITEMS_PER_PAGE) || 1;
  // Auto-adjust page if out of bounds due to search
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-slate-400">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  const paginatedWords = topicWords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const allSelected = paginatedWords.length > 0 && paginatedWords.every(w => selectedWords.includes(w.id));

  const renderTopicsView = () => {
    if (words.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <img src="/empty_state.png" alt="Empty" className="w-64 h-64 object-contain mb-8 hover:scale-105 transition-transform" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Không có từ vựng nào!</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md">
            Bạn chưa lưu bất kỳ từ vựng nào. Hãy cài đặt Chrome Extension và bôi đen từ mới để bắt đầu học nhé!
          </p>
        </div>
      );
    }

    return (
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
          }
        }}
      >
        {Object.entries(groupedWords).map(([topic, topicWords]) => (
          <motion.div 
            key={topic} 
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
            onClick={() => setSelectedTopic(topic)}
            className="bg-white dark:bg-[#1e2235] p-6 rounded-3xl border border-slate-200 dark:border-[#2d3248] shadow-sm hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-2xl group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors"></div>
            
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Folder size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">{topic}</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{topicWords.length} thẻ</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-[#2d3248] relative z-10 font-medium">
              <span>Xem chi tiết</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">→</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    );
  };

  const renderWordsView = () => {
    return (
      <div className="relative pb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <button 
            onClick={() => {
              setSelectedTopic(null);
              setSelectedWords([]);
              setSearchQuery("");
              setCurrentPage(1);
            }}
            className="flex w-max items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors font-medium bg-white dark:bg-[#1e2235] px-4 py-2 rounded-xl shadow-sm border border-slate-200 dark:border-[#2d3248]"
          >
            <ArrowLeft size={18} /> Back to Topics
          </button>

          <div className="flex-1 max-w-md mx-auto w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
            <input 
              type="text"
              placeholder="Tìm kiếm từ vựng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1e2235] border border-slate-200 dark:border-[#2d3248] rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
            />
          </div>

          <button
            onClick={() => toggleSelectAllInTopic(paginatedWords)}
            className="flex w-max items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium bg-white dark:bg-[#1e2235] px-4 py-2 rounded-xl shadow-sm border border-slate-200 dark:border-[#2d3248]"
          >
            {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
            {allSelected ? 'Deselect Page' : 'Select Page'}
          </button>
        </div>
        
        {topicWords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500">
            <p>Không tìm thấy từ vựng nào.</p>
          </div>
        ) : (
          <>
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
              }}
            >
            {paginatedWords.map((w) => {
              const isSelected = selectedWords.includes(w.id);
            return (
            <motion.div 
              key={w.id} 
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4 }}
              onClick={() => setViewingWord(w)}
              className={`flex flex-col h-full bg-white dark:bg-[#1e2235] p-6 rounded-3xl border shadow-sm hover:shadow-xl transition-all relative overflow-hidden group cursor-pointer ${
                isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-500 dark:ring-blue-500/20' : 'border-slate-200 dark:border-[#2d3248]'
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWordSelection(w.id);
                }}
                className={`absolute top-4 right-4 z-20 p-1.5 rounded-lg transition-all ${
                  isSelected 
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/20 opacity-100' 
                    : 'text-slate-300 dark:text-slate-600 hover:text-blue-500 opacity-0 group-hover:opacity-100'
                }`}
              >
                {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
              </button>

              <div className="flex flex-col gap-1 pr-8">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-extrabold text-slate-800 dark:text-white line-clamp-2">{w.word}</h3>
                  {w.type === 'sentence' ? (
                    <span className="bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-pink-200 dark:border-pink-500/30 shadow-sm shrink-0">
                      Sentence
                    </span>
                  ) : w.type === 'collocation' ? (
                    <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-teal-200 dark:border-teal-500/30 shadow-sm shrink-0">
                      Collocation
                    </span>
                  ) : w.part_of_speech ? (
                    <span className="bg-[#e0e7ff] dark:bg-blue-900/30 text-[#3730a3] dark:text-blue-300 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-[#c7d2fe] dark:border-blue-500/30 shadow-sm shrink-0">
                      {w.part_of_speech}
                    </span>
                  ) : null}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      playAudio(w.word);
                    }}
                    className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors focus:outline-none p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-500/10 ml-auto"
                    title="Listen to pronunciation"
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {w.phonetic && <span className="text-sm font-medium text-slate-400 dark:text-slate-500">{w.phonetic}</span>}
                  {w.short_meaning_vi && <span className="text-[15px] font-bold text-blue-600 dark:text-blue-400">{w.short_meaning_vi}</span>}
                </div>
              </div>
              
              <div className="mt-5 space-y-3">
                <div className="space-y-1 bg-slate-50 dark:bg-[#151822] p-4 rounded-2xl">
                  {(() => {
                    const parts = w.definition.split(' / ');
                    if (parts.length >= 2) {
                      return (
                        <>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-2">{parts[0]}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-500 line-clamp-2 mt-1">{parts.slice(1).join(' / ')}</p>
                        </>
                      );
                    }
                    return <p className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-2">{w.definition}</p>;
                  })()}
                </div>
                
                {w.example && (
                  <div className="px-1">
                    <p className="text-sm text-slate-600 dark:text-slate-400 italic line-clamp-2">"{w.example}"</p>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-5 border-t border-slate-100 dark:border-[#2d3248] flex items-center justify-between text-xs font-bold tracking-wide">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${getSrsBadge(w.srsLevel).color}`}>
                  <Clock size={12} />
                  <span>{getSrsBadge(w.srsLevel).text}</span>
                </div>
                
                <div className="relative flex items-center gap-2">
                  <button 
                    onClick={(e) => handleDeleteSingle(w.id, e)}
                    disabled={deleting}
                    className="flex items-center justify-center p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Xóa từ vựng"
                  >
                    <Trash2 size={16} />
                  </button>

                  {editingTopicId === w.id ? (
                    <select
                      autoFocus
                      disabled={updating}
                      value={w.topic || "Uncategorized"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateWordTopic(w.id, e.target.value)}
                      onBlur={() => setEditingTopicId(null)}
                      className="text-xs bg-slate-50 dark:bg-[#151822] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2d3248] rounded-lg px-2 py-1 outline-none focus:border-blue-500 cursor-pointer shadow-sm appearance-none pr-6"
                    >
                      {PREDEFINED_TOPICS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTopicId(w.id);
                      }}
                      className="flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors bg-slate-50 hover:bg-blue-50 dark:bg-[#151822] dark:hover:bg-blue-500/10 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#2d3248] hover:border-blue-200 dark:hover:border-blue-500/30"
                    >
                      <span className="truncate max-w-[100px] font-medium">{w.topic || "Uncategorized"}</span>
                      <Edit2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
            )})}
      </motion.div>

            {/* Modal for viewing full word details */}
            <AnimatePresence>
            {viewingWord && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md" 
                onClick={() => setViewingWord(null)}
              >
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="bg-white/95 dark:bg-[#1e2235]/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-white/20 dark:border-white/10"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col gap-2 pr-8">
                        {/* Line 1: Word + Tags */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white break-words">{viewingWord.word}</h3>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            {viewingWord.part_of_speech && (
                              <span className="whitespace-nowrap bg-[#e0e7ff] dark:bg-blue-900/30 text-[#3730a3] dark:text-blue-300 px-2 py-0.5 rounded-lg text-xs font-bold border border-[#c7d2fe] dark:border-blue-500/30 shadow-sm">
                                {viewingWord.part_of_speech}
                              </span>
                            )}
                            <span className={`whitespace-nowrap px-2 py-0.5 rounded-lg text-xs font-bold border shadow-sm ${getSrsBadge(viewingWord.srsLevel).color}`}>
                              {getSrsBadge(viewingWord.srsLevel).text}
                            </span>
                          </div>
                        </div>

                        {/* Line 2: Phonetic + Speaker */}
                        {(viewingWord.phonetic || viewingWord.word) && (
                          <div className="flex items-center gap-2">
                            {viewingWord.phonetic && <span className="text-base font-medium text-slate-400 dark:text-slate-500">{viewingWord.phonetic}</span>}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                playAudio(viewingWord.word);
                              }}
                              className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors focus:outline-none p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-500/10 shrink-0"
                              title="Nghe phát âm"
                            >
                              <Volume2 size={20} />
                            </button>
                          </div>
                        )}

                        {/* Line 3: Meaning */}
                        {viewingWord.short_meaning_vi && (
                          <div className="mt-1">
                            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{viewingWord.short_meaning_vi}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isEditingWord && (
                          <>
                            <button 
                              onClick={handleRefreshAI} 
                              disabled={refreshingAI}
                              title="Làm mới AI Insights (Lấy lại dữ liệu chuyên sâu)"
                              className={`p-2 rounded-full transition-colors ${refreshingAI ? 'text-teal-400 bg-teal-50 dark:bg-teal-900/10 animate-pulse' : 'text-teal-600 hover:text-teal-700 hover:bg-teal-100 bg-teal-50 dark:text-teal-400 dark:bg-teal-900/20 dark:hover:bg-teal-900/40'}`}
                            >
                              <Lightbulb size={20} className={refreshingAI ? "animate-spin" : ""} />
                            </button>
                            <button onClick={handleEditWord} title="Chỉnh sửa từ vựng" className="p-2 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-full transition-colors">
                              <Edit2 size={20} />
                            </button>
                          </>
                        )}
                        <button onClick={() => { setViewingWord(null); setIsEditingWord(false); }} title="Đóng (Esc)" className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-[#2d3248] dark:hover:bg-[#3f4561] rounded-full transition-colors">
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                    
                    {isEditingWord ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Từ vựng</label>
                          <input 
                            value={editFormData.word || ''} 
                            onChange={e => setEditFormData({...editFormData, word: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-[#151822] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2d3248] rounded-xl px-4 py-2 mt-1 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1">
                            <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Loại từ</label>
                            <input 
                              value={editFormData.part_of_speech || ''} 
                              onChange={e => setEditFormData({...editFormData, part_of_speech: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-[#151822] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2d3248] rounded-xl px-4 py-2 mt-1 focus:border-blue-500 outline-none"
                              placeholder="Noun, Verb..."
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Phát âm</label>
                            <input 
                              value={editFormData.phonetic || ''} 
                              onChange={e => setEditFormData({...editFormData, phonetic: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-[#151822] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2d3248] rounded-xl px-4 py-2 mt-1 focus:border-blue-500 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Nghĩa ngắn gọn</label>
                          <input 
                            value={editFormData.short_meaning_vi || ''} 
                            onChange={e => setEditFormData({...editFormData, short_meaning_vi: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-[#151822] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2d3248] rounded-xl px-4 py-2 mt-1 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Định nghĩa chi tiết</label>
                          <textarea 
                            rows={3}
                            value={editFormData.definition || ''} 
                            onChange={e => setEditFormData({...editFormData, definition: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-[#151822] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2d3248] rounded-xl px-4 py-2 mt-1 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Ví dụ</label>
                          <textarea 
                            rows={2}
                            value={editFormData.example || ''} 
                            onChange={e => setEditFormData({...editFormData, example: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-[#151822] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2d3248] rounded-xl px-4 py-2 mt-1 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Dịch nghĩa Ví dụ</label>
                          <textarea 
                            rows={2}
                            value={editFormData.example_translation_vi || ''} 
                            onChange={e => setEditFormData({...editFormData, example_translation_vi: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-[#151822] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2d3248] rounded-xl px-4 py-2 mt-1 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Từ loại liên quan (cách nhau bởi dấu phẩy)</label>
                          <input 
                            value={editFormData.forms?.join(', ') || ''} 
                            onChange={e => setEditFormData({...editFormData, forms: e.target.value.split(',').map(s => s.trim())})}
                            className="w-full bg-slate-50 dark:bg-[#151822] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2d3248] rounded-xl px-4 py-2 mt-1 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Collocations (cách nhau bởi dấu phẩy)</label>
                          <input 
                            value={editFormData.collocations?.join(', ') || ''} 
                            onChange={e => setEditFormData({...editFormData, collocations: e.target.value.split(',').map(s => s.trim())})}
                            className="w-full bg-slate-50 dark:bg-[#151822] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2d3248] rounded-xl px-4 py-2 mt-1 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100 dark:border-[#2d3248]">
                          <button onClick={() => setIsEditingWord(false)} disabled={savingEdit} className="px-4 py-2 rounded-xl font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-[#151822] transition-colors">
                            Hủy
                          </button>
                          <button onClick={handleSaveEdit} disabled={savingEdit} className="px-6 py-2 rounded-xl font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50">
                            {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                          </button>
                        </div>
                      </div>
                    ) : (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Definition</h4>
                        <div className="bg-slate-50 dark:bg-[#151822] p-4 rounded-2xl border border-slate-100 dark:border-[#2d3248]">
                          {(() => {
                            const formatText = (text: string) => {
                              if (!text) return "";
                              // Insert newline before numbers (e.g. " 1. ", " 2. ")
                              let formatted = text.replace(/(?<!^)\s+(?=\d+\.)/g, '\n');
                              // Insert newline before bullets (e.g. " - ")
                              formatted = formatted.replace(/(?<!^)\s+(?=-\s)/g, '\n');
                              return formatted;
                            };

                            const parts = viewingWord.definition.split(' / ');
                            if (parts.length >= 2) {
                              return (
                                <>
                                  <p className="text-base font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{formatText(parts[0])}</p>
                                  <p className="text-base text-slate-600 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-[#2d3248] whitespace-pre-wrap">{formatText(parts.slice(1).join(' / '))}</p>
                                </>
                              );
                            }
                            return <p className="text-base font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{formatText(viewingWord.definition)}</p>;
                          })()}
                        </div>
                      </div>

                      {(() => {
                        const validForms = viewingWord.forms?.filter(f => !f.toLowerCase().includes('n/a') && f.trim() !== "") || [];
                        if (validForms.length === 0) return null;
                        return (
                          <div>
                            <h4 className="text-sm font-bold text-teal-600 dark:text-teal-500 uppercase tracking-wider mb-2">✨ AI Insights - Word Forms</h4>
                            <div className="bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-500/20 p-4 rounded-2xl">
                              <ul className="text-sm text-teal-800 dark:text-teal-300 font-medium leading-relaxed list-disc pl-4 space-y-1">
                                {validForms.map((form, idx) => (
                                  <li key={idx}>{form}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        );
                      })()}

                      {viewingWord.example && (
                        <div>
                          <h4 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Example</h4>
                          <div className="pl-4 border-l-4 border-blue-400 dark:border-blue-500 py-1 space-y-2">
                            <p className="text-base italic text-slate-600 dark:text-slate-400">"{viewingWord.example}"</p>
                            {viewingWord.example_translation_vi && (
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-500">{viewingWord.example_translation_vi}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {(() => {
                        const validCollocations = viewingWord.collocations?.filter(c => !c.toLowerCase().includes('n/a') && c.trim() !== "") || [];
                        if (validCollocations.length === 0) return null;
                        return (
                          <div>
                            <h4 className="text-sm font-bold text-teal-600 dark:text-teal-500 uppercase tracking-wider mb-2">✨ AI Insights - Collocations</h4>
                            <div className="bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-500/20 p-4 rounded-2xl flex flex-wrap gap-2">
                              {validCollocations.map((coll, idx) => (
                                <span key={idx} className="bg-white dark:bg-[#1e2235] text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                                  {coll}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white dark:bg-[#1e2235] border border-slate-200 dark:border-[#2d3248] text-slate-500 hover:text-blue-500 disabled:opacity-50 disabled:hover:text-slate-500 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-10 h-10 rounded-lg font-bold text-sm transition-colors ${
                        currentPage === i + 1 
                          ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                          : 'bg-white dark:bg-[#1e2235] border border-slate-200 dark:border-[#2d3248] text-slate-500 hover:border-blue-500 hover:text-blue-500'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-white dark:bg-[#1e2235] border border-slate-200 dark:border-[#2d3248] text-slate-500 hover:text-blue-500 disabled:opacity-50 disabled:hover:text-slate-500 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}

        {/* Floating Bulk Action Bar */}
        {selectedWords.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 ml-32 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-800 dark:border-slate-200">
              <span className="font-bold">{selectedWords.length} từ đã chọn</span>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSelectedWords([])}
                  className="px-4 py-2 rounded-xl font-medium bg-slate-800 dark:bg-slate-100 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/20 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={18} /> Xóa hàng loạt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* 3D Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[2.5rem] p-8 mb-10 flex items-center justify-between shadow-xl shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 text-white max-w-lg">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">
            {selectedTopic ? `Topic: ${selectedTopic}` : 'Your Vocabulary'}
          </h1>
          <p className="text-blue-100 font-medium text-lg">
            {selectedTopic 
              ? `You have ${groupedWords[selectedTopic]?.length || 0} words in this topic.`
              : `You have saved ${words.length} words across ${Object.keys(groupedWords).length} topics.`}
          </p>
        </div>
        <div className="relative z-10 hidden md:block">
          <img src="/dashboard_banner.png" alt="Brain lifting weights" className="h-40 object-contain drop-shadow-2xl hover:scale-105 transition-transform" />
        </div>
      </div>

      {selectedTopic ? renderWordsView() : renderTopicsView()}
    </div>
  );
}
