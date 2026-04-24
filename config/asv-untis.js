module.exports = {
    // Condition function to inspect the result of asv-untis-sync
    inspectAsvUntisDiff: async function (details) {
        // Die Bedingung ist immer 'true', da maintainTicket die Überprüfung
        // übernimmt und ggf. bestehende Tickets schließt.
        return true;
    },

    maintainTicket: async function (details) {
        console.log('[Hook] maintainTicket triggered for ASV-Untis sync');

        const axios = require('axios');
        let diff = null;
        if (details && details.diff) {
            diff = details.diff;
        }

        let needsManualAction = false;
        let description = '<p><strong>Folgende Änderungen aus ASV müssen in Untis übernommen werden:</strong></p><ul>';

        if (diff && diff.added && diff.added.length > 0) {
            needsManualAction = true;
            const addedNames = diff.added.map(i => i.userId || i.name || 'Unbekannt').join(', ');
            description += `<li><strong>Hinzufügen:</strong> ${addedNames}</li>`;
        }

        if (diff && diff.removed && diff.removed.length > 0) {
            needsManualAction = true;
            const removedNames = diff.removed.map(i => i.userId || i.name || 'Unbekannt').join(', ');
            description += `<li><strong>Löschen:</strong> ${removedNames}</li>`;
        }

        if (diff && diff.changed && diff.changed.length > 0) {
            const classChanges = diff.changed.filter(c => {
                const tClass = c.target && c.target.classes ? c.target.classes : (c.target && c.target.group);
                const sClass = c.source && c.source.classes ? c.source.classes : (c.source && c.source.group);
                return JSON.stringify(tClass) !== JSON.stringify(sClass);
            });

            if (classChanges.length > 0) {
                needsManualAction = true;
                const changeTexts = classChanges.map(c => {
                    const uId = c.source.userId || c.source.name || 'Unbekannt';
                    const targetC = JSON.stringify(c.target.classes || c.target.group || []);
                    const sourceC = JSON.stringify(c.source.classes || c.source.group || []);
                    return `${uId} (von ${targetC} zu ${sourceC})`;
                }).join(', ');

                description += `<li><strong>Klassenwechsel:</strong> ${changeTexts}</li>`;
            }
        }

        description += '</ul>';

        const apiUrl = process.env.TIX_API_URL || 'http://localhost:3000/api/tickets';
        
        let axiosConfig = {};
        if (process.env.TIX_API_TOKEN) {
             axiosConfig.headers = { 'Authorization': `Bearer ${process.env.TIX_API_TOKEN}` };
        }

        try {
            if (needsManualAction) {
                const payload = {
                    title: `Manueller Sync-Bedarf ASV -> Untis (${new Date().toLocaleDateString()})`,
                    type: 'Datenpflege',
                    category: 'ASV-Untis',
                    description: description,
                    state: 'offen.neu'
                };

                const response = await axios.post(apiUrl, payload, axiosConfig);
                console.log(`[Hook] Ticket in Tix erstellt. ID/Name:`, response.data.id || response.data._id);

                return response.data;
            } else {
                // Suche nach existierenden Tickets, um diese zu schließen
                console.log('[Hook] Keine manuellen Aktionen nötig. Suche nach offenen Tickets zum Schließen...');
                
                const searchUrl = `${apiUrl}?type=Datenpflege&status=offen.*`;
                const searchResponse = await axios.get(searchUrl, axiosConfig);
                const tickets = searchResponse.data || [];
                
                // Filtere nach der korrekten Kategorie
                const openTickets = tickets.filter(t => t.category === 'ASV-Untis' && String(t.state).startsWith('offen'));
                
                if (openTickets.length > 0) {
                    console.log(`[Hook] ${openTickets.length} offene Tickets gefunden. Setze auf 'geschlossen.erledigt'...`);
                    
                    for (const ticket of openTickets) {
                        const actionUrl = `${apiUrl}/${ticket._id}/action`;
                        const updatePayload = {
                            actionName: 'editieren',
                            formData: { state: 'geschlossen.erledigt' }
                        };
                        try {
                            await axios.post(actionUrl, updatePayload, axiosConfig);
                            console.log(`[Hook] Ticket ${ticket.id} (${ticket._id}) erfolgreich geschlossen.`);
                        } catch (actionErr) {
                            console.error(`[Hook] Fehler beim Schließen des Tickets ${ticket.id}:`, actionErr.message);
                        }
                    }
                } else {
                    console.log(`[Hook] Keine offenen Tickets gefunden und alle Daten sind aktuell.`);
                }
                
                return { success: true };
            }
        } catch (error) {
            console.error('[Hook] Fehler beim Tix-API-Call:', error.message);
            if (error.response && error.response.data) {
                 console.error('[Hook] Tix Response:', error.response.data);
            }
            throw error;
        }
    }
};
