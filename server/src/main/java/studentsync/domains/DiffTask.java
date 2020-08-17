package studentsync.domains;

import studentsync.base.*;

import java.io.IOException;

public class DiffTask
    extends Task<Diff>
{
    private final String masterName;
    private final String slaveName;
    private int fields = - 1;

    public DiffTask(String master, String slave) {
        this.masterName = master;
        this.slaveName = slave;
    }
    public DiffTask(String master, String slave, int fields) {
        this.masterName = master;
        this.slaveName = slave;
        this.fields = fields;
    }

    public Domain getMaster() {
        return DomainFactory.getInstance().getDomain(masterName);
    }

    public Domain getSlave() {
        return DomainFactory.getInstance().getDomain(slaveName);
    }

    public int getFields() {
        if (fields == -1) {
            fields = getMaster().getFields() & getSlave().getFields();
        }
        return fields;
    }

    public Diff diff() {
        try {
            return new Diff().compare(getMaster().readStudents(), getSlave().readStudents(), getPairs(), getFields());
        }
        finally {
            getMaster().release();
            getSlave().release();
        }
    }

    public void print(Diff diff) {
        if (diff.added.size() != 0) {
            output.println("\n\nadded " + diff.added.size());
            Student.listStudents(output, diff.added);
        }

        if (diff.removed.size() != 0) {
            output.println("\n\nremoved " + diff.removed.size());
            Student.listStudents(output, diff.removed);
        }

        if (diff.changed.size() != 0) {
            output.println("\n\nchanged " + diff.changed.size());
            diff.listChanges(output, diff.changed);
        }

        if (diff.kept.size() != 0) {
            output.println("\n\nkept " + diff.kept.size());
            Student.listStudents(output, diff.kept);
        }
    }

    @Override
    public Diff execute() {
        return diff();
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
        DiffTask task = new DiffTask(args[1], args[2]);
        task.print(task.diff());
    }
}
