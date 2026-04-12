const { build, next } = require('../../src/utils/userIds');

describe('UserIDs Generator (Java Port)', () => {
    test('build generates expected base ID strings', () => {
        expect(build(18, "12", "Fabian", "Talmonl`armee")).toBe("talmonlarmee.fab12");
        expect(build(18, "123", "Doğan", "Dinç")).toBe("dinc.dog123");
        expect(build(18, "1234", "Zeÿn", "Georgÿ")).toBe("georgy.zey1234");
        expect(build(18, "12345", "Maximilian", "Müller")).toBe("mueller.max12345");
        expect(build(16, "", "Veronica", "Palacios Hildalgo")).toBe("palacioshild.ver");
    });

    const runCollisionTest = (firstName, lastName, expectedResults) => {
        const existing = [];
        for (let i = 0; i < 10; i++) {
            existing.push(next(18, existing, firstName, lastName));
        }
        expect(existing).toEqual(expectedResults);
    };

    test('next generates collision resistant sequences - Peter Müller', () => {
        runCollisionTest("Peter", "Müller", [
            "mueller.pet", "mueller.pet2", "mueller.pet3", "mueller.pet4", "mueller.pet5",
            "mueller.pet6", "mueller.pet7", "mueller.pet8", "mueller.pet9", "mueller.pet10"
        ]);
        runCollisionTest("Peter", "Müller Mayer", [
            "muellermayer.pet", "muellermayer.pet2", "muellermayer.pet3", "muellermayer.pet4", "muellermayer.pet5",
            "muellermayer.pet6", "muellermayer.pet7", "muellermayer.pet8", "muellermayer.pet9", "muellermayer.pet10"
        ]);
        runCollisionTest("Peter", "Müller Mayer-Schmidt", [
            "muellermayersc.pet", "muellermayers.pet2", "muellermayers.pet3", "muellermayers.pet4", "muellermayers.pet5",
            "muellermayers.pet6", "muellermayers.pet7", "muellermayers.pet8", "muellermayers.pet9", "muellermayer.pet10"
        ]);
    });

    test('next handles length truncation and sequential backoff - Peter abc...', () => {
        runCollisionTest("Peter", "abcdefghijklmnopq", [
            "abcdefghijklmn.pet", "abcdefghijklm.pet2", "abcdefghijklm.pet3", "abcdefghijklm.pet4", "abcdefghijklm.pet5",
            "abcdefghijklm.pet6", "abcdefghijklm.pet7", "abcdefghijklm.pet8", "abcdefghijklm.pet9", "abcdefghijkl.pet10"
        ]);
        runCollisionTest("Peter", "abcdefghijklmnop", [
            "abcdefghijklmn.pet", "abcdefghijklm.pet2", "abcdefghijklm.pet3", "abcdefghijklm.pet4", "abcdefghijklm.pet5",
            "abcdefghijklm.pet6", "abcdefghijklm.pet7", "abcdefghijklm.pet8", "abcdefghijklm.pet9", "abcdefghijkl.pet10"
        ]);
        runCollisionTest("Peter", "abcdefghijkl", [
            "abcdefghijkl.pet", "abcdefghijkl.pet2", "abcdefghijkl.pet3", "abcdefghijkl.pet4", "abcdefghijkl.pet5",
            "abcdefghijkl.pet6", "abcdefghijkl.pet7", "abcdefghijkl.pet8", "abcdefghijkl.pet9", "abcdefghijkl.pet10"
        ]);

        runCollisionTest("Li", "abcdefghijklmnopq", [
            "abcdefghijklmno.li", "abcdefghijklmn.li2", "abcdefghijklmn.li3", "abcdefghijklmn.li4", "abcdefghijklmn.li5", 
            "abcdefghijklmn.li6", "abcdefghijklmn.li7", "abcdefghijklmn.li8", "abcdefghijklmn.li9", "abcdefghijklm.li10"
        ]);
    });

    test('next handles edge case forbidden words e.g. "exe"', () => {
        runCollisionTest("exe", "La", [
            "la.exe1", "la.exe2", "la.exe3", "la.exe4", "la.exe5",
            "la.exe6", "la.exe7", "la.exe8", "la.exe9", "la.exe10"
        ]);
        runCollisionTest("exe", "Li", [
            "li.exe1", "li.exe2", "li.exe3", "li.exe4", "li.exe5",
            "li.exe6", "li.exe7", "li.exe8", "li.exe9", "li.exe10"
        ]);
        runCollisionTest("exe", "Lu", [
            "lu.exe1", "lu.exe2", "lu.exe3", "lu.exe4", "lu.exe5",
            "lu.exe6", "lu.exe7", "lu.exe8", "lu.exe9", "lu.exe10"
        ]);
    });
});
