<template>
  <wa-card class="dashboard-card visual-diff-card" :style="`--source-color: ${getBrandColor(diff.source, config)}; --target-color: ${getBrandColor(diff.target, config)};`">
    <div slot="header" style="font-size: 1.1rem; font-weight: bold;">
        {{ diff.titel }}
    </div>
    
    <div class="vd-body">
        <div class="vd-grid" v-if="stats && stats !== 'Error'">
            <!-- Header Row -->
            <div style="text-align: right; font-size: 1rem; font-weight: bold; color: var(--source-color);">{{ diff.source }}</div>
            <div style="font-size: 1rem; font-weight: bold;">&rarr;</div>
            <div style="font-size: 1rem; font-weight: bold; color: var(--target-color);">{{ diff.target }}</div>
            <div></div>
            
            <!-- Add Row -->
            <template v-if="stats?.added">
                <div class="vd-box has-val">{{ stats.added }}</div>
                <div></div>
                <div class="vd-box"></div>
                <div class="vd-op-label">hinzufügen</div>
            </template>
            
            <!-- Change Row -->
            <template v-if="stats?.changed">
                <div class="vd-box has-val">{{ stats.changed }}</div>
                <div class="vd-symbol">&ne;</div>
                <div class="vd-box has-val">{{ stats.changed }}</div>
                <div class="vd-op-label">ändern</div>
            </template>
            
            <!-- Unchanged Row -->
            <template v-if="stats?.unchanged">
                <div class="vd-box has-val">{{ stats.unchanged }}</div>
                <div class="vd-symbol">=</div>
                <div class="vd-box has-val">{{ stats.unchanged }}</div>
                <div class="vd-op-label">unverändert</div>
            </template>
            
            <!-- Remove Row -->
            <template v-if="stats?.removed">
                <div class="vd-box"></div>
                <div></div>
                <div class="vd-box has-val">{{ stats.removed }}</div>
                <div class="vd-op-label">löschen</div>
            </template>
        </div>
        <div v-else-if="stats === 'Error'" style="font-weight: bold; font-size: 1.2rem; color: var(--wa-color-danger-600); padding: 1.5rem 0;">
            Error
        </div>
    </div>
    

    
    <div slot="footer" style="display: flex; justify-content: flex-end; gap: 0.25rem; align-items: center; flex-wrap: wrap;">
        <!-- Custom tasks attached to diffs -->
        <template v-if="diff.actions">
            <wa-button v-for="act in diff.actions" :key="act.name" variant="neutral" size="small" @click="$emit('run-action', act, diff.name)" style="margin-right: auto;">
                {{ act.name }}
            </wa-button>
        </template>
        <div style="flex-grow: 1" v-if="!diff.actions || !diff.actions.length"></div>
        
        <wa-button title="Synchronisieren" variant="text" size="small" @click="$emit('sync', diff)" :disabled="loading">
            <wa-icon name="arrow-right-circle" style="font-size: 1rem; stroke: currentColor; stroke-width: 0.5px;"></wa-icon>
        </wa-button>
        
        <wa-button title="Details ansehen" variant="text" size="small" @click="$router.push('/diff/'+diff.name)">
            <wa-icon name="list" style="font-size: 1rem; stroke: currentColor; stroke-width: 0.5px;"></wa-icon>
        </wa-button>
        
        <wa-button title="Neu berechnen" variant="text" size="small" @click="$emit('refresh', diff.name, true)" :disabled="loading">
            <wa-icon name="arrow-clockwise" style="font-size: 1rem; stroke: currentColor; stroke-width: 0.5px;"></wa-icon>
        </wa-button>
    </div>
  </wa-card>
</template>

<script setup>
import { inject } from 'vue';
import { getBrandColor } from '../utils/brandColors.js';

const config = inject('synxConfig', { domains: [] });

defineProps({
  diff: { type: Object, required: true },
  stats: { type: [Object, String], default: () => ({}) },
  loading: { type: Boolean, default: false }
});
defineEmits(['run-action', 'refresh', 'sync']);
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
.visual-diff-card {
    display: flex;
    flex-direction: column;
}
.dashboard-card::part(header) {
    border-bottom: 3px solid transparent !important;
    border-image: linear-gradient(to right, var(--source-color, var(--wa-color-neutral-300)), var(--target-color, var(--wa-color-neutral-300))) 1 !important;
}
.vd-body {
    padding: 0;
    display: flex;
    justify-content: center;
}
.vd-grid {
    display: grid;
    grid-template-columns: minmax(50px, auto) auto minmax(50px, auto) auto;
    gap: 0.3rem 0.35rem;
    align-items: center;
}
.vd-box {
    border: 1px solid var(--wa-color-neutral-300);
    background-color: rgba(0, 0, 0, 0.025);
    min-width: 50px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--wa-color-neutral-800);
    box-sizing: border-box;
    border-radius: 6px;
    padding: 1rem;
}
.vd-box.has-val {
    color: var(--wa-color-primary-700);
    font-weight: 600;
}
.vd-op-label {
    padding-left: 0.25rem;
    color: var(--wa-color-neutral-600);
    font-size: 0.85rem;
}
.vd-symbol {
    font-weight: normal;
    text-align: center;
    padding: 0 0.15rem;
    color: var(--wa-color-neutral-500);
    font-size: 0.85rem;
}
</style>
