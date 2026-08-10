import { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Download, AlertTriangle, Moon, Sun, Target, Trash2 } from 'lucide-react';

export default function Settings() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [dailyGoal, setDailyGoal] = useState<number>(20);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    // Load from local storage
    const savedTheme = localStorage.getItem('vocab_theme') || 'light';
    const savedGoal = localStorage.getItem('vocab_daily_goal') || '20';
    setTheme(savedTheme as 'light' | 'dark');
    setDailyGoal(parseInt(savedGoal, 10));
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('vocab_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleGoalChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setDailyGoal(num);
      localStorage.setItem('vocab_daily_goal', num.toString());
    }
  };

  const fetchAllWords = async () => {
    const snapshot = await getDocs(collection(db, 'words'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const exportJSON = async () => {
    setExporting(true);
    try {
      const words = await fetchAllWords();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(words, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `vocab_backup_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to export JSON.");
    } finally {
      setExporting(false);
    }
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const words = await fetchAllWords();
      if (words.length === 0) {
        alert("No words to export.");
        setExporting(false);
        return;
      }
      
      const headers = ['id', 'word', 'phonetic', 'part_of_speech', 'short_meaning_vi', 'definition_en', 'definition_vi', 'example', 'topic', 'srsLevel', 'nextReviewDate'];
      const csvContent = [
        headers.join(','),
        ...words.map((w: any) => headers.map(h => `"${(w[h] || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `vocab_backup_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const snapshot = await getDocs(collection(db, 'words'));
      const batch = writeBatch(db);
      
      let count = 0;
      snapshot.docs.forEach((document) => {
        batch.delete(doc(db, 'words', document.id));
        count++;
        // WriteBatch limits to 500 operations, but we'll assume < 500 for demo. 
        // For production, you'd chunk this.
      });
      
      if (count > 0) {
        await batch.commit();
      }
      alert("All vocabulary has been successfully deleted.");
      setShowConfirmDelete(false);
    } catch (e) {
      console.error("Delete failed", e);
      alert("Failed to delete all words.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Manage your app preferences and your vocabulary database.</p>
      </div>

      <div className="space-y-8">
        {/* Appearance Section */}
        <section className="bg-white dark:bg-[#1e2235] p-8 rounded-[2.5rem] border border-slate-200 dark:border-[#2d3248] shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Sun className="text-orange-500" size={24} /> 
            Appearance & Preferences
          </h2>
          
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-[#151822] rounded-2xl border border-slate-100 dark:border-[#2d3248]">
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-200">Theme</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Toggle between Light and Dark mode for the dashboard.</p>
              </div>
              <div className="flex bg-slate-200 dark:bg-[#0f111a] rounded-xl p-1">
                <button 
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'light' ? 'bg-white text-slate-800 shadow-sm dark:bg-[#2d3248] dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  <Sun size={16} /> Light
                </button>
                <button 
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-800 text-white shadow-sm dark:bg-[#2d3248] dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  <Moon size={16} /> Dark
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-[#151822] rounded-2xl border border-slate-100 dark:border-[#2d3248]">
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-200">Daily Study Goal</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">How many cards do you want to review per day?</p>
              </div>
              <div className="flex items-center gap-3">
                <Target className="text-blue-500" size={20} />
                <input 
                  type="number" 
                  value={dailyGoal}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  className="w-20 px-3 py-2 text-center rounded-xl border border-slate-200 dark:border-[#2d3248] bg-white dark:bg-[#1e2235] font-bold text-slate-700 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 transition-all"
                  min="1"
                />
                <span className="text-slate-500 dark:text-slate-400 font-medium">cards</span>
              </div>
            </div>
          </div>
        </section>

        {/* Data Management Section */}
        <section className="bg-white dark:bg-[#1e2235] p-8 rounded-[2.5rem] border border-slate-200 dark:border-[#2d3248] shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Download className="text-blue-500" size={24} /> 
            Data Backup & Export
          </h2>
          
          <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">
            Download a copy of all your saved vocabulary. You can use CSV to open in Excel/Google Sheets, or JSON for developers and Anki integrations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={exportCSV}
              disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold py-4 rounded-2xl border border-blue-100 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              <Download size={20} /> Export as CSV
            </button>
            <button 
              onClick={exportJSON}
              disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold py-4 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
            >
              <Download size={20} /> Export as JSON
            </button>
          </div>
        </section>

        {/* Danger Zone Section */}
        <section className="bg-white dark:bg-[#1e2235] p-8 rounded-[2.5rem] border border-red-200 dark:border-red-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
            <AlertTriangle size={150} />
          </div>
          
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2 relative z-10">
            <AlertTriangle size={24} /> 
            Danger Zone
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium relative z-10">
            Irreversible actions. Once you delete your data, there is no going back. Please be certain.
          </p>

          {!showConfirmDelete ? (
            <button 
              onClick={() => setShowConfirmDelete(true)}
              className="bg-white dark:bg-[#151822] text-red-500 dark:text-red-400 font-bold py-3 px-6 rounded-xl border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors relative z-10 shadow-sm"
            >
              Delete All Vocabulary
            </button>
          ) : (
            <div className="bg-red-50 dark:bg-red-500/10 p-6 rounded-2xl border border-red-100 dark:border-red-500/20 relative z-10">
              <p className="text-red-800 dark:text-red-300 font-bold mb-2">Are you absolutely sure?</p>
              <p className="text-red-600 dark:text-red-400 text-sm mb-6">This action cannot be undone. All your saved words and SRS progress will be permanently erased.</p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Yes, delete everything'}
                </button>
                <button 
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={deleting}
                  className="bg-white dark:bg-[#151822] text-slate-700 dark:text-slate-300 font-medium py-2 px-6 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
