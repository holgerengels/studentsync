<template>
  <div :style="`--view-brand-color: ${domain.color || getBrandColor(domain.name)};`">
    <h2 style="border-bottom: 3px solid var(--view-brand-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">
      {{ domain.titel || domain.name }}
    </h2>
    
    <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; justify-content: space-between; align-items: center;">
        <div style="flex-grow: 1; max-width: 400px;">
            <wa-input :value="searchQuery" @wa-input="searchQuery = $event.target.value" @input="searchQuery = $event.target.value" placeholder="Suchen... (Text oder @klasse)" clearable>
                <wa-icon slot="prefix" name="search" title="Suche (live)"></wa-icon>
            </wa-input>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <template v-if="domain.actions && domain.actions.length">
                <wa-button v-for="act in domain.actions" :key="act.name" variant="neutral" size="small" @click="runAction(act)" :loading="actionLoading === act.name">
                    {{ act.name }}
                </wa-button>
            </template>
            <wa-button @click="refreshData" :loading="loading" variant="neutral" size="small">
                <wa-icon slot="prefix" name="arrow-clockwise"></wa-icon>
                Neu laden
            </wa-button>
        </div>
    </div>
    
    <div v-if="resultMessage" class="result-msg" v-html="resultMessage"></div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <wa-card v-if="identities.length" class="table-card">
        <table class="data-table">
            <thead>
                <tr>
                    <th v-for="key in displayKeys" :key="key" @click="toggleSort(key)" style="cursor: pointer; user-select: none; color: var(--view-brand-color);" class="sortable-header">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>{{ key }}</span>
                            <span v-if="sortKey === key" style="color: var(--view-brand-color);">
                                <wa-icon :name="sortAsc ? 'chevron-down' : 'chevron-up'"></wa-icon>
                            </span>
                            <span v-else style="color: transparent; font-size: 0.8em; opacity: 0.3;">
                                <wa-icon name="chevron-down"></wa-icon>
                            </span>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="ident in filteredAndSortedIdentities" :key="ident.userId || Math.random()">
                    <td v-for="key in displayKeys" :key="key">{{ ident[key] !== undefined && ident[key] !== null ? ident[key] : '-' }}</td>
                </tr>
            </tbody>
        </table>
        <div v-if="identities.length > 50" style="padding: 1rem; text-align: center; color: gray;">
            Showing 50 of {{ identities.length }} records...
        </div>
    </wa-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import { getBrandColor } from '../utils/brandColors.js';

const props = defineProps({
    domain: Object
});

const identities = ref([]);
const loading = ref(false);
const actionLoading = ref('');
const error = ref('');
const resultMessage = ref('');
const searchQuery = ref('');
const sortKey = ref('');
const sortAsc = ref(true);

onMounted(() => {
    fetchData(false);
});

watch(() => props.domain.name, () => {
    identities.value = [];
    fetchData(false);
});

async function refreshData() {
    resultMessage.value = '';
    await fetchData(true);
}

async function fetchData(forceRefresh) {
    loading.value = true;
    error.value = '';
    try {
        const url = `/api/identities/${props.domain.name}${forceRefresh ? '?refresh=true' : ''}`;
        const res = await axios.get(url);
        identities.value = res.data;
    } catch(e) {
        error.value = 'Failed to load identities from backend';
    } finally {
        loading.value = false;
    }
}

async function runAction(act) {
    const actionKey = act.endpoint || act.run || act.task;
    if (!actionKey) return;
    
    actionLoading.value = act.name;
    error.value = '';
    resultMessage.value = '';
    
    try {
        const res = await axios.post(actionKey.startsWith('/') ? actionKey : `/api/execute/${actionKey}`);
        resultMessage.value = res.data.html || `<span style="color:var(--wa-color-success-600)">Aktion ${act.name} ausgeführt</span>`;
        // Refresh domain data silently to reflect the new state
        await fetchData(true);
    } catch(e) {
        error.value = `Aktion ${act.name} fehlgeschlagen`;
    } finally {
        actionLoading.value = '';
    }
}

const displayKeys = computed(() => {
    if (identities.value.length === 0) return [];
    // Just gather keys from first item generically
    return Object.keys(identities.value[0]).filter(k => k !== '_id' && k !== '__v');
});

function toggleSort(key) {
    if (sortKey.value === key) {
        if (sortAsc.value) {
            sortAsc.value = false;
        } else {
            sortKey.value = '';
            sortAsc.value = true;
        }
    } else {
        sortKey.value = key;
        sortAsc.value = true;
    }
}

const filteredAndSortedIdentities = computed(() => {
    let result = identities.value;

    // Filter
    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        if (q.startsWith('@')) {
            const classQuery = q.substring(1).trim();
            result = result.filter(ident => {
                const classVal = String(ident.class || ident.klasse || ident.klasseId || ident.clazz || '').toLowerCase();
                return classVal.includes(classQuery);
            });
        } else {
            result = result.filter(ident => {
                const uid = String(ident.userId || ident.userid || '').toLowerCase();
                const fn = String(ident.firstName || ident.firstname || ident.vorname || '').toLowerCase();
                const ln = String(ident.lastName || ident.lastname || ident.nachname || '').toLowerCase();
                return uid.includes(q) || fn.includes(q) || ln.includes(q);
            });
        }
    }

    // Sort
    if (sortKey.value) {
        result = [...result].sort((a, b) => {
            let valA = a[sortKey.value] ?? '';
            let valB = b[sortKey.value] ?? '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (valA < valB) return sortAsc.value ? -1 : 1;
            if (valA > valB) return sortAsc.value ? 1 : -1;
            return 0;
        });
    }

    return result.slice(0, 50);
});
</script>

<style scoped>
.table-card {
    width: 100%;
    overflow-x: auto;
}
.data-table {
    width: 100%;
    border-collapse: collapse;
}
.data-table th, .data-table td {
    border: 1px solid var(--wa-color-neutral-200);
    padding: 0.5rem;
    text-align: left;
}
.data-table th {
    background-color: var(--wa-color-neutral-100);
}
.error {
    color: var(--wa-color-danger-600);
    margin-bottom: 1rem;
}
.result-msg {
    margin-bottom: 1rem;
    text-align: right;
    font-size: 0.95rem;
}
.sortable-header:hover span:last-child {
    color: var(--wa-color-neutral-400) !important;
}
</style>
