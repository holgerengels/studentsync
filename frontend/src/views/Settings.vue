<template>
  <div class="settings">
    <h2>Einstellungen</h2>
    <p>Hier können Konfigurationen für die verschiedenen Systeme hinterlegt werden (z.B. API Keys, URLs).</p>
    
    <wa-card style="width: 100%; margin-top: 1rem;">
      <div slot="header">Allgemeine Einstellungen</div>
      <wa-input label="Schuljahr" value="2025/26"></wa-input>
      <br />
      <wa-button variant="primary" @click="save">Speichern (Mock)</wa-button>
    </wa-card>
  </div>
</template>

<script setup>
const save = () => {
  alert('Speichern ist derzeit noch deaktiviert (Read-Only Modus).');
};
</script>
