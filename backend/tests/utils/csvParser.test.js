const { stripQuotes, parseTsvLine, parseTsv } = require('../../src/utils/tsvParser');

describe('tsvParser', () => {
    describe('stripQuotes', () => {
        test('strips surrounding double-quotes', () => {
            expect(stripQuotes('"hello"')).toBe('hello');
        });

        test('unescapes inner double-quotes', () => {
            expect(stripQuotes('"Doe, ""Dr.med."""')).toBe('Doe, "Dr.med."');
        });

        test('returns unquoted values unchanged', () => {
            expect(stripQuotes('hello')).toBe('hello');
        });

        test('handles empty/null values', () => {
            expect(stripQuotes('')).toBe('');
            expect(stripQuotes(null)).toBe(null);
            expect(stripQuotes(undefined)).toBe(undefined);
        });
    });

    describe('parseTsvLine', () => {
        test('parses simple tab-separated line', () => {
            expect(parseTsvLine('a\tb\tc')).toEqual(['a', 'b', 'c']);
        });

        test('handles quoted fields with commas', () => {
            expect(parseTsvLine('"Doe, Dr.med."\tJane\ttest'))
                .toEqual(['Doe, Dr.med.', 'Jane', 'test']);
        });

        test('handles quoted fields with tabs inside', () => {
            expect(parseTsvLine('"field\twith\ttabs"\tnormal'))
                .toEqual(['field\twith\ttabs', 'normal']);
        });

        test('handles escaped double-quotes inside quoted field', () => {
            expect(parseTsvLine('"He said ""hello"""\tworld'))
                .toEqual(['He said "hello"', 'world']);
        });

        test('handles empty fields', () => {
            expect(parseTsvLine('a\t\tc')).toEqual(['a', '', 'c']);
        });

        test('handles trailing tab', () => {
            const result = parseTsvLine('a\tb\t');
            expect(result).toEqual(['a', 'b', '']);
        });

        test('handles real WebUntis guardian line with quoted name', () => {
            const line = '12345\t"Doe, Dr.med."\tJane\t\t\t\tjane_doe@example.com\t\t\t\t\tSmith\tAlice\t\t\t11127';
            const cols = parseTsvLine(line);
            expect(cols[0]).toBe('12345');
            expect(cols[1]).toBe('Doe, Dr.med.');
            expect(cols[2]).toBe('Jane');
            expect(cols[6]).toBe('jane_doe@example.com');
            expect(cols[11]).toBe('Smith');
            expect(cols[12]).toBe('Alice');
            expect(cols[15]).toBe('11127');
        });
    });

    describe('parseTsv', () => {
        test('parses full TSV with headers and rows', () => {
            const tsv = 'name\tage\tcity\nAlice\t30\tBerlin\nBob\t25\tMünchen';
            const { headers, rows } = parseTsv(tsv);
            expect(headers).toEqual(['name', 'age', 'city']);
            expect(rows).toHaveLength(2);
            expect(rows[0]).toEqual(['Alice', '30', 'Berlin']);
            expect(rows[1]).toEqual(['Bob', '25', 'München']);
        });

        test('skips empty lines', () => {
            const tsv = 'h1\th2\nval1\tval2\n\nval3\tval4';
            const { rows } = parseTsv(tsv);
            expect(rows).toHaveLength(2);
        });

        test('handles quoted fields in full parse', () => {
            const tsv = 'name\ttitle\n"Müller, Dr."\t"Prof. ""emeritus"""';
            const { rows } = parseTsv(tsv);
            expect(rows[0][0]).toBe('Müller, Dr.');
            expect(rows[0][1]).toBe('Prof. "emeritus"');
        });
    });
});
