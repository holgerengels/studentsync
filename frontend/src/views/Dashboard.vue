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
         @run-action="runAction" 
         @refresh="refreshDomain" />
      
      <!-- Visual Diff Cards -->
      <DiffCard 
         v-for="df in config?.diffs" :key="df.name"
         :diff="df"
         :stats="diffStats[df.name]"
         :loading="loading[df.name]"
         @run-action="runAction"
         @refresh="refreshDiff"
         @sync="runSync" />
    </div>
    
    <!-- Generic Action Report Dialog -->
    <wa-dialog :label="reportDialogTitle" :open="isDialogOpen" @wa-after-hide="isDialogOpen = false" style="--width: 800px; --body-spacing: 0;">
      
      <!-- Standard HTML Reports -->
      <div v-if="reportDialogContent" v-html="reportDialogContent" style="padding: 1rem; font-size: 0.9em;"></div>

      <div slot="footer" style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <wa-button variant="neutral" @click="isDialogOpen = false">Schließen</wa-button>
      </div>
    </wa-dialog>

    <RemnantsDialog 
        :open="isRemnantsDialogOpen" 
        @update:open="val => isRemnantsDialogOpen = val" 
        :remnants="reportDialogRemnants"
    />

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import DomainCard from '../components/DomainCard.vue';
import DiffCard from '../components/DiffCard.vue';
import RemnantsDialog from '../components/RemnantsDialog.vue';
import { useToast } from '../composables/useToast';

const props = defineProps({
    config: Object
});

const loading = ref({});
const counts = ref({});
const diffStats = ref({});
const actionLoading = ref('');
const error = ref('');

const isDialogOpen = ref(false);
const isRemnantsDialogOpen = ref(false);
const reportDialogTitle = ref('');
const reportDialogContent = ref('');
const reportDialogRemnants = ref([]);

const toast = useToast();

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
    try {
        const [source, target] = diffName.split('-');
        const url = `/api/diff/${source}/${target}` + (forceRefresh ? '?refresh=true' : '');
        const res = await axios.post(url);
        if (res.data && res.data.summary) {
            diffStats.value[diffName] = res.data.summary;
        }
    } catch(e) {
        diffStats.value[diffName] = 'Error';
        const explanation = e.response?.data?.error || e.message;
        toast.danger(`Diff Fehler: ${explanation}`);
    } finally {
        loading.value[diffName] = false;
    }
}

onMounted(async () => {
    if (!props.config) return;
    if (props.config.domains) {
        props.config.domains.forEach(d => {
            axios.get(`/api/identities/${d.name}`)
                .then(res => {
                    counts.value[d.name] = res.data?.length || 0;
                })
                .catch(e => {
                    counts.value[d.name] = 'Error';
                    const explanation = e.response?.data?.error || e.message;
                    toast.danger(`Fehler beim Laden von ${d.name}: ${explanation}`);
                });
        });
    }
    if (props.config.diffs) {
        for (const df of props.config.diffs) {
            refreshDiff(df.name, false);
        }
    }
});

async function refreshDomain(name) {
    loading.value[name] = true;
    try {
        const res = await axios.get(`/api/identities/${name}?refresh=true`);
        counts.value[name] = res.data?.length || 0;
        
        if (props.config && props.config.diffs) {
            for (const df of props.config.diffs) {
                if (df.name.split('-').includes(name)) {
                    refreshDiff(df.name, true);
                }
            }
        }
    } catch(e) {
        counts.value[name] = 'Error';
        const explanation = e.response?.data?.error || e.message;
        toast.danger(`Refresh failed (${name}): ${explanation}`);
    } finally {
        loading.value[name] = false;
    }
}

async function runSync(df) {
    const diffName = df.name;
    loading.value[diffName] = true;
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
        
        toast.success(`Sync finished`);
        
        // Auto-invalidate and refresh the target domain count
        refreshDomain((df.target || df.name.split('-')[1]).toLowerCase());
        
        // Auto-invalidate and recalculate the diff card
        refreshDiff(diffName, true);
        
    } catch(e) {
        const explanation = e.response?.data?.error || e.message;
        toast.danger(`Sync Failed: ${explanation}`);
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
        }
        
        const reqTaskName = actionKey.startsWith('/') ? actionKey.split('/').pop() : actionKey;
        const res = await axios.post(actionKey.startsWith('/') ? actionKey : `/api/execute/${actionKey}`);
        
        // Handle Blob Downloads
        if (act.download && res.data && res.data.report && res.data.report.csvData) {
            const blob = new Blob([res.data.report.csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.setAttribute('download', res.data.report.filename || 'export.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        }
        
        // Open Dialog configuration
        reportDialogTitle.value = act.name || 'Aktionsbericht';
        reportDialogContent.value = '';
        reportDialogRemnants.value = [];

        // Dedizierte Remnants View Logik
        if (reqTaskName === 'nextcloud-remnants-list' && res.data?.report?.remnants) {
            reportDialogRemnants.value = res.data.report.remnants;
            isRemnantsDialogOpen.value = true;
        } 
        // Generischer Html / Text output View 
        else if (res.data?.report?.dialogHtml) {
            reportDialogContent.value = res.data.report.dialogHtml;
            isDialogOpen.value = true;
        }
        
        if (contextName) {
            toast.success(`Aktion ausgeführt`);
            
            // Auto reload contextual layout
            if (contextName.includes('-')) {
                // It's a diff view, just refresh diff
                refreshDiff(contextName, true);
            } else {
                refreshDomain(contextName);
                
                // Diff tables connected to this domain also likely changed!
                if(props.config && props.config.diffs) {
                    for(const df of props.config.diffs) {
                        if(df.name.split('-').includes(contextName)) {
                            refreshDiff(df.name, true);
                        }
                    }
                }
            }
        } else {
            toast.show(`Executed ${act.name} successfully`, 'success');
        }
    } catch(e) {
        const explanation = e.response?.data?.error || e.message;
        toast.danger(`Failed to execute ${act.name}: ${explanation}`);
    } finally {
        if (contextName) loading.value[contextName] = false;
    }
}
</script>

<style scoped>
.card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
}
</style>
