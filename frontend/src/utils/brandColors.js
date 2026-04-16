export function getBrandColor(name, config) {
    if (!name) return 'var(--wa-color-primary-600)';
    
    if (config && config.domains) {
        const d = config.domains.find(d => d.name.toLowerCase() === name.toLowerCase() || (d.titel && d.titel.toLowerCase() === name.toLowerCase()));
        if (d && d.color) return d.color;
    }
    
    const n = name.toLowerCase();
    if (n.includes('asv')) return '#00457D';
    if (n.includes('nextcloud')) return '#0082C9';
    if (n.includes('webuntis') || n.includes('untis')) return '#FF7A00';
    if (n.includes('schulkonsole') || n.includes('paedml')) return '#00965E';
    return 'var(--wa-color-primary-600)';
}
