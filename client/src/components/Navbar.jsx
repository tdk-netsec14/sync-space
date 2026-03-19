import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-4 md:py-6 transition-all duration-300">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className={`w-full max-w-5xl flex items-center justify-between px-6 py-3.5 rounded-full border transition-all duration-350 ${
          scrolled 
            ? 'glass-card border-brand-black/10 shadow-editorial-sm bg-white/80' 
            : 'bg-transparent border-transparent'
        }`}
      >
        <Link to="/" className="flex items-center gap-2 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-black text-sm font-black text-brand-yellow transition-transform duration-350 group-hover:rotate-12 shadow-sm border border-brand-black/10">
            S
          </span>
          <span className="font-editorial text-lg font-bold tracking-tight text-brand-black group-hover:text-brand-purple transition-colors">
            Sync<span className="font-serif-editorial italic font-normal text-xl lowercase ml-0.5">space</span>
          </span>
        </Link>
        
        <div className="flex items-center gap-4 text-sm font-sans-editorial">
          <Link 
            to="/login" 
            className="px-4 py-2 font-bold text-brand-black/75 hover:text-brand-black hover:bg-brand-black/5 rounded-full transition-all duration-200"
          >
            Log in
          </Link>
          
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Link 
              to="/register" 
              className="inline-flex items-center rounded-full bg-brand-yellow border-editorial px-5 py-2 text-xs font-bold text-brand-black shadow-editorial-sm hover:bg-[#ffcf29] transition-colors"
            >
              Start for free
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </header>
  );
}