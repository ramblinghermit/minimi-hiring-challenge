<template>
  <div class="inline-flex items-center select-none flex-shrink-0">
    <svg 
      viewBox="0 0 48 30" 
      class="w-5 h-[13px] block"
      xmlns="http://www.w3.org/2000/svg"
    >
      <template v-for="r in 10" :key="'r' + r">
        <circle 
          v-for="c in 16" 
          :key="'d_' + r + '_' + c"
          :cx="(c - 1) * 3 + 1.5"
          :cy="(r - 1) * 3 + 1.5"
          :r="isDotLit(r - 1, c - 1) ? 1.3 : 0.6"
          :class="[
            isDotLit(r - 1, c - 1)
              ? 'fill-[#4c4c4c] dark:fill-neutral-300'
              : 'fill-slate-300/30 dark:fill-neutral-800/40'
          ]"
        />
      </template>
    </svg>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// 16x10 Dot Matrix Walking Cat Frames (1 = lit LED, 0 = off)
const frames = [
  // Frame 0: Stride 1
  [
    '..........O..O..',
    '.........OOOOO..',
    '.........O.O.O..',
    '.........OOOOO..',
    'O....OOOOOOOO...',
    '.O..OOOOOOOOO...',
    '..OOOOOOOOOO....',
    '....OOOOOOO.....',
    '...O..O..O..O...',
    '...O...O.O...O..'
  ],
  // Frame 1: Passing 1
  [
    '..........O..O..',
    '.........OOOOO..',
    '.........O.O.O..',
    '.........OOOOO..',
    '.O...OOOOOOOO...',
    '..O.OOOOOOOOO...',
    '...OOOOOOOOO....',
    '....OOOOOOO.....',
    '....O..O..O.O...',
    '....O..O...OO...'
  ],
  // Frame 2: Stride 2
  [
    '..........O..O..',
    '.........OOOOO..',
    '.........O.O.O..',
    '.........OOOOO..',
    'O....OOOOOOOO...',
    '.O..OOOOOOOOO...',
    '..OOOOOOOOOO....',
    '....OOOOOOO.....',
    '.....O.O..O..O..',
    '....O...O..O.O..'
  ],
  // Frame 3: Passing 2
  [
    '..........O..O..',
    '.........OOOOO..',
    '.........O.O.O..',
    '.........OOOOO..',
    '.O...OOOOOOOO...',
    '..O.OOOOOOOOO...',
    '...OOOOOOOOO....',
    '....OOOOOOO.....',
    '....O..O..O..O..',
    '....O..O..O..O..'
  ]
];

const currentFrameIndex = ref(0);
let animTimer = null;

onMounted(() => {
  animTimer = setInterval(() => {
    currentFrameIndex.value = (currentFrameIndex.value + 1) % frames.length;
  }, 160);
});

onUnmounted(() => {
  if (animTimer) clearInterval(animTimer);
});

const isDotLit = (row, col) => {
  const currentFrame = frames[currentFrameIndex.value];
  if (!currentFrame || !currentFrame[row]) return false;
  return currentFrame[row][col] === 'O';
};
</script>
