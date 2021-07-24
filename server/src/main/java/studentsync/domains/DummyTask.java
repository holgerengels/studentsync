package studentsync.domains;

import studentsync.base.Report;
import studentsync.base.Task;

public class DummyTask extends Task<Report> {
    @Override
    public Report execute() {
        Report report = new Report();
        report.put("lala", "lulu");
        return report;
    }

    @Override
    public void run() {

    }
}
