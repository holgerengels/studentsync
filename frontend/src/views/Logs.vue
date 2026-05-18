<template>
  <div class="logs">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2>Sync Logs</h2>
      <wa-button variant="neutral" @click="fetchLogs" :disabled="loading" size="small">
        <wa-icon name="arrow-clockwise" slot="prefix"></wa-icon> Aktualisieren
      </wa-button>
    </div>
    
    <div v-if="loading" style="display: flex; justify-content: center; padding: 2rem;">
      <wa-spinner style="font-size: 2rem;"></wa-spinner>
    </div>
    
    <div v-else>
      <wa-card style="width: 100%; margin-top: 1rem; overflow-x: auto;">
        <table class="log-table">
          <thead>
            <tr>
              <th>Startzeit</th>
              <th>Task</th>
              <th>Auslöser</th>
              <th>Status</th>
              <th>Dauer (ms)</th>
              <th>Zusammenfassung</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log._id">
              <td>{{ new Date(log.startTime).toLocaleString() }}</td>
              <td><wa-tag size="small">{{ log.task }}</wa-tag></td>
              <td>{{ log.trigger }}</td>
              <td>
                <wa-tag size="small" :variant="log.status === 'SUCCESS' ? 'success' : log.status === 'ERROR' ? 'danger' : 'warning'">
                  {{ log.status }}
                </wa-tag>
              </td>
              <td>{{ log.durationMs || '-' }}</td>
              <td>
                <span class="diff-summary" v-html="log.summaryHtml || '-'"></span>
              </td>
              <td>
                <wa-button 
                   variant="text" 
                   size="small" 
                   @click.stop.prevent="showDetails(log)"
                   :title="log.details ? 'Details / Diffs ansehen' : 'Keine Details vorhanden'">
                  <wa-icon name="list" style="font-size: 1.1rem;"></wa-icon>
                </wa-button>
              </td>
            </tr>
            <tr v-if="logs.length === 0">
              <td colspan="7" style="text-align: center; padding: 2rem;">Keine Logs gefunden.</td>
            </tr>
          </tbody>
        </table>
      </wa-card>
      
      <div v-if="totalPages > 1" style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem;">
        <wa-button variant="neutral" size="small" :disabled="currentPage <= 1 || loading" @click="changePage(currentPage - 1)">
          <wa-icon name="chevron-left" slot="prefix"></wa-icon> Zurück
        </wa-button>
        <span style="font-size: 0.9em; color: var(--wa-color-neutral-600);">Seite {{ currentPage }} von {{ totalPages }} ({{ totalLogs }} Einträge)</span>
        <wa-button variant="neutral" size="small" :disabled="currentPage >= totalPages || loading" @click="changePage(currentPage + 1)">
          Weiter <wa-icon name="chevron-right" slot="suffix"></wa-icon>
        </wa-button>
      </div>
    </div>

    <wa-drawer :open="isDrawerOpen" @wa-after-hide="isDrawerOpen = false" label="Log Details & Diffs" style="--size: 80vw;">
      <div v-if="selectedLog">
        <div style="margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap;">
           <strong>ID:</strong> {{ selectedLog._id }}
           <strong>Task:</strong> {{ selectedLog.task }}
           <strong>Beginn:</strong> {{ new Date(selectedLog.startTime).toLocaleString() }}
           <strong>Status:</strong> {{ selectedLog.status }}
        </div>
        
        <div v-if="!selectedLog.details || Object.keys(selectedLog.details).length === 0">
           <p style="color: #666;">Für diesen Eintrag liegen keine tiefergehenden Daten oder Diffs vor (möglicherweise älter als 14 Tage und bereits bereinigt).</p>
        </div>
        <div v-else>
           <pre class="json-viewer">{{ JSON.stringify(selectedLog.details, null, 2) }}</pre>
        </div>
      </div>
    </wa-drawer>

  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import axios from 'axios';

const logs = ref([]);
const loading = ref(false);

const currentPage = ref(1);
const totalPages = ref(1);
const totalLogs = ref(0);
const limit = 50;

const isDrawerOpen = ref(false);
const selectedLog = ref(null);

const fetchLogs = async (page = 1) => {
  loading.value = true;
  try {
    const res = await axios.get(`http://localhost:3001/api/logs?page=${page}&limit=${limit}`);
    logs.value = res.data.data;
    currentPage.value = res.data.page;
    totalPages.value = res.data.pages;
    totalLogs.value = res.data.total;
  } catch(e) {
    console.error('Fehler beim Laden der Logs:', e);
  } finally {
    loading.value = false;
  }
};

const changePage = (newPage) => {
  if (newPage >= 1 && newPage <= totalPages.value) {
    fetchLogs(newPage);
  }
};

const showDetails = (log) => {
  selectedLog.value = log;
  isDrawerOpen.value = true;
};

onMounted(() => {
  fetchLogs();
});
</script>

<style scoped>
.log-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.log-table th, .log-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
}
.log-table th {
  background: #fafafa;
  font-weight: 600;
}
.log-table tr:hover {
  background: #f9f9f9;
}
.diff-summary {
  display: inline-flex;
  gap: 0.5rem;
  font-weight: bold;
}
.diff-add { color: #10B981; }
.diff-change { color: #F59E0B; }
.diff-remove { color: #EF4444; }

.json-viewer {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 50vh;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9rem;
}

/* Fix width handling for WA card */
wa-card::part(base) {
  padding: 0;
}
wa-card::part(body) {
  padding: 0;
}
</style>
