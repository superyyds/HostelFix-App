import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";
import { useState, useEffect } from "react";

const HelpTooltip = ({ label }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [typedText, setTypedText] = useState("");
  const fullText =
    label ||
    "Rate this aspect from 1 to 5 stars. Hover over each star to see a description of its meaning.";

  // Typewriter effect for tooltip text
  useEffect(() => {
    if (!showTooltip) {
      setTypedText("");
      return;
    }
    let index = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, index));
      index++;
      if (index > fullText.length) clearInterval(interval);
    }, 25);
    return () => clearInterval(interval);
  }, [showTooltip]);

  return (
    <div className="relative inline-block z-50">
      {/* Trigger Button */}
      <motion.button
        type="button"
        aria-label="Show help tooltip"
        onClick={(e) => {
          e.preventDefault();
          setShowTooltip((prev) => !prev);
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="ml-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full shadow-lg hover:shadow-pink-500/50 transition-all duration-300 flex items-center gap-2 relative overflow-hidden"
      >
        {/* Glowing animated gradient border */}
        <motion.span
          className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 via-indigo-400 to-purple-400 opacity-50 blur-md"
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            repeat: Infinity,
            duration: 6,
            ease: "linear",
          }}
        />
        <Info className="w-4 h-4 text-white drop-shadow-lg animate-pulse relative z-10" />
        <span className="text-white drop-shadow-md relative z-10">
          Click for Help
        </span>
      </motion.button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: -10, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 180,
              damping: 20,
            }}
            className="absolute left-1/2 -translate-x-1/2 top-[-110px] w-72 bg-gradient-to-br from-gray-800/90 via-gray-700/80 to-gray-900/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_0_25px_rgba(255,0,255,0.3)] p-5 text-sm text-gray-200 overflow-hidden"
          >
            {/* Glow Layer */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 via-purple-500/10 to-indigo-500/10 rounded-2xl blur-2xl opacity-70"
              animate={{ opacity: [0.6, 0.9, 0.6] }}
              transition={{ repeat: Infinity, duration: 3 }}
            />
            
            {/* Floating Particles */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute w-1 h-1 bg-pink-400 rounded-full opacity-60"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 3 + Math.random() * 2,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </div>

            <div className="relative flex items-start gap-3 z-10">
              <div className="bg-gradient-to-tr from-indigo-500 to-pink-500 p-2 rounded-full shadow-lg flex-shrink-0">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white mb-1 tracking-wide">
                  Need Help?
                </p>
                <p className="text-gray-200 leading-snug">
                  {typedText}
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                    }}
                    className="inline-block w-1 h-4 bg-white ml-1 align-bottom"
                  />
                </p>
              </div>
            </div>

            {/* Tooltip Arrow */}
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-800/90 rotate-45 border-l border-t border-white/10"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HelpTooltip;
