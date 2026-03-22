import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './StoryMode.module.css';

const SLIDE_DURATION = 8000; // Snappy 8 seconds!
export default function StoryMode({ data, monthLabel, onClose }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const slideVariants = {
    enter: (dir) => ({
      x: dir > 0 ? 150 : -150,
      opacity: 0,
      scale: 0.95,
      filter: 'blur(8px)'
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)'
    },
    exit: (dir) => ({
      x: dir > 0 ? -150 : 150,
      opacity: 0,
      scale: 1.05,
      filter: 'blur(8px)'
    })
  };

  const hrs = Math.floor(data.total_minutes / 60);
  const mins = Math.round(data.total_minutes % 60);
  const topArtist = data.top_artists?.[0]?.name || "Unknown Artist";
  
  const slides = [
    {
      id: 'time',
      bgClass: styles.bgTime,
      content: (
        <>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className={styles.preTitle}>
            {monthLabel}
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }} className={styles.massiveText}>
            You spent <span className={styles.highlight}>{Math.round(data.total_minutes).toLocaleString()} mins</span> lost in the music.
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }} className={styles.subText}>
            That's {hrs} hours and {mins} minutes of pure vibes.
          </motion.p>
        </>
      )
    },
    {
      id: 'artists',
      bgClass: styles.bgArtist,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px', justifyContent: 'center' }}>
          <div>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className={styles.preTitle} style={{ marginBottom: '16px' }}>
              Top Artists
            </motion.p>
            
            <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }} style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '14px', color: '#ff4444', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>👑 #1 Artist</span>
              <h2 style={{ fontSize: '42px', fontWeight: '900', color: 'white', lineHeight: '1.1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {topArtist}
              </h2>
            </motion.div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {data.top_artists?.slice(1, 5).map((a, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -30 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: 0.4 + (i * 0.15), duration: 0.5, ease: "easeOut" }} 
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '22px', color: 'rgba(255,255,255,0.85)' }}
                >
                  <strong style={{ color: '#fff', opacity: 0.4, width: '24px', flexShrink: 0, textAlign: 'center' }}>{i + 2}</strong> 
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>{a.name}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'songs',
      bgClass: styles.bgSongs,
      content: (
        <>
          <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className={styles.preTitle}>
            Top Songs
          </motion.p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            {data.top_songs?.slice(0, 5).map((song, i) => {
              const isNumberOne = i === 0;
              return (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 30 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.2 + (i * 0.15), duration: 0.5, ease: "easeOut" }} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px',
                    background: isNumberOne ? 'linear-gradient(135deg, rgba(255,0,0,0.15) 0%, rgba(255,255,255,0.05) 100%)' : 'transparent',
                    padding: isNumberOne ? '16px' : '4px 8px',
                    borderRadius: '16px',
                    border: isNumberOne ? '1px solid rgba(255,0,0,0.3)' : 'none'
                  }}
                >
                  <span style={{ 
                    fontSize: isNumberOne ? '32px' : '20px', 
                    fontWeight: '900', 
                    color: isNumberOne ? '#ff4444' : 'rgba(255,255,255,0.3)', 
                    width: isNumberOne ? '40px' : '30px',
                    flexShrink: 0,
                    textAlign: 'center'
                  }}>
                    {isNumberOne ? '👑' : i + 1}
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ 
                      fontSize: isNumberOne ? '22px' : '18px', 
                      fontWeight: isNumberOne ? '800' : '700', 
                      color: '#fff', 
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{song.name}</span>
                    <span style={{ 
                      fontSize: isNumberOne ? '15px' : '14px', 
                      color: isNumberOne ? '#ffb3b3' : '#aaa', 
                      marginTop: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{song.artist}</span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </>
      )
    },
    {
      id: 'discovery',
      bgClass: styles.bgDiscovery,
      content: (
        <div style={{ textAlign: 'center' }}>
          <motion.h2 initial={{ opacity: 0, scale: 0.8, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }} className={styles.massiveText}>
            You <br/><span className={styles.highlight}>Expanded</span><br/>Your World.
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }} className={styles.subText} style={{ marginTop: '24px' }}>
            Exploring <strong>{data.summary?.unique_artists?.toLocaleString() || "new"}</strong> artists across <strong>{data.summary?.unique_songs?.toLocaleString() || "many"}</strong> unique tracks.
          </motion.p>
        </div>
      )
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (current < slides.length - 1) {
        setDirection(1);
        setCurrent(c => c + 1);
      } else {
        onClose(); 
      }
    }, SLIDE_DURATION);
    return () => clearTimeout(timer);
  }, [current, slides.length, onClose]);

  const handleTapLeft = () => {
    if (current > 0) {
      setDirection(-1);
      setCurrent(c => c - 1);
    }
  };
  
  const handleTapRight = () => {
    if (current < slides.length - 1) {
      setDirection(1);
      setCurrent(c => c + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className={styles.storyOverlay}>
      <div className={styles.storyContainer}>
        
        <AnimatePresence>
          <motion.div 
            key={slides[current].bgClass}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className={`${styles.storyBackground} ${slides[current].bgClass}`}
          />
        </AnimatePresence>

        <div className={styles.progressRow}>
          {slides.map((_, i) => (
            <div key={i} className={styles.progressBar}>
              <div className={`${styles.progressFill} ${i === current ? styles.progressActive : i < current ? styles.progressDone : ''}`} />
            </div>
          ))}
        </div>

        <div className={styles.tapLeft} onClick={handleTapLeft} />
        <div className={styles.tapRight} onClick={handleTapRight} />
        
        <button className={styles.closeBtn} onClick={onClose} style={{ zIndex: 20 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div 
            key={current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }} 
            className={styles.slideContent}
          >
            {slides[current].content}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}