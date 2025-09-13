package studentsync.domains;

import studentsync.base.*;

import java.io.IOException;

public class SyncTask
    extends Task<Report>
{
    DiffTask diffTask;
    public SyncTask(String master, String slave) {
        diffTask = new DiffTask(master, slave);
    }
    public SyncTask(String master, String slave, int fields) {
        diffTask = new DiffTask(master, slave, fields);
    }

    protected Diff diff() {
        return diffTask.diff();
    }

    public Report sync() {
        return sync(diff());
    }

    protected Report sync(Diff diff) {
        Report report = new Report();
        ManageableDomain slave = (ManageableDomain)diffTask.getSlave();
        if (diff.added.size() != 0) {
            for (Student student : diff.added) {
                slave.addStudent(student);
            }
            report.put("added", diff.added.size());
        }
        if (diff.removed.size() != 0) {
            for (Student student : diff.removed) {
                slave.removeStudent(student);
            }
            report.put("removed", diff.removed.size());
        }
        if (diff.changed.size() != 0) {
            for (Student student : diff.changed) {
                slave.changeStudent(student);
            }
            report.put("changed", diff.changed.size());
        }
        slave.release();

        return report;
    }

    @Override
    public Report execute() {
        return sync();
    }

    @Override
    public void run() {
    }

    public static void main(String[] args) throws IOException {
        if (args.length != 3) {
            System.err.println("Usage: <sync-config.json> master slave");
            System.exit(1);
            return;
        }
        Configuration.getInstance().setConfigPath(args[0]);
        SyncTask task = new SyncTask(args[1], args[2]);
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
