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
 * Parse a single CSV/TSV line, correctly handling quoted fields.
 * 
 * Fields wrapped in double-quotes may contain the delimiter, newlines, and escaped
 * double-quotes (""). This parser handles all these cases.
 * 
 * @param {string} line - A single line of data
 * @param {string} [delimiter='\t'] - The field separator character
 * @returns {string[]} Array of unquoted field values
 */
function parseCsvLine(line, delimiter = '\t') {
    const fields = [];
    let i = 0;
    const len = line.length;

    while (i <= len) {
        if (i === len) {
            // trailing empty field after last delimiter
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
            // Skip the delimiter (or end of line)
            if (i < len && line[i] === delimiter) i++;
        } else {
            // Unquoted field — read until next delimiter
            const tabIdx = line.indexOf(delimiter, i);
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
 * Parse a complete CSV/TSV string into an array of row arrays.
 * 
 * @param {string} content - Full content
 * @param {string} [delimiter='\t'] - The field separator character
 * @returns {{ headers: string[], rows: string[][] }}
 */
function parseCsv(content, delimiter = '\t') {
    const lines = content.split('\n');
    const headers = lines.length > 0 ? parseCsvLine(lines[0].trim(), delimiter) : [];
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        rows.push(parseCsvLine(line, delimiter));
    }

    return { headers, rows };
}

module.exports = { stripQuotes, parseCsvLine, parseCsv };
