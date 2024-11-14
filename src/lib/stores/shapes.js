import { writable } from 'svelte/store';
import defaultCanvas from './default-canvas.json';

function createShapesStore() {
  // Load initial state from localStorage or default-canvas.json
  const storedShapes = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem('canvas-shapes')) || defaultCanvas
    : defaultCanvas;

  const { subscribe, set, update } = writable(storedShapes);

  return {
    subscribe,
    set: (shapes) => {
      set(shapes);
      saveToLocalStorage(shapes);
    },
    update: (fn) => {
      update(state => {
        const newState = fn(state);
        saveToLocalStorage(newState);
        return newState;
      });
    },
  };
}

function saveToLocalStorage(shapes) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('canvas-shapes', JSON.stringify(shapes));
  }
}

export const shapes = createShapesStore();