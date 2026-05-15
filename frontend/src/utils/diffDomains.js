/**
 * Extracts the source and target domain names from a diff config object.
 * Prefers explicit sourceDomain/targetDomain fields over the legacy name.split('-') approach,
 * which doesn't work for hyphenated domain names like 'asv-teacher'.
 */
export function getDiffDomains(diff) {
    if (diff.sourceDomain && diff.targetDomain) {
        return { source: diff.sourceDomain, target: diff.targetDomain };
    }
    // Legacy fallback for simple domain names without hyphens
    const parts = (diff.name || '').split('-');
    return { source: parts[0], target: parts[1] };
}
