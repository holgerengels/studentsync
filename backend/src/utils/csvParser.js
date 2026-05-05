/**
 * Robust TSV/CSV parsing utilities.
 * 
 * WebUntis exports tab-separated data where fields containing special
 * characters (commas, quotes, tabs) are wrapped in double-quotes.
 * A naive split('\t') breaks on quoted fields that contain tabs.
 */

/**
 * Strip surrounding double-quotes from a single field value.
 * Also unescapes inner double-quotes ("" → ").
 */
function stripQuotes(value) {
    if (!value) return value;
    if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replace(/""/g, '"');
    }
    return value;
}

/**
 * Parse a single TSV line, correctly handling quoted fields.
 * 
 * Fields wrapped in double-quotes may contain tabs, newlines, and escaped
 * double-quotes (""). This parser handles all these cases.
 * 
 * @param {string} line - A single line of TSV data
 * @returns {string[]} Array of unquoted field values
 */
function parseTsvLine(line) {
    const fields = [];
    let i = 0;
    const len = line.length;

    while (i <= len) {
        if (i === len) {
            // trailing empty field after last tab
            fields.push('');
            break;
        }

        if (line[i] === '"') {
            // Quoted field — find the closing quote
            let value = '';
            i++; // skip opening quote
            while (i < len) {
                if (line[i] === '"') {
                    if (i + 1 < len && line[i + 1] === '"') {
                        // Escaped quote
                        value += '"';
                        i += 2;
                    } else {
                        // End of quoted field
                        i++; // skip closing quote
                        break;
                    }
                } else {
                    value += line[i];
                    i++;
                }
            }
            fields.push(value);
            // Skip the tab delimiter (or end of line)
            if (i < len && line[i] === '\t') i++;
        } else {
            // Unquoted field — read until next tab
            const tabIdx = line.indexOf('\t', i);
            if (tabIdx === -1) {
                fields.push(line.substring(i));
                break;
            } else {
                fields.push(line.substring(i, tabIdx));
                i = tabIdx + 1;
            }
        }
    }

    return fields;
}

/**
 * Parse a complete TSV string into an array of row arrays.
 * 
 * @param {string} tsv - Full TSV content
 * @returns {{ headers: string[], rows: string[][] }}
 */
function parseTsv(tsv) {
    const lines = tsv.split('\n');
    const headers = lines.length > 0 ? parseTsvLine(lines[0].trim()) : [];
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        rows.push(parseTsvLine(line));
    }

    return { headers, rows };
}

module.exports = { stripQuotes, parseTsvLine, parseTsv };
