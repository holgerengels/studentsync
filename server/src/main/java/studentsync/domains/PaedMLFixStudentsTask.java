package studentsync.domains;

import studentsync.base.Report;
import studentsync.base.Student;
import studentsync.base.Task;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Created by holger on 05.07.14.
 */
public class PaedMLFixStudentsTask
    extends Task<Report>
{
    @Override
    public void run() {
        PaedML paedML = DomainFactory.getInstance().getPaedML();
        List<Student> students = paedML.fixStudents();

        if (students.size() != 0) {
            output.println("\n\nfixed " + students.size());
            Student.listStudents(output, students);
        }
    }

    @Override
    public Report execute() {
        PaedML paedML = DomainFactory.getInstance().getPaedML();
        try {
            //List<String> ids = Collections.EMPTY_LIST;
            List<String> ids = paedML.fixStudents().stream().map(s -> s.account).collect(Collectors.toList());
            Report report = new Report();
            report.put("ids", ids);
            return report;
        }
        finally {
            paedML.release();
        }
    }
}
