<template>
  <div class="toast-container">
    <transition-group name="toast">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="toast-item"
        :style="`border-left: 4px solid var(--wa-color-${toast.variant}-500); background-color: #ffffff; color: var(--wa-color-neutral-800);`">
        <wa-icon :name="toast.variant === 'success' ? 'check2-circle' : (toast.variant === 'danger' ? 'x-circle' : 'exclamation-triangle')" :style="`color: var(--wa-color-${toast.variant}-500); font-size: 1.25rem;`"></wa-icon>
        <div style="flex-grow: 1;" v-html="toast.message"></div>
        <div class="toast-close" @click="remove(toast.id)">
          <wa-icon name="x-lg"></wa-icon>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast';

const { toasts, remove } = useToast();
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
  max-width: 400px;
}

.toast-item {
  pointer-events: auto;
  padding: 1rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9em;
  font-weight: 500;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.toast-close {
  cursor: pointer;
  opacity: 0.7;
  display: flex;
  align-items: center;
}

.toast-close:hover {
  opacity: 1;
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
