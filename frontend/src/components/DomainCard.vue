<template>
  <wa-card class="dashboard-card" :style="`--card-brand-color: ${domain.color || getBrandColor(domain.name)};`">
    <div slot="header">
      <strong style="font-size: 1.1rem;">{{ domain.titel || domain.name }}</strong>
    </div>
    
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.5rem 0; margin-bottom: 0.5rem;">
      <div :style="{ fontSize: count === 'Error' ? '1.2rem' : '1.6rem', fontWeight: 'bold', color: count === 'Error' ? 'var(--wa-color-danger-600)' : 'var(--card-brand-color)', lineHeight: 1 }">
        {{ count !== undefined ? count : '-' }}
      </div>
      <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--wa-color-neutral-500); margin-top: 0.25rem;">
        Identities
      </div>
    </div>
    
    <div slot="footer" style="display: flex; justify-content: flex-end; gap: 0.25rem; align-items: center; flex-wrap: wrap;">
      <template v-if="domain.actions && domain.actions.length">
        <template v-for="(act, index) in domain.actions" :key="act.name">
          <wa-button :id="`domain-action-btn-${domain.name}-${index}`" variant="neutral" size="small" @click="$emit('run-action', act, domain.name)" style="margin-right: auto;">
            {{ act.name }}
          </wa-button>
          <wa-tooltip :for="`domain-action-btn-${domain.name}-${index}`" v-if="getActionDescription(act)">
            {{ getActionDescription(act) }}
          </wa-tooltip>
        </template>
      </template>
      <div style="flex-grow: 1" v-if="!domain.actions || !domain.actions.length"></div>
      
      <wa-button title="CSV Download" variant="text" size="small" @click="$emit('download-csv', domain.name)">
        <wa-icon name="download" style="font-size: 1rem; stroke: currentColor; stroke-width: 0.5px;"></wa-icon>
      </wa-button>
      
      <wa-button title="Details ansehen" variant="text" size="small" @click="$router.push('/domain/'+domain.name)">
        <wa-icon name="list" style="font-size: 1rem; stroke: currentColor; stroke-width: 0.5px;"></wa-icon>
      </wa-button>
      
      <wa-button title="Neu laden" variant="text" size="small" @click="$emit('refresh', domain.name)" :disabled="loading">
        <wa-icon name="arrow-clockwise" style="font-size: 1rem; stroke: currentColor; stroke-width: 0.5px;"></wa-icon>
      </wa-button>
    </div>
  </wa-card>
</template>

<script setup>
import { inject } from 'vue';
import { getBrandColor } from '../utils/brandColors.js';

const props = defineProps({
  domain: { type: Object, required: true },
  count: { type: [Number, String], default: '-' },
  loading: { type: Boolean, default: false }
});
defineEmits(['run-action', 'refresh', 'download-csv']);

const config = inject('synxConfig', { tasks: [] });

function getActionDescription(act) {
  const actionKey = act.download || act.endpoint || act.run || act.task;
  if (!actionKey) return '';
  const taskName = actionKey.startsWith('/') ? actionKey.split('/').pop() : actionKey;
  const task = (config?.tasks || []).find(t => t.name === taskName);
  return task?.description || '';
}
</script>

<style scoped>
.dashboard-card {
    height: 100%;
}
.dashboard-card::part(base) {
    height: 100%;
    display: flex;
    flex-direction: column;
}
.dashboard-card::part(body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.dashboard-card::part(header) {
    border-bottom: 3px solid var(--card-brand-color) !important;
}
</style>
