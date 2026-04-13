<template>
  <wa-card class="dashboard-card visual-diff-card">
    <div slot="header" style="font-size: 1.1rem; font-weight: bold;">
        {{ diff.titel }}
    </div>
    
    <div class="vd-body">
        <div class="vd-grid">
            <!-- Header Row -->
            <div style="text-align: right; font-size: 0.9rem;">{{ diff.source }}</div>
            <div style="font-size: 0.9rem;">&rarr;</div>
            <div style="font-size: 0.9rem">{{ diff.target }}</div>
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
    </div>
    
    <div v-if="result" class="result-msg" v-html="result"></div>
    
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
defineProps({
  diff: { type: Object, required: true },
  stats: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  result: { type: String, default: '' }
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
.vd-body {
    padding: 0;
    display: flex;
    justify-content: center;
}
.vd-grid {
    display: grid;
    grid-template-columns: minmax(50px, max-content) auto minmax(50px, max-content) auto;
    gap: 0.2rem 0.35rem;
    align-items: center;
}
.vd-grid .header {
    font-weight: bold;
    text-align: center;
    color: var(--wa-color-neutral-800);
    margin-bottom: 0.25rem;
    font-size: 0.95rem;
}
.vd-box {
    border: 1px solid var(--wa-color-neutral-400);
    background-color: var(--wa-color-neutral-50);
    min-width: 50px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--wa-color-neutral-800);
    box-sizing: border-box;
    border-radius: 2px;
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
.result-msg {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: var(--wa-color-success-600);
}
</style>
