package studentsync.domains;

import studentsync.base.Diff;

public class UntisSyncTask extends SyncTask {
    public UntisSyncTask() {
        super("asv", "untis", Diff.COMPARE_FIRST_NAME | Diff.COMPARE_LAST_NAME | Diff.COMPARE_BIRTHDAY | Diff.COMPARE_GENDER);
    }
}
