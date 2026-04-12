<template>
  <div>
    <h2>Diff: {{ diff.titel || diff.name }}</h2>
    
    <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
        <wa-button @click="calculateDiff(true)" :loading="loading" variant="neutral" size="small">
            <wa-icon slot="prefix" name="arrow-clockwise"></wa-icon>
            Force Refresh Backend Data
        </wa-button>
        <wa-button @click="runSync" :loading="syncLoading" variant="primary" size="small">Run Sync Task</wa-button>
    </div>
    
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="syncResultHtml" class="sync-result" v-html="syncResultHtml"></div>
    
    <wa-card v-if="report && report.diff" style="margin-top: 2rem;">
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
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';

const props = defineProps({
    diff: Object
});

const report = ref(null);
const loading = ref(false);
const syncLoading = ref(false);
const error = ref('');
const syncResultHtml = ref('');

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
    syncResultHtml.value = '';
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
    syncLoading.value = true;
    error.value = '';
    try {
        const [source, target] = props.diff.name.split('-');
        const res = await axios.post(`/api/sync/${source}/${target}`);
        syncResultHtml.value = res.data.html;
        
        // Optionally refresh diff view afterwards to reflect state
        await calculateDiff(true);
    } catch(e) {
        error.value = 'Sync failed';
    } finally {
        syncLoading.value = false;
    }
}
</script>

<style scoped>
.error {
    color: var(--wa-color-danger-600);
}
.sync-result {
    padding: 1rem;
    background: #eef;
    border-radius: 4px;
    margin-bottom: 1rem;
}
</style>
