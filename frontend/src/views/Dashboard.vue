<template>
  <div style="margin-top: -0.5rem;">
    <!-- h2 Dashboard removed to save space, contextual info is already clear -->
    
    <div class="card-grid">
      <!-- Domain Cards -->
      <DomainCard 
         v-for="d in config?.domains" :key="d.name"
         :domain="d" 
         :count="counts[d.name]" 
         :loading="loading[d.name]" 
         :result="results[d.name]"
         @run-action="runAction" 
         @refresh="refreshDomain" />
      
      <!-- Visual Diff Cards -->
      <DiffCard 
         v-for="df in config?.diffs" :key="df.name"
         :diff="df"
         :stats="diffStats[df.name]"
         :loading="loading[df.name]"
         :result="results[df.name]"
         @run-action="runAction"
         @refresh="refreshDiff"
         @sync="runSync" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import DomainCard from '../components/DomainCard.vue';
import DiffCard from '../components/DiffCard.vue';

const props = defineProps({
    config: Object
});

const loading = ref({});
const results = ref({});
const counts = ref({});
const diffStats = ref({});
const actionLoading = ref('');
const error = ref('');

function formatTitel(titelString) {
    if (titelString.includes('—>')) {
        return titelString.split('—>').map(s => s.trim());
    } else if (titelString.includes('->')) {
        return titelString.split('->').map(s => s.trim());
    } else if (titelString.includes('-')) {
        return titelString.split('-').map(s => s.trim());
    }
    return [titelString, '?'];
}

async function refreshDiff(diffName, forceRefresh = false) {
    loading.value[diffName] = true;
    results.value[diffName] = '';
    try {
        const [source, target] = diffName.split('-');
        const url = `/api/diff/${source}/${target}` + (forceRefresh ? '?refresh=true' : '');
        const res = await axios.post(url);
        if (res.data && res.data.summary) {
            diffStats.value[diffName] = res.data.summary;
        }
    } catch(e) {
        results.value[diffName] = `<span style="color:red">Diff Calc Failed</span>`;
    } finally {
        loading.value[diffName] = false;
    }
}

onMounted(async () => {
    if (!props.config) return;
    if (props.config.domains) {
        for (const d of props.config.domains) {
            try {
                const res = await axios.get(`/api/identities/${d.name}`);
                counts.value[d.name] = res.data?.length || 0;
            } catch (e) {
                counts.value[d.name] = 'Error';
            }
        }
    }
    if (props.config.diffs) {
        for (const df of props.config.diffs) {
            refreshDiff(df.name, false);
        }
    }
});

async function refreshDomain(name) {
    loading.value[name] = true;
    results.value[name] = '';
    try {
        const res = await axios.get(`/api/identities/${name}?refresh=true`);
        results.value[name] = 'Refreshed successfully';
        counts.value[name] = res.data?.length || 0;
    } catch(e) {
        results.value[name] = 'Refresh failed';
    } finally {
        loading.value[name] = false;
    }
}

async function runSync(df) {
    const diffName = df.name;
    loading.value[diffName] = true;
    results.value[diffName] = '';
    try {
        let taskName = '';
        if (props.config && props.config.tasks) {
            const t = props.config.tasks.find(x => x.class === 'SyncTask' && x.source === df.source && x.target === df.target);
            if (t) taskName = t.name;
        }
        
        let res;
        if (taskName) {
            res = await axios.post(`/api/execute/${taskName}?refresh=true`);
        } else {
            const parts = diffName.split('-');
            res = await axios.post(`/api/sync/${parts[0]}/${parts[1]}?refresh=true`);
        }
        
        results.value[diffName] = res.data.html || 'Sync finished';
        
        // Auto-invalidate and refresh the target domain count
        refreshDomain((df.target || df.name.split('-')[1]).toLowerCase());
        
        // Auto-invalidate and recalculate the diff card
        refreshDiff(diffName, true);
        
    } catch(e) {
        results.value[diffName] = `<span style="color:var(--wa-color-danger-600)">Sync Failed</span>`;
    } finally {
        loading.value[diffName] = false;
    }
}

async function runAction(act, contextName) {
    const actionKey = act.download || act.endpoint || act.run || act.task;
    if (!actionKey) return;
    
    actionLoading.value = act.name;
    error.value = '';
    
    try {
        if (contextName) {
            loading.value[contextName] = true;
            results.value[contextName] = '';
        }
        
        const res = await axios.post(actionKey.startsWith('/') ? actionKey : `/api/execute/${actionKey}`);
        
        // Handle Blob Downloads
        if (act.download && res.data && res.data.report && res.data.report.csvData) {
            const blob = new Blob([res.data.report.csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', res.data.report.filename || 'export.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        if (contextName) {
            results.value[contextName] = res.data.html || `<span style="color:var(--wa-color-success-600)">Aktion ausgeführt</span>`;
            
            // Auto reload contextual layout
            if (contextName.includes('-')) {
                // It's a diff view, just refresh diff
                refreshDiff(contextName, true);
            } else {
                refreshDomain(contextName);
                
                // Diff tables connected to this domain also likely changed!
                if(props.config && props.config.diffs) {
                    for(const df of props.config.diffs) {
                        if(df.name.includes(contextName)) {
                            refreshDiff(df.name, true);
                        }
                    }
                }
            }
        } else {
            alert(`Executed ${act.name} successfully`);
        }
    } catch(e) {
        if (contextName) {
            results.value[contextName] = `<span style="color:var(--wa-color-danger-600)">Aktion fehlgeschlagen</span>`;
        } else {
            alert(`Failed to execute ${act.name}`);
        }
    } finally {
        if (contextName) loading.value[contextName] = false;
    }
}
</script>

<style scoped>
.card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
}
</style>
