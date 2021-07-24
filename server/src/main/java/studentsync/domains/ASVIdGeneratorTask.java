package studentsync.domains;

import studentsync.base.Report;
import studentsync.base.Student;
import studentsync.base.Task;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Created by holger on 05.07.14.
 */
public class ASVIdGeneratorTask
    extends Task<Report>
{
    @Override
    public void run() {
        ASV asv = DomainFactory.getInstance().getASV();
        List<Student> students = asv.generateIds();

        if (students.size() != 0) {
            output.println("\n\nadded " + students.size());
            Student.listStudents(output, students);
        }
    }

    @Override
    public Report execute() {
        ASV asv = DomainFactory.getInstance().getASV();
        try {
            //List<String> ids = Collections.EMPTY_LIST;
            List<String> ids = asv.generateIds().stream().map(s -> s.account).collect(Collectors.toList());
            Report report = new Report();
            report.put("ids", ids);
            return report;
        }
        finally {
            asv.release();
        }
    }
}
