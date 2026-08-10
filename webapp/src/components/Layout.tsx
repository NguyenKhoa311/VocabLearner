import { Outlet, Link, useLocation } from 'react-router-dom';
import { BookOpen, BrainCircuit, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: BookOpen },
    { name: 'Review', path: '/review', icon: BrainCircuit },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0e14] flex transition-colors duration-300 relative z-0">
      {/* Glow Background */}
      <div className="fixed inset-0 z-[-1] hidden dark:block bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />
      
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-white/80 dark:bg-[#151822]/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-[#222634]/50 h-screen flex flex-col p-4 fixed transition-colors duration-300 z-10">
        <div className="flex items-center gap-3 px-2 mb-8 mt-2">
          <img src="/favicon.png" alt="Logo" className="w-9 h-9 rounded-xl shadow-lg shadow-blue-500/30" />
          <span className="font-extrabold text-xl tracking-tight text-slate-800 dark:text-white">VocabHelper</span>
        </div>
        
        <div className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold relative ${
                  isActive 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-[#1a1e2b]/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="nav-pill" 
                    className="absolute inset-0 bg-blue-50 dark:bg-blue-500/10 rounded-xl -z-10" 
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon size={20} className={`z-10 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="z-10">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 text-slate-900 dark:text-slate-100 min-h-screen relative z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
