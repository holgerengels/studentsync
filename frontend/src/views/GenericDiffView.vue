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
        <div class="table-container">
            <table class="diff-table">
                <thead>
                    <tr>
                        <th style="width: 50px; text-align: center;"></th>
                        <th>ID</th>
                        <th>Vorname</th>
                        <th>Nachname</th>
                        <th v-for="prop in extraProps" :key="prop">{{ formatPropName(prop) }}</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Added -->
                    <tr v-for="item in report.diff.added" :key="'add-'+item.userId" class="diff-row diff-added">
                        <td class="diff-action" title="Hinzugefügt">
                            <wa-icon name="plus-circle-fill" style="color: var(--wa-color-success-600)"></wa-icon>
                        </td>
                        <td>{{ item.userId }}</td>
                        <td>{{ item.firstName }}</td>
                        <td>{{ item.lastName }}</td>
                        <td v-for="prop in extraProps" :key="prop">{{ item[prop] }}</td>
                    </tr>
                    
                    <!-- Changed -->
                    <tr v-for="change in report.diff.changed" :key="'change-'+change.source.userId" class="diff-row diff-changed">
                        <td class="diff-action" title="Geändert">
                            <wa-icon name="pencil-fill" style="color: var(--wa-color-warning-600)"></wa-icon>
                        </td>
                        <td>{{ change.source.userId }}</td>
                        
                        <td :class="{'is-modified': change.source.firstName !== change.target.firstName}">
                            <div v-if="change.source.firstName !== change.target.firstName" class="old-val">{{ change.target.firstName || '-' }}</div> → 
                            <div class="new-val">{{ change.source.firstName || '-' }}</div>
                        </td>
                        
                        <td :class="{'is-modified': change.source.lastName !== change.target.lastName}">
                            <div v-if="change.source.lastName !== change.target.lastName" class="old-val">{{ change.target.lastName || '-' }}</div> → 
                            <div class="new-val">{{ change.source.lastName || '-' }}</div>
                        </td>
                        
                        <td v-for="prop in extraProps" :key="prop" :class="{'is-modified': change.source[prop] !== change.target[prop]}">
                            <div v-if="change.source[prop] !== change.target[prop]" class="old-val">{{ change.target[prop] || '-' }}</div> → 
                            <div class="new-val">{{ change.source[prop] || '-' }}</div>
                        </td>
                    </tr>

                    <!-- Removed -->
                    <tr v-for="item in report.diff.removed" :key="'rm-'+item.userId" class="diff-row diff-removed">
                        <td class="diff-action" title="Entfernt">
                            <wa-icon name="dash-circle-fill" style="color: var(--wa-color-danger-600)"></wa-icon>
                        </td>
                        <td>{{ item.userId }}</td>
                        <td>{{ item.firstName }}</td>
                        <td>{{ item.lastName }}</td>
                        <td v-for="prop in extraProps" :key="prop">{{ item[prop] }}</td>
                    </tr>
                    
                    <tr v-if="!report.diff.added.length && !report.diff.changed.length && !report.diff.removed.length">
                        <td :colspan="4 + extraProps.length" style="text-align: center; padding: 2rem; color: var(--wa-color-neutral-500);">
                            Keine Änderungen gefunden.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </wa-card>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, inject, computed } from 'vue';
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

const extraProps = computed(() => {
    if (!report.value || !report.value.intersectedProperties) return [];
    return report.value.intersectedProperties.filter(p => !['userId', 'firstName', 'lastName'].includes(p));
});

function formatPropName(prop) {
    const names = {
        'birthday': 'Geburtsdatum',
        'clazz': 'Klasse',
        'gender': 'Geschlecht',
        'email': 'E-Mail'
    };
    return names[prop] || prop;
}

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
}
.table-container {
    width: 100%;
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid var(--wa-color-neutral-200);
}
.diff-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
    text-align: left;
}
.diff-table th {
    background-color: var(--wa-color-neutral-100);
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: var(--wa-color-neutral-700);
    border-bottom: 2px solid var(--wa-color-neutral-200);
    white-space: nowrap;
}
.diff-table td {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--wa-color-neutral-100);
    vertical-align: middle;
}
.diff-table tbody tr:hover {
    background-color: var(--wa-color-neutral-90);
}
.diff-action {
    text-align: center;
    font-size: 1.1rem;
}
.diff-added td {
    background-color: rgba(16, 185, 129, 0.05); /* success ultra-light */
}
.diff-removed td {
    background-color: rgba(239, 68, 68, 0.05); /* danger ultra-light */
    text-decoration: line-through;
    color: var(--wa-color-neutral-500);
}
.diff-removed .diff-action {
    text-decoration: none;
}
.is-modified {
    background-color: rgba(245, 158, 11, 0.1); /* warning ultra-light */
    border-radius: 4px;
}
.old-val {
    text-decoration: line-through;
    color: var(--wa-color-neutral-500);
    margin-bottom: 0.15rem;
}
.new-val {
    color: var(--wa-color-neutral-900);
    font-weight: 500;
}
.old-val, .new-val {
    display: inline-block;
}
</style>
