"use client";
import { motion } from "framer-motion";
import React from "react";

export const LoaderOne = () => {
  const transition = (x) => {
    return {
      duration: 1,
      repeat: Infinity,
      repeatType: "loop",
      delay: x * 0.2,
      ease: "easeInOut",
    };
  };
  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: [0, 10, 0],
        }}
        transition={transition(0)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300" />
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: [0, 10, 0],
        }}
        transition={transition(1)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300" />
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: [0, 10, 0],
        }}
        transition={transition(2)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300" />
    </div>
  );
};

export const LoaderTwo = () => {
  const transition = (x) => {
    return {
      duration: 2,
      repeat: Infinity,
      repeatType: "loop",
      delay: x * 0.2,
      ease: "easeInOut",
    };
  };
  return (
    <div className="flex items-center">
      <motion.div
        transition={transition(0)}
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        className="h-4 w-4 rounded-full bg-neutral-200 shadow-md dark:bg-neutral-500" />
      <motion.div
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        transition={transition(0.4)}
        className="h-4 w-4 -translate-x-2 rounded-full bg-neutral-200 shadow-md dark:bg-neutral-500" />
      <motion.div
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        transition={transition(0.8)}
        className="h-4 w-4 -translate-x-4 rounded-full bg-neutral-200 shadow-md dark:bg-neutral-500" />
    </div>
  );
};

export const LoaderThree = () => {
  const outerPerimeterPath = `M977 1580 c-51 -13 -101 -48 -135 -96 -16 -22 -72 -79 -125 -128
-118 -108 -127 -128 -127 -274 0 -244 71 -491 173 -600 65 -70 169 -96 223
-56 45 33 61 62 110 189 58 153 69 171 208 340 64 77 126 160 138 184 31 65
35 128 9 178 -28 55 -120 154 -180 192 -92 59 -218 89 -294 71z`;
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="34"
      height="34"
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      className="h-34 w-34 stroke-neutral-500 [--fill-final:var(--color-yellow-300)] [--fill-initial:var(--color-neutral-50)] dark:stroke-neutral-100 dark:[--fill-final:var(--color-yellow-500)] dark:[--fill-initial:var(--color-neutral-800)]">
      <g transform="translate(0,200) scale(0.1,-0.1)">
        <motion.path
          initial={{ fill: "var(--fill-initial)" }}
          animate={{ fill: "var(--fill-final)" }}
          transition={{
            duration: 3,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse",
          }}
          stroke="none"
          vectorEffect="non-scaling-stroke"
          d={outerPerimeterPath}
        />
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 5,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse",
          }}
          fill="none"
          vectorEffect="non-scaling-stroke"
          d={outerPerimeterPath}
        />
      </g>
    </motion.svg>
  );
};

export const LoaderFour = ({
  text = "Loading..."
}) => {
  return (
    <div
      className="relative font-bold text-black [perspective:1000px] dark:text-white">
      <motion.span
        animate={{
          skewX: [0, -40, 0],
          scaleX: [1, 2, 1],
        }}
        transition={{
          duration: 0.05,
          repeat: Infinity,
          repeatType: "reverse",
          repeatDelay: 2,
          ease: "linear",
          times: [0, 0.2, 0.5, 0.8, 1],
        }}
        className="relative z-20 inline-block">
        {text}
      </motion.span>
      <motion.span
        className="absolute inset-0 text-[#00e571]/50 blur-[0.5px] dark:text-[#00e571]"
        animate={{
          x: [-2, 4, -3, 1.5, -2],
          y: [-2, 4, -3, 1.5, -2],
          opacity: [0.3, 0.9, 0.4, 0.8, 0.3],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear",
          times: [0, 0.2, 0.5, 0.8, 1],
        }}>
        {text}
      </motion.span>
      <motion.span
        className="absolute inset-0 text-[#8b00ff]/50 dark:text-[#8b00ff]"
        animate={{
          x: [0, 1, -1.5, 1.5, -1, 0],
          y: [0, -1, 1.5, -0.5, 0],
          opacity: [0.4, 0.8, 0.3, 0.9, 0.4],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear",
          times: [0, 0.3, 0.6, 0.8, 1],
        }}>
        {text}
      </motion.span>
    </div>
  );
};

export const LoaderFive = ({
  text
}) => {
  return (
    <div
      className="font-sans font-bold [--shadow-color:var(--color-neutral-500)] dark:[--shadow-color:var(--color-neutral-100)]">
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{
            scale: [1, 1.1, 1],
            textShadow: [
              "0 0 0 var(--shadow-color)",
              "0 0 1px var(--shadow-color)",
              "0 0 0 var(--shadow-color)",
            ],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "loop",
            delay: i * 0.05,
            ease: "easeInOut",
            repeatDelay: 2,
          }}>
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </div>
  );
};
