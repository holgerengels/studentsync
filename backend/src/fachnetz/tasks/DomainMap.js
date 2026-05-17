const fs = require('fs');
const path = require('path');

/**
 * Parses CSV files that map email domains to schools.
 * 
 * CSV format: Schulname, Ort, Domain, [weitere Domains...], RP
 * 
 * Builds a Map<domain, {name, city, rp}>.
 * Domains that appear in multiple schools are excluded (doubles).
 * Also provides fuzzy matching via Jaro-Winkler distance for profiles
 * where the email domain is not in the map (e.g. ZSL, KM, IBBW addresses).
 */
class DomainMap {
    constructor(csvPaths) {
        this.map = new Map();
        this.doubles = new Set();
        this.schools = []; // deduplicated list for fuzzy matching

        const schoolSet = new Map(); // key: "name|city" → school

        for (const csvPath of csvPaths) {
            const content = fs.readFileSync(csvPath, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());

            // Skip header
            for (let i = 1; i < lines.length; i++) {
                const cols = this._parseCsvLine(lines[i]);
                if (cols.length < 4) continue;

                const name = cols[0];
                const city = cols[1];
                const rp = cols[cols.length - 1];
                const school = { name, city, rp };

                // Collect unique schools
                const key = `${name}|${city}`;
                if (!schoolSet.has(key)) {
                    schoolSet.set(key, school);
                }

                // Columns 2..n-1 are email domains
                for (let j = 2; j < cols.length - 1; j++) {
                    const domain = cols[j].trim();
                    if (!domain) continue;
                    if (this.doubles.has(domain)) continue;

                    if (this.map.has(domain)) {
                        this.doubles.add(domain);
                        this.map.delete(domain);
                        console.log(`[DomainMap] double: ${domain}`);
                    } else {
                        this.map.set(domain, school);
                    }
                }
            }
        }

        this.schools = [...schoolSet.values()];
    }

    /** Parse a CSV line respecting quoted fields (e.g. "Ministerium für Ernährung, ...") */
    _parseCsvLine(line) {
        const cols = [];
        let current = '';
        let inQuotes = false;
        for (const ch of line) {
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                cols.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        cols.push(current.trim());
        return cols;
    }

    get(domain) {
        return this.map.get(domain) || null;
    }

    /**
     * Build a city→rp map for fallback lookup when email domain is unknown.
     */
    getCityMap() {
        const cityMap = new Map();
        for (const school of this.map.values()) {
            if (!cityMap.has(school.city)) {
                cityMap.set(school.city, school.rp);
            }
        }
        return cityMap;
    }

    /**
     * Fuzzy match a profile's schulname + schulort against all known schools.
     * Returns { school, score } or null if no match above threshold.
     *
     * Expands common school-type abbreviations before comparing,
     * then combines Jaro-Winkler on schulname (weight 0.6) and schulort (weight 0.4).
     */
    fuzzyMatch(schulname, schulort, threshold = 0.82) {
        if (!schulname && !schulort) return null;

        let bestScore = 0;
        let bestSchool = null;

        const sn = this._expandAbbreviations((schulname || '').toLowerCase());
        const so = (schulort || '').toLowerCase();

        for (const school of this.schools) {
            const nameScore = sn ? jaroWinkler(sn, school.name.toLowerCase()) : 0;
            const cityScore = so ? jaroWinkler(so, school.city.toLowerCase()) : 0;

            // Weighted combination: name is more distinctive than city
            const combined = nameScore * 0.6 + cityScore * 0.4;

            if (combined > bestScore) {
                bestScore = combined;
                bestSchool = school;
            }
        }

        if (bestScore >= threshold) {
            return { school: bestSchool, score: bestScore };
        }
        return null;
    }

    /**
     * Expand common German school-type abbreviations to their full forms.
     * Applied to profile input before fuzzy matching against CSV data.
     */
    _expandAbbreviations(name) {
        // Word-boundary abbreviations (standalone words)
        const abbreviations = [
            [/\bks\b/g, 'kaufmännische schule'],
            [/\bgs\b/g, 'gewerbliche schule'],
            [/\bbs\b/g, 'berufliche schulen'],
            [/\bbsz\b/g, 'berufliches schulzentrum'],
            [/\bts\b/g, 'technische schule'],
            [/\bhs\b/g, 'hauswirtschaftliche schule'],
            [/\bhls\b/g, 'haus- und landwirtschaftliche schule'],
            [/\bls\b/g, 'landwirtschaftliche schule'],
            [/\bmgs\b/g, 'mathilde-planck-schule'],  // if needed
            [/\bgws\b/g, 'gewerbliche und hauswirtschaftliche schulen'],
        ];

        // Dot-abbreviated forms
        const dotAbbreviations = [
            [/\bkaufm\.\s*/g, 'kaufmännische '],
            [/\bgewrbl?\.\s*/g, 'gewerbliche '],
            [/\bberufl\.\s*/g, 'berufliche '],
            [/\bhauswirtschaftl\.\s*/g, 'hauswirtschaftliche '],
            [/\blandwirtschaftl\.\s*/g, 'landwirtschaftliche '],
            [/\btechn\.\s*/g, 'technische '],
        ];

        // Roman numeral normalization
        const numerals = [
            [/\b1\b/g, 'i'],
            [/\b2\b/g, 'ii'],
            [/\b3\b/g, 'iii'],
            [/\b4\b/g, 'iv'],
            [/\b5\b/g, 'v'],
        ];

        let result = name;
        for (const [pattern, replacement] of dotAbbreviations) {
            result = result.replace(pattern, replacement);
        }
        for (const [pattern, replacement] of abbreviations) {
            result = result.replace(pattern, replacement);
        }
        for (const [pattern, replacement] of numerals) {
            result = result.replace(pattern, replacement);
        }
        return result;
    }
}

/**
 * Jaro-Winkler similarity between two strings (0..1).
 */
function jaroWinkler(s1, s2) {
    if (s1 === s2) return 1.0;
    if (!s1.length || !s2.length) return 0.0;

    const matchWindow = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matching characters
    for (let i = 0; i < s1.length; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(i + matchWindow + 1, s2.length);
        for (let j = start; j < end; j++) {
            if (s2Matches[j] || s1[i] !== s2[j]) continue;
            s1Matches[i] = true;
            s2Matches[j] = true;
            matches++;
            break;
        }
    }

    if (matches === 0) return 0.0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }

    const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

    // Winkler bonus for common prefix (up to 4 chars)
    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
        if (s1[i] === s2[i]) prefix++;
        else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
}

module.exports = DomainMap;
