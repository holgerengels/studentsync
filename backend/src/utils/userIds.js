/**
 * Port of Java studentsync.base.UserIDs
 */

const FORBIDDEN = ["exe"];

function encode(name) {
    if (!name) return "";
    let encoded = name.trim().toLowerCase();
    encoded = encoded.replace(/\s+-\s+/g, "");
    encoded = encoded.replace(/\s+/g, "");
    encoded = encoded.replace(/ä/g, "ae");
    encoded = encoded.replace(/ö/g, "oe");
    encoded = encoded.replace(/ü/g, "ue");
    encoded = encoded.replace(/ß/g, "ss");
    encoded = encoded.replace(/'/g, "");
    encoded = encoded.replace(/`/g, "");
    encoded = encoded.replace(/´/g, "");
    encoded = encoded.replace(/‘/g, "");
    encoded = encoded.replace(/-/g, "");

    // Normalizer.normalize(name, Normalizer.Form.NFD) and remove modifiers
    // This is equivalent to removing Character.NON_SPACING_MARK in Java
    return encoded.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function build(len, number, firstName, lastName) {
    const fn = encode(firstName);
    const ln = encode(lastName);
    
    number = String(number);

    const firstLen = Math.min(fn.length, 3);
    const nlen = len - firstLen - 1 - number.length;

    const lastPart = ln.length > nlen ? ln.substring(0, nlen) : ln;
    const firstPart = fn.length > 3 ? fn.substring(0, 3) : fn;

    return lastPart + '.' + firstPart + number;
}

function isForbidden(userid) {
    if (!userid || userid.length < 3) return false;
    return FORBIDDEN.includes(userid.substring(userid.length - 3));
}

function next(len, similar, firstName, lastName) {
    let userid = build(len, "", firstName, lastName);
    
    if (similar.includes(userid)) {
        let i = 2;
        do {
            const number = i.toString();
            userid = build(len, number, firstName, lastName);
            i++;
        } while (similar.includes(userid));
    } else if (isForbidden(userid)) {
        let i = 1;
        do {
            const number = i.toString();
            userid = build(len, number, firstName, lastName);
            i++;
        } while (similar.includes(userid));
    }
    
    return userid;
}

module.exports = {
    encode,
    build,
    next,
    isForbidden
};
