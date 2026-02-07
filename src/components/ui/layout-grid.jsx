"use client";
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const LayoutGrid = ({ cards }) => {
  const [selected, setSelected] = useState(null);
  const [lastSelected, setLastSelected] = useState(null);

  const handleClick = (card) => {
    setLastSelected(selected);
    setSelected(card);
  };

  const handleOutsideClick = () => {
    setLastSelected(selected);
    setSelected(null);
  };

  return (
    <div className="w-full min-h-screen py-10 px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 auto-rows-max gap-4 max-w-7xl mx-auto">
        {cards.map((card, i) => (
          <div key={card.id} className={cn(card.className, "h-[300px]")}>
            <motion.div
              onClick={() => handleClick(card)}
              className={cn(
                "relative overflow-hidden",
                "h-full w-full",
                "bg-card",
                "rounded-xl",
                "shadow-lg",
                "cursor-pointer",
                "border border-border",
                selected?.id === card.id
                  ? "rounded-lg center z-50 inset-0 fixed"
                  : lastSelected?.id === card.id
                  ? "z-40 bg-card rounded-xl h-full w-full"
                  : "bg-card rounded-xl h-full w-full"
              )}
              layoutId={`card-${card.id}`}
            >
              {selected?.id === card.id && <SelectedCard selected={selected} handleOutsideClick={handleOutsideClick} />}
              <BlurImage card={card} />
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BlurImage = ({ card }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative h-full w-full group cursor-pointer">
      <img
        src={card.thumbnail}
        onLoad={() => setLoaded(true)}
        className={cn(
          "object-cover object-center absolute inset-0 h-full w-full transition duration-700",
          loaded ? "blur-none" : "blur-md"
        )}
        alt="thumbnail"
      />
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 group-hover:from-black/60 group-hover:via-black/50 group-hover:to-black/60 transition duration-700",
        "flex items-center justify-center p-6"
      )}>
        <div className="relative z-10 text-center">
          {card.title ? (
            <div>
              <p className="font-bold text-2xl md:text-3xl text-white mb-2">
                {card.title}
              </p>
              <p className="font-normal text-sm text-white/80">
                {card.description || 'Click to view details'}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-bold text-2xl md:text-3xl text-white mb-2">Chart</p>
              <p className="font-normal text-sm text-white/80">Click to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SelectedCard = ({ selected, handleOutsideClick }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        handleOutsideClick();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        handleOutsideClick();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "auto";
    };
  }, [handleOutsideClick]);

  return (
    <motion.div
      ref={ref}
      layoutId={`card-${selected.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-20 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={handleOutsideClick}
    >
      <motion.div 
        className="relative bg-card rounded-lg h-full w-full max-w-7xl shadow-2xl overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          className="absolute top-4 right-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            onClick={handleOutsideClick}
            className="bg-background/80 backdrop-blur-sm text-foreground p-2 rounded-full hover:bg-background transition border border-border"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </motion.div>
        <div className="h-full w-full overflow-auto p-6 md:p-10 bg-background">
          {selected.title && (
            <div className="mb-6 pb-4 border-b">
              <h2 className="text-3xl font-bold mb-2">{selected.title}</h2>
              {selected.description && (
                <p className="text-muted-foreground">{selected.description}</p>
              )}
            </div>
          )}
          {selected.content}
        </div>
      </motion.div>
    </motion.div>
  );
};
