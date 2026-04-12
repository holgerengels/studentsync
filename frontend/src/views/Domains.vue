<template>
  <div class="domains">
    <h2>Domains Übersicht</h2>
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <wa-select placeholder="Domain auswählen" @wa-change="loadDomain($event.target.value, false)" @change="loadDomain($event.target.value, false)" :value="selectedDomain">
        <wa-option value="asv">ASV</wa-option>
        <wa-option value="untis">Untis</wa-option>
        <wa-option value="webuntis">WebUntis</wa-option>
        <wa-option value="schulkonsole">Schulkonsole</wa-option>
      </wa-select>
      <wa-button variant="neutral" @click="loadDomain(selectedDomain, true)" :disabled="!selectedDomain || loading">
        <wa-icon name="arrow-clockwise" slot="prefix"></wa-icon> Aktualisieren
      </wa-button>
    </div>
    
    <div v-if="loading" style="margin-top: 2rem; display: flex; align-items: center; gap: 1rem; font-size: 1.2rem;">
      <wa-spinner style="font-size: 2rem;"></wa-spinner> Lade Identities...
    </div>
    
    <wa-card v-if="identities.length && !loading" style="margin-top: 2rem; width: 100%">
      <div slot="header" style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: bold; text-transform: uppercase;">{{ selectedDomain }} Identities ({{ filteredAndSortedIdentities.length }} / {{ identities.length }})</span>
        <wa-input v-model="filterText" placeholder="Suche nach Name oder @klasse" style="width: 300px;">
          <wa-icon name="search" slot="prefix"></wa-icon>
        </wa-input>
      </div>
      
      <div style="max-height: 600px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead style="position: sticky; top: 0; background: white; z-index: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr style="border-bottom: 2px solid #ccc;">
              <th @click="setSort('account')" style="padding: 12px; cursor: pointer; user-select: none;">
                Account <span v-if="sortKey==='account'">{{sortAsc?'▲':'▼'}}</span>
              </th>
              <th @click="setSort('firstName')" style="padding: 12px; cursor: pointer; user-select: none;">
                Vorname <span v-if="sortKey==='firstName'">{{sortAsc?'▲':'▼'}}</span>
              </th>
              <th @click="setSort('lastName')" style="padding: 12px; cursor: pointer; user-select: none;">
                Nachname <span v-if="sortKey==='lastName'">{{sortAsc?'▲':'▼'}}</span>
              </th>
              <th @click="setSort('clazz')" style="padding: 12px; cursor: pointer; user-select: none;">
                Klasse <span v-if="sortKey==='clazz'">{{sortAsc?'▲':'▼'}}</span>
              </th>
              <th @click="setSort('birthday')" style="padding: 12px; cursor: pointer; user-select: none;">
                Geburtstag <span v-if="sortKey==='birthday'">{{sortAsc?'▲':'▼'}}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="id in filteredAndSortedIdentities.slice(0, 250)" :key="id.account" style="border-bottom: 1px solid #efefef;">
              <td style="padding: 8px;"><strong>{{ id.account || id.id }}</strong></td>
              <td style="padding: 8px;">{{ id.firstName }}</td>
              <td style="padding: 8px;">{{ id.lastName }}</td>
              <td style="padding: 8px;">
                <wa-badge v-if="id.clazz" variant="neutral">{{ id.clazz }}</wa-badge>
              </td>
              <td style="padding: 8px;">{{ id.birthday }}</td>
            </tr>
            <tr v-if="filteredAndSortedIdentities.length > 250">
              <td colspan="5" style="padding: 16px; text-align: center; color: #666; font-style: italic;">
                ... und {{ filteredAndSortedIdentities.length - 250 }} weitere Treffer. Bitte verfeinere die Suche.
              </td>
            </tr>
            <tr v-if="filteredAndSortedIdentities.length === 0">
              <td colspan="5" style="padding: 16px; text-align: center; color: #666;">
                Keine Identities passend zum Filter gefunden.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </wa-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';

const selectedDomain = ref('');
const identities = ref([]);
const loading = ref(false);

const filterText = ref('');
const sortKey = ref('account');
const sortAsc = ref(true);

const loadDomain = async (domain, force = false) => {
  if (!domain) return;
  selectedDomain.value = domain;
  loading.value = true;
  if (force) { identities.value = []; }
  filterText.value = ''; // Reset filter on domain switch
  
  try {
    const res = await axios.get(`http://localhost:3001/api/identities/${domain}${force ? '?refresh=true' : ''}`);
    identities.value = res.data;
  } catch (err) {
    console.error(err);
    alert('Fehler beim Laden der Domain');
  } finally {
    loading.value = false;
  }
};

const setSort = (key) => {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortKey.value = key;
    sortAsc.value = true;
  }
};

const filteredAndSortedIdentities = computed(() => {
  let result = identities.value;

  // 1. Filter
  const ft = filterText.value.trim().toLowerCase();
  if (ft) {
    if (ft.startsWith('@')) {
      const classFilter = ft.substring(1);
      result = result.filter(id => id.clazz && id.clazz.toLowerCase().includes(classFilter));
    } else {
      result = result.filter(id => 
        (id.account && id.account.toLowerCase().includes(ft)) ||
        (id.firstName && id.firstName.toLowerCase().includes(ft)) ||
        (id.lastName && id.lastName.toLowerCase().includes(ft))
      );
    }
  }

  // 2. Sort
  result = result.slice().sort((a, b) => {
    let valA = a[sortKey.value] || '';
    let valB = b[sortKey.value] || '';
    
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortAsc.value ? -1 : 1;
    if (valA > valB) return sortAsc.value ? 1 : -1;
    return 0;
  });

  return result;
});
</script>

<style scoped>
.domains {
  padding-bottom: 2rem;
}
tbody tr:hover {
  background-color: #f9f9f9;
}
</style>
