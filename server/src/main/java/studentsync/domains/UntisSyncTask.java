package studentsync.domains;

import studentsync.base.Configuration;
import studentsync.base.Diff;
import studentsync.base.Report;

import java.io.IOException;

public class UntisSyncTask extends SyncTask {
    public UntisSyncTask() {
        super("asv", "untis", Diff.COMPARE_FIRST_NAME | Diff.COMPARE_LAST_NAME | Diff.COMPARE_BIRTHDAY | Diff.COMPARE_GENDER);
    }

    public static void main(String[] args) throws IOException {
        if (args.length != 1) {
            System.err.println("Usage: <sync-config.json>");
            System.exit(1);
            return;
        }
        Configuration.getInstance().setConfigPath(args[0]);
        UntisSyncTask task = new UntisSyncTask();
        Diff diff = task.diff();
        int num = 100;
        if (diff.added.size() > num)
            diff.added = diff.added.subList(0, num);
        num -= diff.added.size();
        if (diff.changed.size() > num)
            diff.changed = diff.changed.subList(0, num);
        num -= diff.changed.size();
        if (diff.removed.size() > num)
            diff.removed = diff.removed.subList(0, num);
        num -= diff.removed.size();
        Report report = task.sync(diff);
        System.out.println("report = " + report);
    }
}
