package studentsync.domains;

import studentsync.base.Report;
import studentsync.base.Task;

/**
 * Created by holger on 05.07.14.
 */
public class WebuntisExternalIdTask
    extends Task<Report>
{
    @Override
    public void run() {
        Untis untis = DomainFactory.getInstance().getUntis();
        int users = untis.studentExternalIds();

        output.println("\n\n" + users + " IDs where missing");
    }

    @Override
    public Report execute() {
        Untis untis = DomainFactory.getInstance().getUntis();

        try {
            int studentExternalIds = untis.studentExternalIds();
            int teacherExternalIds = untis.teacherExternalIds();

            Report report = new Report();
            report.put("studentExternalIds", studentExternalIds);
            report.put("teacherExternalIds", teacherExternalIds);
            return report;
        }
        finally {
            untis.release();
        }
    }
}
