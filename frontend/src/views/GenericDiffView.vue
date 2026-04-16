<template>
  <div :style="`--source-color: ${getBrandColor(diff.source || diff.name?.split('-')[0], config)}; --target-color: ${getBrandColor(diff.target || diff.name?.split('-')[1], config)};`">
    <h2 style="border-bottom: 3px solid transparent; border-image: linear-gradient(to right, var(--source-color), var(--target-color)) 1; padding-bottom: 0.5rem; margin-bottom: 1rem;">
      <span style="color: var(--source-color);">{{ diff.source || diff.name?.split('-')[0] }}</span>
      <span style="color: var(--wa-color-neutral-500); margin: 0 0.5rem;">&rarr;</span>
      <span style="color: var(--target-color);">{{ diff.target || diff.name?.split('-')[1] }}</span>
    </h2>
    
    <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; justify-content: space-between; align-items: center;">
        <div style="flex-grow: 1;"></div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <template v-if="diff.actions && diff.actions.length">
                <wa-button v-for="act in diff.actions" :key="act.name" variant="neutral" size="small" @click="runAction(act)" :loading="actionLoading === act.name">
                    {{ act.name }}
                </wa-button>
            </template>
            <wa-button @click="runSync" :loading="actionLoading === 'sync'" variant="primary" size="small">
                <wa-icon slot="prefix" name="arrow-right-circle"></wa-icon>
                Synchronisieren
            </wa-button>
            <wa-button @click="calculateDiff(true)" :loading="loading" variant="neutral" size="small">
                <wa-icon slot="prefix" name="arrow-clockwise"></wa-icon>
                Neu berechnen
            </wa-button>
        </div>
    </div>
    
    <div v-if="resultMessage" class="result-msg" v-html="resultMessage"></div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <wa-card v-if="report && report.diff" class="table-card">
        <div style="display: flex; gap: 2rem;">
            <div>
                 <h3 style="color: var(--wa-color-success-600)">Added ({{ report.diff.added.length }})</h3>
                 <ul>
                     <li v-for="item in report.diff.added.slice(0, 20)">{{ item.userId }} - {{ item.lastName }}</li>
                 </ul>
            </div>
            <div>
                 <h3 style="color: var(--wa-color-warning-600)">Changed ({{ report.diff.changed.length }})</h3>
                 <ul>
                     <li v-for="item in report.diff.changed.slice(0, 20)">{{ item.source.userId }} - {{ item.source.lastName }}</li>
                 </ul>
            </div>
            <div>
                 <h3 style="color: var(--wa-color-danger-600)">Removed ({{ report.diff.removed.length }})</h3>
                 <ul>
                     <li v-for="item in report.diff.removed.slice(0, 20)">{{ item.userId }} - {{ item.lastName }}</li>
                 </ul>
            </div>
        </div>
        <div style="padding: 1rem; color: gray;" v-if="report.diff.added.length > 20 || report.diff.changed.length > 20 || report.diff.removed.length > 20">
            Preview limited to 20 items per section.
        </div>
    </wa-card>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, inject } from 'vue';
import axios from 'axios';
import { getBrandColor } from '../utils/brandColors.js';

const config = inject('synxConfig', { domains: [] });

const props = defineProps({
    diff: Object
});

const report = ref(null);
const loading = ref(false);
const actionLoading = ref('');
const error = ref('');
const resultMessage = ref('');

onMounted(() => {
    calculateDiff(false);
});

watch(() => props.diff.name, () => {
    report.value = null;
    calculateDiff(false);
});

async function calculateDiff(refresh) {
    loading.value = true;
    error.value = '';
    resultMessage.value = '';
    try {
        const [source, target] = props.diff.name.split('-');
        const res = await axios.post(`/api/diff/${source}/${target}${refresh ? '?refresh=true' : ''}`);
        report.value = res.data.report;
    } catch(e) {
        error.value = 'Failed to calculate diff';
    } finally {
        loading.value = false;
    }
}

async function runSync() {
    actionLoading.value = 'sync';
    error.value = '';
    resultMessage.value = '';
    try {
        const [source, target] = props.diff.name.split('-');
        const res = await axios.post(`/api/sync/${source}/${target}`);
        resultMessage.value = res.data.html || '<span style="color:var(--wa-color-success-600)">Synchronisierung erfolgreich</span>';
        
        await calculateDiff(true);
    } catch(e) {
        error.value = 'Sync fehlgeschlagen';
    } finally {
        actionLoading.value = '';
    }
}

async function runAction(act) {
    if (act.download) {
        window.open(`/api/execute/${act.download}`, '_blank');
        return;
    }
    const actionKey = act.endpoint || act.run || act.task;
    if (!actionKey) return;
    
    actionLoading.value = act.name;
    error.value = '';
    resultMessage.value = '';
    
    try {
        const res = await axios.post(actionKey.startsWith('/') ? actionKey : `/api/execute/${actionKey}`);
        resultMessage.value = res.data.html || `<span style="color:var(--wa-color-success-600)">Aktion ${act.name} ausgeführt</span>`;
        await calculateDiff(true);
    } catch(e) {
        error.value = `Aktion ${act.name} fehlgeschlagen`;
    } finally {
        actionLoading.value = '';
    }
}
</script>

<style scoped>
.error {
    color: var(--wa-color-danger-600);
    margin-bottom: 1rem;
}
.result-msg {
    margin-bottom: 1rem;
    text-align: right;
    font-size: 0.95rem;
}
.table-card {
    width: 100%;
    overflow-x: auto;
}
</style>
