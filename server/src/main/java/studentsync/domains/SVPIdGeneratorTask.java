package studentsync.domains;

import studentsync.base.Report;
import studentsync.base.Student;
import studentsync.base.Task;

import java.util.List;

/**
 * Created by holger on 05.07.14.
 */
public class SVPIdGeneratorTask
    extends Task<Report>
{
    @Override
    public void run() {
        SVP svp = DomainFactory.getInstance().getSVP();
        List<Student> students = svp.generateIds();

        if (students.size() != 0) {
            output.println("\n\nadded " + students.size());
            Student.listStudents(output, students);
        }
    }

    @Override
    public Report execute() {
        SVP svp = DomainFactory.getInstance().getSVP();
        try {
            List<Student> list = svp.generateIds();
            Report report = new Report();
            report.put("idsGenerated", list.size());
            return report;
        }
        finally {
            svp.release();
        }
    }
}
